"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useCart, CartItem } from "@/features/cart/useCart";
import { pdvApi } from "@/lib/api/pdv-api";
import { settingsApi } from "@/lib/api/settings-api";
import {
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronLeft,
  User,
  ShoppingBag,
  Utensils,
  QrCode,
  Banknote,
  CreditCard,
  Gift,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─── Local storage helpers for recent names ───────────────────────────────────

const LS_NAMES_KEY = "pdv_recent_customer_names";

function getRecentNames(): string[] {
  try {
    const raw = localStorage.getItem(LS_NAMES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentName(name: string) {
  if (!name.trim()) return;
  const names = getRecentNames().filter((n) => n !== name.trim());
  names.unshift(name.trim());
  localStorage.setItem(LS_NAMES_KEY, JSON.stringify(names.slice(0, 5)));
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "PIX",         label: "PIX",      Icon: QrCode,     color: "border-teal-200 bg-teal-50 text-teal-700 ring-teal-200" },
  { value: "CASH",        label: "Dinheiro", Icon: Banknote,   color: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "DEBIT_CARD",  label: "Débito",   Icon: CreditCard, color: "border-blue-200 bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "CREDIT_CARD", label: "Crédito",  Icon: CreditCard, color: "border-violet-200 bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "PENDING",     label: "Pendente", Icon: Clock,      color: "border-amber-200 bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "COURTESY",   label: "Cortesia", Icon: Gift,       color: "border-pink-200 bg-pink-50 text-pink-700 ring-pink-200" },
] as const;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ─── Step progress indicator ──────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? "bg-brand-red w-6" : i === current ? "bg-brand-red w-10" : "bg-zinc-200 w-4"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEditItem?: (item: CartItem) => void;
}

export function OrderSummarySheet({ isOpen, onClose, onEditItem }: Props) {
  const {
    items, customerName, customerPhone, orderType,
    setCustomerInfo, setOrderType, orderNotes, setOrderNotes,
    getEstimatedSubtotal, removeItem, clearCart, targetOrderId,
  } = useCart();

  const router = useRouter();
  const [step, setStep] = useState(0); // 0=items, 1=customer, 2=payment

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("PIX");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [packagingFee, setPackagingFee] = useState(0);
  const [applyPackagingForTakeout, setApplyPackagingForTakeout] = useState(false);

  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ daily_number: number; total_amount: number } | null>(null);

  // Load packaging fee setting once
  useEffect(() => {
    settingsApi.getSettings().then((s) => {
      setPackagingFee(parseFloat(s.packaging_fee ?? "0") || 0);
      setApplyPackagingForTakeout(s.apply_packaging_fee_for_takeout === "true");
    }).catch(() => {});
  }, []);

  // Load recent names when opening
  useEffect(() => {
    if (isOpen) {
      setRecentNames(getRecentNames());
      setStep(0);
    }
  }, [isOpen]);

  const estimatedSubtotal = getEstimatedSubtotal();
  const showPackagingFee = orderType === "VIAGEM" && applyPackagingForTakeout && packagingFee > 0;
  const discountNum = parseFloat(discountValue.replace(",", ".")) || 0;
  const discountAmount = hasDiscount && discountNum > 0
    ? discountType === "AMOUNT"
      ? discountNum
      : (estimatedSubtotal * discountNum) / 100
    : 0;
  const estimatedTotal = estimatedSubtotal + (showPackagingFee ? packagingFee : 0) - discountAmount;

  const handleCheckout = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      let paymentStatus = "PAID";
      if (selectedPaymentMethod === "PENDING")  paymentStatus = "PENDING";
      if (selectedPaymentMethod === "COURTESY") paymentStatus = "COURTESY";

      let finalDiscount = undefined;
      if (hasDiscount && discountNum > 0 && discountReason.trim()) {
        finalDiscount = { type: discountType, value: discountNum, reason: discountReason.trim() };
      }

      const payload = {
        order_type: orderType,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        payment_method: selectedPaymentMethod,
        payment_status: paymentStatus,
        discount: finalDiscount,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          removed_ingredient_ids: item.removed_ingredients,
          addons: item.addons.map((a) => ({ addon_id: a.addon_id, quantity: a.quantity })),
          notes: item.notes,
        })),
      };

      if (targetOrderId) {
        const response = await pdvApi.addItemsToOrder({
          order_id: targetOrderId,
          items: payload.items,
        });
        if (response?.success) {
          clearCart();
          router.push("/app/pedidos");
        }
        return;
      }

      const response = await pdvApi.createAttendantOrder(payload);
      if (response?.success) {
        saveRecentName(customerName);
        setSuccessData({ daily_number: response.order.daily_number, total_amount: response.order.total_amount });
        clearCart();
      } else {
        throw new Error("Resposta inválida do servidor.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar pedido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (successData) setSuccessData(null);
    setError(null);
    onClose();
  };

  // ─── Success screen ───────────────────────────────────────────────────────

  if (successData) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Pedido Finalizado!">
        <div className="flex flex-col items-center justify-center gap-5 p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">Pedido confirmado</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-900">
              #{String(successData.daily_number).padStart(3, "0")}
            </h2>
          </div>
          <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Total Oficial</p>
            <p className="mt-1 text-3xl font-black text-emerald-700">
              {currency.format(successData.total_amount)}
            </p>
            <p className="mt-1 text-xs text-emerald-500 font-bold">Status: NA FILA</p>
          </div>
          <Button onClick={handleClose} className="w-full h-14 text-lg font-black">
            Novo Pedido
          </Button>
        </div>
      </BottomSheet>
    );
  }

  // ─── Add-to-order mode (simpler) ─────────────────────────────────────────

  if (targetOrderId) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Adicionar à Comanda">
        <div className="flex flex-col gap-5 pb-6">
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <span className="font-black text-zinc-700">{item.quantity}×</span>
                  <p className="flex-1 text-sm font-bold text-zinc-900">{item.product.name}</p>
                  <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-sm font-bold text-red-600 rounded-xl bg-red-50 p-3">⚠️ {error}</p>}
          <Button
            className="w-full h-14 text-lg font-black"
            onClick={handleCheckout}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting ? "ADICIONANDO..." : "CONFIRMAR ADIÇÃO"}
          </Button>
        </div>
      </BottomSheet>
    );
  }

  // ─── 3-step flow ─────────────────────────────────────────────────────────

  const STEPS = ["Itens", "Cliente", "Pagamento"];

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Novo Pedido">
      <div className="flex flex-col min-h-[60vh]">

        {/* Progress */}
        <div className="px-4 pb-4 space-y-2">
          <StepIndicator current={step} total={STEPS.length} />
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Etapa {step + 1} de {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {/* ── STEP 0: Items ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex-1 space-y-4 px-4 pb-4">
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-zinc-900 text-[13px]">
                          {item.quantity}× {item.product.name}
                        </p>
                        {item.removed_ingredients.length > 0 && (
                          <p className="text-[11px] text-brand-red font-bold mt-0.5 uppercase">
                            SEM: {item.removed_ingredients.join(", ")}
                          </p>
                        )}
                        {item.addons.length > 0 && (
                          <p className="text-[11px] text-emerald-600 font-bold mt-0.5 uppercase">
                            +{item.addons.map((a) => `${a.quantity}× ${a.addon_id}`).join(", ")}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-[11px] italic text-zinc-400 mt-1">&quot;{item.notes}&quot;</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => onEditItem?.(item)}
                          className="p-2.5 bg-zinc-100 rounded-xl text-zinc-500 hover:bg-zinc-200"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2.5 bg-red-50 rounded-xl text-red-400 hover:bg-red-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Subtotal estimado</span>
                <span className="text-xl font-black text-brand-red">{currency.format(estimatedSubtotal)}</span>
              </div>
            </div>

            <Button
              className="w-full h-13 font-black text-base"
              disabled={items.length === 0}
              onClick={() => setStep(1)}
            >
              Continuar → Cliente
            </Button>
          </div>
        )}

        {/* ── STEP 1: Customer ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 space-y-5 px-4 pb-4">

            {/* Order type toggle */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo de Pedido</p>
              <div className="flex gap-2 rounded-2xl bg-zinc-100 p-1">
                {(["BALCAO", "VIAGEM"] as const).map((type) => {
                  const Icon = type === "BALCAO" ? Utensils : ShoppingBag;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setOrderType(type)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wide transition-all ${
                        orderType === type
                          ? "bg-white text-brand-charcoal shadow-sm"
                          : "text-zinc-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {type === "BALCAO" ? "Balcão" : "Viagem"}
                    </button>
                  );
                })}
              </div>
              {showPackagingFee && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                  <Tag className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-700">
                    Taxa de embalagem: <strong>{currency.format(packagingFee)}</strong> incluída no total
                  </p>
                </div>
              )}
            </div>

            {/* Customer name */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nome do Cliente</p>
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 focus-within:border-brand-red/30 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-red/10 transition-all">
                  <User className="h-4 w-4 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Ex: Marcos Silva"
                    value={customerName}
                    onChange={(e) => setCustomerInfo(e.target.value, customerPhone)}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                    className="flex-1 py-3.5 bg-transparent font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none text-sm"
                  />
                </div>
                {showNameSuggestions && recentNames.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                    {recentNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={() => setCustomerInfo(name, customerPhone)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Clock className="h-3 w-3 text-zinc-400" />
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">WhatsApp (opcional)</p>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerInfo(customerName, e.target.value)}
                className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3.5 font-bold text-zinc-900 placeholder-zinc-400 focus:border-brand-red/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-red/10 transition-all text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Obs. gerais (opcional)</p>
              <textarea
                placeholder="Detalhe importante para a produção..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 font-bold text-zinc-900 placeholder-zinc-400 focus:border-brand-red/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-red/10 transition-all text-sm resize-none h-20"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="h-12 border-2 font-black gap-2" onClick={() => setStep(0)}>
                <ChevronLeft size={16} /> Voltar
              </Button>
              <Button className="flex-1 h-12 font-black text-base" onClick={() => setStep(2)}>
                Continuar → Pagamento
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Payment ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 space-y-5 px-4 pb-4">

            {/* Payment method grid */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Forma de Pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(({ value, label, Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                      selectedPaymentMethod === value
                        ? `${color} ring-2`
                        : "border-zinc-100 bg-white text-zinc-400 hover:border-zinc-200"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setHasDiscount((v) => !v)}
                className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400"
              >
                <span>Desconto especial</span>
                {hasDiscount ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {hasDiscount && (
                <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType("AMOUNT")}
                      className={`rounded-xl border-2 px-4 py-2 text-sm font-black transition-all ${discountType === "AMOUNT" ? "border-brand-red bg-brand-red/5 text-brand-red" : "border-zinc-200 text-zinc-500"}`}
                    >
                      R$
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("PERCENT")}
                      className={`rounded-xl border-2 px-4 py-2 text-sm font-black transition-all ${discountType === "PERCENT" ? "border-brand-red bg-brand-red/5 text-brand-red" : "border-zinc-200 text-zinc-500"}`}
                    >
                      %
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 font-black text-zinc-900 focus:border-brand-red/30 focus:outline-none focus:ring-2 focus:ring-brand-red/10 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Motivo (obrigatório)"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-bold text-zinc-900 placeholder-zinc-400 focus:border-brand-red/30 focus:outline-none focus:ring-2 focus:ring-brand-red/10 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Order summary */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Resumo</p>
              <div className="flex justify-between text-sm font-semibold text-zinc-600">
                <span>Subtotal</span>
                <span>{currency.format(estimatedSubtotal)}</span>
              </div>
              {showPackagingFee && (
                <div className="flex justify-between text-sm font-semibold text-zinc-600">
                  <span>Embalagem</span>
                  <span>{currency.format(packagingFee)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm font-bold text-emerald-600">
                  <span>Desconto</span>
                  <span>- {currency.format(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-zinc-200 pt-2">
                <span className="text-sm font-black text-zinc-700">Total estimado</span>
                <span className="text-2xl font-black text-brand-red">{currency.format(estimatedTotal)}</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium">
                O valor oficial é calculado pelo servidor após confirmação.
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                ⚠️ {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="h-12 border-2 font-black gap-2" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Voltar
              </Button>
              <Button
                className="flex-1 h-14 text-base font-black bg-brand-red hover:bg-brand-red/90 shadow-lg shadow-brand-red/20 gap-2 active:scale-[0.98]"
                onClick={handleCheckout}
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting ? "PROCESSANDO..." : "CONFIRMAR PEDIDO"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
