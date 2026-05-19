"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useCart, CartItem } from "@/features/cart/useCart";
import { pdvApi } from "@/lib/api/pdv-api";
import { useCurrentBranchId } from "@/contexts/BranchContext";
import { settingsApi } from "@/lib/api/settings-api";
import {
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronLeft,
  Loader2,
  User,
  ShoppingBag,
  Utensils,
  QrCode,
  Banknote,
  CreditCard,
  Smartphone,
  Gift,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PayItemsModal } from "@/app/app/pedidos/components/PayItemsModal";
import { Order } from "@/types/pdv";
import { useBranch } from "@/contexts/BranchContext";

// ─── Phone helpers (mirror /pedir page) ───────────────────────────────────────

function normalizeBrazilPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return `+55${digits}`;
}

function formatWhatsAppInput(value: string): string {
  const normalized = normalizeBrazilPhone(value);
  const digits = (
    normalized ? normalized.replace(/^\+55/, "") : value.replace(/\D/g, "").replace(/^55/, "")
  ).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

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
  { value: "IFOOD",       label: "iFood",    Icon: Smartphone, color: "border-red-200 bg-red-50 text-red-700 ring-red-200" },
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
            i < current ? "bg-brand-red w-6" : i === current ? "bg-brand-red w-10" : "bg-[var(--border)] w-4"
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
  const currentBranchId = useCurrentBranchId();
  const { currentBranch } = useBranch();
  const [step, setStep] = useState(0); // 0=items, 1=customer, 2=payment
  const [splitBill, setSplitBill] = useState(false);
  const [splitOrder, setSplitOrder] = useState<Order | null>(null); // pedido criado, esperando split

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
  const [successData, setSuccessData] = useState<{ daily_number: number; total_amount: number; ifood_charged_amount?: number | null } | null>(null);
  const [customAmountStr, setCustomAmountStr] = useState("");
  const [ifoodAmountStr, setIfoodAmountStr] = useState("");

  // Customer profile lookup (mirrors /pedir behavior)
  const [profileLookupState, setProfileLookupState] = useState<"idle" | "checking" | "found" | "not_found">("idle");
  const [profileNotice, setProfileNotice] = useState("");
  const [rememberCustomerData, setRememberCustomerData] = useState(false);
  const customerNameRef = useRef(customerName);
  const lastAutofilledPhoneRef = useRef<string | null>(null);

  useEffect(() => {
    customerNameRef.current = customerName;
  }, [customerName]);

  // Load packaging fee setting once
  useEffect(() => {
    settingsApi.getSettings().then((s) => {
      setPackagingFee(parseFloat(s.packaging_fee ?? "0") || 0);
      setApplyPackagingForTakeout(s.apply_packaging_fee_for_takeout === "true");
    }).catch(() => {});
  }, []);

  // Load recent names when opening
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      setRecentNames(getRecentNames());
      setStep(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Reset lookup state when sheet closes (deferred to avoid sync setState in effect)
  useEffect(() => {
    if (isOpen) return;
    const timer = window.setTimeout(() => {
      setProfileLookupState("idle");
      setProfileNotice("");
      setRememberCustomerData(false);
      lastAutofilledPhoneRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Debounced lookup: when phone becomes a valid E.164, query the public
  // customer profile API and auto-fill the name + offer remember toggle.
  useEffect(() => {
    if (!isOpen) return;
    const normalizedPhone = normalizeBrazilPhone(customerPhone);

    if (!normalizedPhone) {
      const idleTimer = window.setTimeout(() => {
        setProfileLookupState("idle");
        if (!customerPhone.trim()) setProfileNotice("");
      }, 0);
      return () => window.clearTimeout(idleTimer);
    }

    // Clear stale auto-fill if phone changed since last fill
    const phoneChanged =
      lastAutofilledPhoneRef.current && lastAutofilledPhoneRef.current !== normalizedPhone;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (phoneChanged) {
        lastAutofilledPhoneRef.current = null;
        setProfileNotice("");
        setRememberCustomerData(false);
      }
      try {
        setProfileLookupState("checking");
        const response = await pdvApi.getCustomerProfile({ customer_phone: normalizedPhone });
        if (cancelled) return;
        if (response.found && response.profile) {
          const resolvedName = response.profile.name ?? customerNameRef.current;
          setCustomerInfo(resolvedName, formatWhatsAppInput(normalizedPhone));
          setRememberCustomerData(true);
          lastAutofilledPhoneRef.current = normalizedPhone;
          setProfileLookupState("found");
          setProfileNotice("Cliente reconhecido pelo WhatsApp.");
        } else {
          setProfileLookupState("not_found");
          setProfileNotice("");
        }
      } catch {
        if (!cancelled) {
          setProfileLookupState("not_found");
          setProfileNotice("");
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerPhone, isOpen, setCustomerInfo]);

  const estimatedSubtotal = getEstimatedSubtotal();
  // Embalagem cobrada por krep marcado como Para Levar
  const takeoutQuantity = items.filter((i) => i.is_takeout).reduce((s, i) => s + i.quantity, 0);
  const packagingTotal = applyPackagingForTakeout && packagingFee > 0 ? takeoutQuantity * packagingFee : 0;
  const showPackagingFee = packagingTotal > 0;
  const discountNum = parseFloat(discountValue.replace(",", ".")) || 0;
  const discountAmount = hasDiscount && discountNum > 0
    ? discountType === "AMOUNT"
      ? discountNum
      : (estimatedSubtotal * discountNum) / 100
    : 0;
  const estimatedTotal = estimatedSubtotal + packagingTotal - discountAmount;
  const ifoodAmount = parseFloat(ifoodAmountStr.replace(",", ".")) || 0;

  const handleCheckout = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const customAmount = parseFloat(customAmountStr.replace(",", ".")) || 0;
      const isPartialCash = selectedPaymentMethod === "CASH" && customAmount > 0 && customAmount < estimatedTotal;
      if (!splitBill && selectedPaymentMethod === "IFOOD" && (!ifoodAmountStr.trim() || ifoodAmount < 0)) {
        setError("Informe o valor cobrado no iFood.");
        setIsSubmitting(false);
        return;
      }
      if (hasDiscount && discountNum > 0 && !discountReason.trim()) {
        setError("Informe o motivo do desconto.");
        setIsSubmitting(false);
        return;
      }

      let paymentStatus = "PAID";
      if (selectedPaymentMethod === "PENDING")   paymentStatus = "PENDING";
      if (selectedPaymentMethod === "COURTESY")  paymentStatus = "COURTESY";
      if (isPartialCash)                         paymentStatus = "PENDING";
      if (splitBill)                             paymentStatus = "PENDING";

      let finalDiscount = undefined;
      if (hasDiscount && discountNum > 0 && discountReason.trim()) {
        finalDiscount = { type: discountType, value: discountNum, reason: discountReason.trim() };
      }

      const derivedOrderType = items.some((i) => i.is_takeout) ? "VIAGEM" : "BALCAO";
      const normalizedPhone = normalizeBrazilPhone(customerPhone);
      const payload = {
        branch_id: currentBranchId,
        order_type: derivedOrderType,
        customer_name: customerName.trim() || undefined,
        customer_phone: normalizedPhone ?? (customerPhone.trim() || undefined),
        remember_checkout_data: normalizedPhone ? rememberCustomerData : false,
        notes: orderNotes.trim() || undefined,
        payment_method: splitBill ? "PENDING" : selectedPaymentMethod,
        payment_status: paymentStatus,
        split_bill: splitBill || undefined, // flag para o edge function não imprimir antes do pagamento
        ifood_charged_amount: !splitBill && selectedPaymentMethod === "IFOOD" ? ifoodAmount : undefined,
        discount: finalDiscount,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          is_takeout: item.is_takeout ?? false,
          removed_ingredient_ids: item.removed_ingredients,
          addons: item.addons.map((a) => ({ addon_id: a.addon_id, quantity: a.quantity })),
          notes: item.is_takeout
            ? `[VIAGEM] ${item.notes || ""}`.trim()
            : item.notes,
        })),
      };

      if (!currentBranchId) {
        setError("Selecione uma filial no menu superior antes de finalizar o pedido.");
        setIsSubmitting(false);
        return;
      }

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

        if (splitBill) {
          // Modo dividir conta: busca o pedido completo com itens para o PayItemsModal
          const fullOrder = await pdvApi.getOrder(response.order.order_id).catch(() => null);
          if (fullOrder) {
            clearCart();
            setSplitOrder(fullOrder);
            return; // PayItemsModal vai cuidar do resto
          }
          // fallback se busca falhar: vai pra tela de sucesso normalmente
        }

        // Pagamento parcial em dinheiro
        if (isPartialCash && customAmount > 0) {
          await pdvApi.markPayment({
            orderId: response.order.order_id,
            paymentMethod: "CASH",
            status: "PAID",
            amount: customAmount,
          }).catch(() => {});
        }

        setSuccessData({
          daily_number: response.order.daily_number,
          total_amount: response.order.total_amount,
          ifood_charged_amount: response.order.ifood_charged_amount,
        });
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
            <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">Pedido confirmado</p>
            <h2 className="mt-1 text-3xl font-black text-[var(--text-primary)]">
              #{String(successData.daily_number).padStart(3, "0")}
            </h2>
          </div>
          <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Total Oficial</p>
            <p className="mt-1 text-3xl font-black text-emerald-700">
              {currency.format(successData.total_amount)}
            </p>
            {successData.ifood_charged_amount !== null && successData.ifood_charged_amount !== undefined && (
              <p className="mt-2 text-xs font-bold text-emerald-700">
                iFood cobrado: {currency.format(successData.ifood_charged_amount)}
              </p>
            )}
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
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <span className="font-black text-[var(--text-secondary)]">{item.quantity}×</span>
                  <p className="flex-1 text-sm font-bold text-[var(--text-primary)]">{item.product.name}</p>
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
    <>
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Novo Pedido">
      <div className="flex flex-col min-h-[60vh]">

        {/* Progress */}
        <div className="px-4 pb-4 space-y-2">
          <StepIndicator current={step} total={STEPS.length} />
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            Etapa {step + 1} de {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {/* ── STEP 0: Items ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex-1 space-y-4 px-4 pb-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-black text-[var(--text-primary)]">
                            {item.quantity}× {item.product.name}
                          </p>
                          {item.is_takeout && (
                            <span className="flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                              <ShoppingBag size={10} />
                              Para Levar
                            </span>
                          )}
                        </div>
                        {item.removed_ingredients.length > 0 && (
                          <p className="text-[11px] text-brand-red font-bold mt-0.5 uppercase">
                            SEM: {item.removed_ingredients.join(", ")}
                          </p>
                        )}
                        {item.addons.length > 0 && (
                          <p className="text-[11px] text-emerald-600 font-bold mt-0.5 uppercase">
                            +{item.addons.map((a) => `${a.quantity}× ${a.addon_name || a.addon_id}`).join(", ")}
                          </p>
                        )}
                        {item.notes && (
                          <p className="mt-1 text-[11px] italic text-[var(--text-muted)]">&quot;{item.notes}&quot;</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => onEditItem?.(item)}
                          className="rounded-xl bg-[var(--bg-subtle)] p-2.5 text-[var(--text-secondary)] hover:bg-[var(--border)]"
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
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Subtotal estimado</span>
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

            {/* Packaging fee notice (per-item takeout) */}
            {showPackagingFee && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-xs font-bold text-amber-700">
                  {takeoutQuantity} item{takeoutQuantity !== 1 ? "s" : ""} para levar —{" "}
                  taxa de embalagem: <strong>{currency.format(packagingTotal)}</strong>
                </p>
              </div>
            )}

            {/* Customer name */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Nome do Cliente</p>
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 transition-all focus-within:border-brand-red/30 focus-within:bg-[var(--bg-surface)] focus-within:ring-4 focus-within:ring-brand-red/10">
                  <User className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Ex: Marcos Silva"
                    value={customerName}
                    onChange={(e) => setCustomerInfo(e.target.value, customerPhone)}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                    className="flex-1 bg-transparent py-3.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </div>
                {showNameSuggestions && recentNames.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg">
                    {recentNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={() => setCustomerInfo(name, customerPhone)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Clock className="h-3 w-3 text-[var(--text-muted)]" />
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">WhatsApp (opcional)</p>
                {profileLookupState === "checking" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    procurando...
                  </span>
                )}
              </div>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerInfo(customerName, e.target.value)}
                onBlur={() => setCustomerInfo(customerName, formatWhatsAppInput(customerPhone))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all focus:border-brand-red/30 focus:bg-[var(--bg-surface)] focus:outline-none focus:ring-4 focus:ring-brand-red/10"
              />

              {profileLookupState === "found" && profileNotice && (
                <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {profileNotice}
                </p>
              )}
              {profileLookupState === "not_found" && (
                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                  Cliente novo. Marque a opção abaixo para salvar para a próxima vez.
                </p>
              )}

              {/* Remember toggle — só aparece com telefone valido */}
              {normalizeBrazilPhone(customerPhone) && (
                <button
                  type="button"
                  onClick={() => setRememberCustomerData((v) => !v)}
                  className={`mt-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    rememberCustomerData
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-xs font-black ${rememberCustomerData ? "text-emerald-800" : "text-[var(--text-primary)]"}`}>
                      Salvar dados deste cliente
                    </span>
                    <span className={`mt-0.5 block text-[10px] font-medium leading-relaxed ${rememberCustomerData ? "text-emerald-600" : "text-[var(--text-muted)]"}`}>
                      Da próxima vez que ele digitar o WhatsApp, o nome aparece sozinho.
                    </span>
                  </span>
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${rememberCustomerData ? "bg-emerald-500" : "bg-zinc-300"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${rememberCustomerData ? "translate-x-4" : "translate-x-0.5"}`} />
                  </span>
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Obs. gerais (opcional)</p>
              <textarea
                placeholder="Detalhe importante para a produção..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all focus:border-brand-red/30 focus:bg-[var(--bg-surface)] focus:outline-none focus:ring-4 focus:ring-brand-red/10"
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

            {/* Dividir conta toggle — só aparece quando há 2+ itens */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => { setSplitBill((v) => !v); }}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                  splitBill
                    ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/10"
                    : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${splitBill ? "bg-brand-red text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}>
                  <Users className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-black ${splitBill ? "text-brand-red" : "text-[var(--text-primary)]"}`}>
                    Dividir conta por pessoa
                  </span>
                  <span className="block text-[11px] text-[var(--text-secondary)]">
                    Cada um paga o próprio krepe com o método que quiser
                  </span>
                </span>
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${splitBill ? "bg-brand-red" : "bg-zinc-200"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${splitBill ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
              </button>
            )}

            {/* Forma de pagamento + valor recebido — ocultos quando dividir conta */}
            {!splitBill && (
              <>
                <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Forma de Pagamento</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map(({ value, label, Icon, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(value)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                          selectedPaymentMethod === value
                            ? `${color} ring-2`
                            : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor recebido (só para CASH) */}
                {selectedPaymentMethod === "CASH" && (() => {
                  const received = parseFloat(customAmountStr.replace(",", ".")) || 0;
                  const change = received > 0 ? received - estimatedTotal : null;
                  const isPartial = received > 0 && received < estimatedTotal;
                  return (
                    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        Valor recebido (opcional)
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[var(--text-secondary)]">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={estimatedTotal.toFixed(2).replace(".", ",")}
                          value={customAmountStr}
                          onChange={(e) => setCustomAmountStr(e.target.value)}
                          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-black text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/40 focus:outline-none focus:ring-2 focus:ring-brand-red/10"
                        />
                        {customAmountStr && (
                          <button type="button" onClick={() => setCustomAmountStr("")}
                            className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            limpar
                          </button>
                        )}
                      </div>
                      {change !== null && change >= 0 && (
                        <div className="rounded-xl bg-emerald-50 px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-700">Troco</span>
                          <span className="text-base font-black text-emerald-700">
                            {currency.format(change)}
                          </span>
                        </div>
                      )}
                      {isPartial && (
                        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                          ⚠ Valor menor que o total — pedido ficará com pagamento parcial
                        </div>
                      )}
                    </div>
                  );
                })()}

                {selectedPaymentMethod === "IFOOD" && (() => {
                  const difference = ifoodAmount > 0 ? ifoodAmount - estimatedTotal : 0;
                  return (
                    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          Valor cobrado no iFood
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
                          Use o valor que aparece no pedido do app. O total interno continua registrado separadamente.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[var(--text-secondary)]">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={estimatedTotal.toFixed(2).replace(".", ",")}
                          value={ifoodAmountStr}
                          onChange={(e) => setIfoodAmountStr(e.target.value)}
                          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-black text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/40 focus:outline-none focus:ring-2 focus:ring-brand-red/10"
                        />
                        {ifoodAmountStr && (
                          <button
                            type="button"
                            onClick={() => setIfoodAmountStr("")}
                            className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            limpar
                          </button>
                        )}
                      </div>
                      {ifoodAmount > 0 && Math.abs(difference) > 0.009 && (
                        <div className="flex items-center justify-between rounded-xl border border-brand-red/15 bg-brand-red/5 px-3 py-2">
                          <span className="text-xs font-bold text-[var(--text-secondary)]">
                            Diferença vs. total interno
                          </span>
                          <span className="text-sm font-black text-brand-red">
                            {difference > 0 ? "+" : "-"} {currency.format(Math.abs(difference))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Dividir conta — preview quando ativo */}
            {splitBill && (
              <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 p-4 space-y-2">
                <p className="text-xs font-black text-brand-red">Dividir conta ativado</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  O pedido será criado como <strong>pendente</strong>. Na próxima tela, cada pessoa escolhe o método para pagar o próprio item.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {items.slice(0, 4).map((item, i) => (
                    <span key={i} className="rounded-lg border border-brand-red/20 bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
                      {item.quantity}× {item.product.name.split(' ')[0]}
                    </span>
                  ))}
                  {items.length > 4 && (
                    <span className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
                      +{items.length - 4} mais
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Discount */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setHasDiscount((v) => !v)}
                className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
              >
                <span>Desconto especial</span>
                {hasDiscount ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {hasDiscount && (
                <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType("AMOUNT")}
                      className={`rounded-xl border-2 px-4 py-2 text-sm font-black transition-all ${discountType === "AMOUNT" ? "border-brand-red bg-brand-red/5 text-brand-red" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                    >
                      R$
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("PERCENT")}
                      className={`rounded-xl border-2 px-4 py-2 text-sm font-black transition-all ${discountType === "PERCENT" ? "border-brand-red bg-brand-red/5 text-brand-red" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                    >
                      %
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-black text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/30 focus:outline-none focus:ring-2 focus:ring-brand-red/10"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Motivo (obrigatório)"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/30 focus:outline-none focus:ring-2 focus:ring-brand-red/10"
                  />
                </div>
              )}
            </div>

            {/* Order summary */}
            <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Resumo</p>
              <div className="flex justify-between text-sm font-semibold text-[var(--text-secondary)]">
                <span>Subtotal</span>
                <span>{currency.format(estimatedSubtotal)}</span>
              </div>
              {showPackagingFee && (
                <div className="flex justify-between text-sm font-semibold text-[var(--text-secondary)]">
                  <span>Embalagem</span>
                  <span>{currency.format(packagingTotal)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm font-bold text-emerald-600">
                  <span>Desconto</span>
                  <span>- {currency.format(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
                <span className="text-sm font-black text-[var(--text-secondary)]">Total estimado</span>
                <span className="text-2xl font-black text-brand-red">{currency.format(estimatedTotal)}</span>
              </div>
              {selectedPaymentMethod === "IFOOD" && ifoodAmount > 0 && (
                <div className="flex justify-between text-sm font-bold text-red-600">
                  <span>Cobrado no iFood</span>
                  <span>{currency.format(ifoodAmount)}</span>
                </div>
              )}
              {selectedPaymentMethod === "PENDING" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  Pedido ficará com pagamento pendente. O desconto informado acima será enviado ao servidor.
                </div>
              )}
              <p className="text-[10px] font-medium text-[var(--text-muted)]">
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
                className={`flex-1 h-14 text-base font-black shadow-lg gap-2 active:scale-[0.98] ${
                  splitBill
                    ? "bg-brand-red hover:bg-brand-red/90 shadow-brand-red/20"
                    : "bg-brand-red hover:bg-brand-red/90 shadow-brand-red/20"
                }`}
                onClick={handleCheckout}
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> PROCESSANDO...</>
                ) : splitBill ? (
                  <><Users className="h-5 w-5" /> CRIAR E DIVIDIR</>
                ) : "CONFIRMAR PEDIDO"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>

    {/* PayItemsModal após criar pedido em modo "dividir conta" */}
    {splitOrder && (
      <PayItemsModal
        order={splitOrder}
        includeIfood
        allowPending
        onPaymentRegistered={async () => {
          const refreshed = await pdvApi.getOrder(splitOrder.id).catch(() => null);
          if (refreshed) setSplitOrder(refreshed);
        }}
        onClose={() => {
          setSplitOrder(null);
          setSuccessData({ daily_number: splitOrder.daily_number, total_amount: splitOrder.total_amount });
        }}
        onPaid={() => {
          setSplitOrder(null);
          setSuccessData({ daily_number: splitOrder.daily_number, total_amount: splitOrder.total_amount });
        }}
      />
    )}
    </>
  );
}
