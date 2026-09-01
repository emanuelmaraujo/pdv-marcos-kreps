"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DiscardChangesDialog } from "@/components/feedback/DiscardChangesDialog";
import { Button } from "@/components/ui/Button";
import { useCart, CartItem } from "@/features/cart/useCart";
import { pdvApi } from "@/lib/api/pdv-api";
import { useCurrentBranchId } from "@/contexts/BranchContext";
import { settingsApi } from "@/lib/api/settings-api";
import { formatCep, onlyCepDigits, isValidCepFormat } from "@/lib/utils/cep";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import type { MenuData } from "@/lib/api/menu-api";
import type { Product } from "@/types/pdv";
import {
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronLeft,
  Loader2,
  User,
  ShoppingBag,
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
  Bike,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PayItemsModal } from "@/app/app/pedidos/components/PayItemsModal";
import { Order } from "@/types/pdv";
import { useBranch } from "@/contexts/BranchContext";
import { formatWhatsAppInput, normalizeBrazilPhone } from "@/lib/utils/phone";

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
  { value: "PIX",         label: "PIX",      Icon: QrCode,     color: "border-teal-500/30 bg-teal-500/10 text-teal-600 ring-teal-500/20" },
  { value: "CASH",        label: "Dinheiro", Icon: Banknote,   color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" },
  { value: "DEBIT_CARD",  label: "Débito",   Icon: CreditCard, color: "border-blue-500/30 bg-blue-500/10 text-blue-600 ring-blue-500/20" },
  { value: "CREDIT_CARD", label: "Crédito",  Icon: CreditCard, color: "border-violet-500/30 bg-violet-500/10 text-violet-600 ring-violet-500/20" },
  { value: "IFOOD",       label: "iFood",    Icon: Smartphone, color: "border-red-500/30 bg-red-500/10 text-red-600 ring-red-500/20" },
  { value: "PENDING",     label: "Pendente", Icon: Clock,      color: "border-amber-500/30 bg-amber-500/10 text-amber-600 ring-amber-500/20" },
  { value: "COURTESY",   label: "Cortesia", Icon: Gift,       color: "border-pink-500/30 bg-pink-500/10 text-pink-600 ring-pink-500/20" },
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
  /** Catálogo já carregado pela tela de novo pedido — reaproveitado aqui só
   * pra sugerir complementos, não faz fetch próprio. */
  menuData?: MenuData | null;
  onAddSuggested?: (product: Product) => void;
}

export function OrderSummarySheet({ isOpen, onClose, onEditItem, menuData, onAddSuggested }: Props) {
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
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(0);
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [deliveryComplement, setDeliveryComplement] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "resolved" | "error">("idle");
  const [cepError, setCepError] = useState("");
  const cepRequestIdRef = useRef(0);

  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ daily_number: number; total_amount: number; ifood_charged_amount?: number | null; order_type?: "BALCAO" | "VIAGEM" | "ENTREGA" } | null>(null);
  const [customAmountStr, setCustomAmountStr] = useState("");
  const [ifoodAmountStr, setIfoodAmountStr] = useState("");

  // Customer profile lookup (mirrors /pedir behavior)
  const [profileLookupState, setProfileLookupState] = useState<"idle" | "checking" | "found" | "not_found" | "error">("idle");
  const [profileNotice, setProfileNotice] = useState("");
  const [profileLookupRetry, setProfileLookupRetry] = useState(0);
  const [rememberCustomerData, setRememberCustomerData] = useState(false);
  const [isDiscardCheckoutOpen, setIsDiscardCheckoutOpen] = useState(false);
  const customerNameRef = useRef(customerName);
  const lastAutofilledPhoneRef = useRef<string | null>(null);
  const checkoutBaselineRef = useRef<string | null>(null);
  const checkoutDraftRef = useRef("");

  const checkoutDraft = useMemo(() => JSON.stringify({
    step,
    splitBill,
    selectedPaymentMethod,
    hasDiscount,
    discountType,
    discountValue,
    discountReason,
    deliveryStreet,
    deliveryNumber,
    deliveryComplement,
    deliveryNeighborhood,
    deliveryCity,
    deliveryState,
    deliveryPostalCode,
    deliveryReference,
    customAmountStr,
    ifoodAmountStr,
    customerName,
    customerPhone,
    orderNotes,
    orderType,
    rememberCustomerData,
  }), [
    customAmountStr,
    customerName,
    customerPhone,
    deliveryCity,
    deliveryComplement,
    deliveryNeighborhood,
    deliveryNumber,
    deliveryPostalCode,
    deliveryReference,
    deliveryState,
    deliveryStreet,
    discountReason,
    discountType,
    discountValue,
    hasDiscount,
    ifoodAmountStr,
    orderNotes,
    orderType,
    rememberCustomerData,
    selectedPaymentMethod,
    splitBill,
    step,
  ]);

  useEffect(() => {
    checkoutDraftRef.current = checkoutDraft;
  }, [checkoutDraft]);

  useEffect(() => {
    customerNameRef.current = customerName;
  }, [customerName]);

  // Carrega taxa de embalagem:
  //   - branch.packing_fee tem prioridade (override por filial).
  //   - Se a filial não definir (0 ou undefined), cai para o setting global.
  useEffect(() => {
    settingsApi.getSettings().then((s) => {
      const globalFee = parseFloat(s.packaging_fee ?? "0") || 0;
      const branchFee = Number(currentBranch?.packing_fee ?? 0);
      setPackagingFee(branchFee > 0 ? branchFee : globalFee);
      setApplyPackagingForTakeout(s.apply_packaging_fee_for_takeout === "true");
      setDeliveryEnabled(s.delivery_enabled === "true");
      setDefaultDeliveryFee(parseFloat(s.default_delivery_fee ?? "0") || 0);
    }).catch(() => {});
  }, [currentBranch?.packing_fee]);

  // Load recent names when opening
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      setRecentNames(getRecentNames());
      setStep(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      checkoutBaselineRef.current = null;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      checkoutBaselineRef.current = checkoutDraftRef.current;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  // Reset delivery address fields when the sheet closes (next order starts clean)
  useEffect(() => {
    if (isOpen) return;
    const timer = window.setTimeout(() => {
      setDeliveryStreet("");
      setDeliveryNumber("");
      setDeliveryComplement("");
      setDeliveryNeighborhood("");
      setDeliveryReference("");
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
        setProfileNotice("");
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
      } catch (lookupError) {
        if (!cancelled) {
          const isSessionError = lookupError instanceof Error
            && /status:\s*401|sessao|nao autenticado/i.test(lookupError.message);
          setProfileLookupState("error");
          setProfileNotice(
            isSessionError
              ? "Sua sessão expirou. Entre novamente para consultar clientes."
              : "Não foi possível consultar o cliente agora.",
          );
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerPhone, isOpen, profileLookupRetry, setCustomerInfo]);

  const isDeliveryOrder = orderType === "ENTREGA";
  const estimatedSubtotal = getEstimatedSubtotal();
  // Embalagem cobrada por krep marcado como Para Levar (entrega força embalagem em todos os itens)
  const takeoutQuantity = isDeliveryOrder
    ? items.reduce((s, i) => s + i.quantity, 0)
    : items.filter((i) => i.is_takeout).reduce((s, i) => s + i.quantity, 0);
  const packagingTotal = applyPackagingForTakeout && packagingFee > 0 ? takeoutQuantity * packagingFee : 0;
  const showPackagingFee = packagingTotal > 0;
  const deliveryFeeEstimate = isDeliveryOrder && deliveryEnabled ? defaultDeliveryFee : 0;
  const discountNum = parseFloat(discountValue.replace(",", ".")) || 0;
  const discountAmount = hasDiscount && discountNum > 0
    ? discountType === "AMOUNT"
      ? discountNum
      : (estimatedSubtotal * discountNum) / 100
    : 0;
  const estimatedTotal = estimatedSubtotal + packagingTotal + deliveryFeeEstimate - discountAmount;
  const ifoodAmount = parseFloat(ifoodAmountStr.replace(",", ".")) || 0;

  // Upsell no balcão: sugere 1 produto de cada categoria que ainda não está
  // no pedido (ex: só tem salgado → sugere bebida) — mesma ideia do upsell
  // de /pedir, mas sem ranking de popularidade (não há stats carregadas
  // aqui, só o catálogo já buscado pela tela de novo pedido).
  const upsellSuggestions = useMemo(() => {
    if (!menuData) return [];
    const cartCategoryIds = new Set(items.map((item) => item.product.category_id));
    const suggestions: Product[] = [];
    for (const category of menuData.categories) {
      if (cartCategoryIds.has(category.id)) continue;
      const firstActive = menuData.products.find(
        (product) => product.category_id === category.id && product.active !== false,
      );
      if (firstActive) suggestions.push(firstActive);
      if (suggestions.length >= 3) break;
    }
    return suggestions;
  }, [menuData, items]);

  // CEP é a fonte de verdade pra rua/bairro/cidade/UF — mesma regra do
  // checkout público. Número/complemento/referência continuam livres. O
  // servidor sempre revalida o CEP de novo.
  const handleCepChange = (raw: string) => {
    const formatted = formatCep(raw);
    const digits = onlyCepDigits(raw);
    setDeliveryPostalCode(formatted);
    setDeliveryStreet("");
    setDeliveryNeighborhood("");
    setDeliveryCity("");
    setDeliveryState("");
    setCepStatus("idle");
    setCepError("");

    if (digits.length !== 8) return;

    const requestId = ++cepRequestIdRef.current;
    setCepStatus("loading");
    pdvApi.lookupCep(digits).then((result) => {
      if (cepRequestIdRef.current !== requestId) return; // usuário já digitou outro CEP
      if (!result.success || !result.address) {
        setCepStatus("error");
        setCepError(result.error || "CEP não encontrado.");
        return;
      }
      setDeliveryStreet(result.address.street);
      setDeliveryNeighborhood(result.address.neighborhood);
      setDeliveryCity(result.address.city);
      setDeliveryState(result.address.state);
      setCepStatus("resolved");
    });
  };

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
      if (isDeliveryOrder) {
        if (!isValidCepFormat(deliveryPostalCode)) {
          setError("Informe um CEP válido para a entrega.");
          setIsSubmitting(false);
          return;
        }
        if (cepStatus !== "resolved") {
          setError(cepStatus === "error" ? (cepError || "CEP não encontrado.") : "Aguarde a confirmação do CEP.");
          setIsSubmitting(false);
          return;
        }
        if (!deliveryStreet.trim() || !deliveryNeighborhood.trim()) {
          setError("Informe ao menos rua e bairro para entrega.");
          setIsSubmitting(false);
          return;
        }
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

      const derivedOrderType = isDeliveryOrder ? "ENTREGA" : (items.some((i) => i.is_takeout) ? "VIAGEM" : "BALCAO");
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
        delivery_address: isDeliveryOrder ? {
          street: deliveryStreet.trim(),
          number: deliveryNumber.trim() || undefined,
          complement: deliveryComplement.trim() || undefined,
          neighborhood: deliveryNeighborhood.trim(),
          city: deliveryCity.trim() || undefined,
          state: deliveryState.trim() || undefined,
          postal_code: onlyCepDigits(deliveryPostalCode) || undefined,
          reference: deliveryReference.trim() || undefined,
        } : undefined,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          is_takeout: isDeliveryOrder ? true : (item.is_takeout ?? false),
          removed_ingredient_ids: item.removed_ingredients,
          addons: item.addons.map((a) => ({ addon_id: a.addon_id, quantity: a.quantity })),
          notes: isDeliveryOrder || item.is_takeout
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
          order_type: orderType,
        });
        clearCart();
      } else {
        throw new Error("Resposta inválida do servidor.");
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Não conseguimos finalizar o pedido. Tente novamente."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishClose = () => {
    checkoutBaselineRef.current = null;
    setIsDiscardCheckoutOpen(false);
    if (successData) setSuccessData(null);
    setError(null);
    onClose();
  };

  const handleClose = () => {
    const hasUnsavedChanges =
      !successData &&
      checkoutBaselineRef.current !== null &&
      checkoutDraft !== checkoutBaselineRef.current;

    if (hasUnsavedChanges) {
      setIsDiscardCheckoutOpen(true);
      return;
    }
    finishClose();
  };

  // ─── Success screen ───────────────────────────────────────────────────────

  if (successData) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Pedido Finalizado!">
        <div className="flex flex-col items-center justify-center gap-5 p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">Pedido confirmado</p>
            <h2 className="mt-1 text-3xl font-black text-[var(--text-primary)]">
              #{String(successData.daily_number).padStart(3, "0")}
            </h2>
            {successData.order_type === "VIAGEM" && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--status-warning)] ring-1 ring-[var(--status-warning)]/30">
                <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2.25} />
                Para Viagem
              </span>
            )}
            {successData.order_type === "ENTREGA" && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-600 ring-1 ring-blue-500/30">
                <Bike className="h-3.5 w-3.5" strokeWidth={2.25} />
                Entrega
              </span>
            )}
          </div>
          <div className="w-full rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Total Oficial</p>
            <p className="mt-1 text-3xl font-black text-emerald-600">
              {currency.format(successData.total_amount)}
            </p>
            {successData.ifood_charged_amount !== null && successData.ifood_charged_amount !== undefined && (
              <p className="mt-2 text-xs font-bold text-emerald-600">
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
          {error && <p className="text-sm font-bold text-[var(--status-danger)] rounded-xl bg-[var(--status-danger-bg)] p-3">⚠️ {error}</p>}
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
                            <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
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
                          className="p-2.5 bg-[var(--status-danger-bg)] rounded-xl text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20"
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

            {upsellSuggestions.length > 0 && onAddSuggested && (
              <div>
                <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Sugerir ao cliente
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  {upsellSuggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onAddSuggested(product)}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-left hover:border-brand-red/40 active:scale-[0.98]"
                    >
                      <span className="text-xs font-bold text-[var(--text-primary)]">{product.name}</span>
                      <span className="text-xs font-black text-brand-red tabular-nums">{currency.format(product.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* Entrega toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !isDeliveryOrder;
                setOrderType(next ? "ENTREGA" : "BALCAO");
                if (next) setSplitBill(false);
              }}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                isDeliveryOrder
                  ? "border-blue-400 bg-blue-500/10 ring-2 ring-blue-500/20"
                  : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isDeliveryOrder ? "bg-blue-500 text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}>
                <Bike className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-black ${isDeliveryOrder ? "text-blue-600" : "text-[var(--text-primary)]"}`}>
                  Pedido para entrega
                </span>
                <span className="block text-[11px] text-[var(--text-secondary)]">
                  Cobra taxa de entrega e exige endereço do cliente
                </span>
              </span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isDeliveryOrder ? "bg-blue-500" : "bg-[var(--border-strong)]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isDeliveryOrder ? "translate-x-4" : "translate-x-0.5"}`} />
              </span>
            </button>

            {/* Delivery address form */}
            {isDeliveryOrder && (
              <div className="space-y-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 animate-in fade-in slide-in-from-top-2">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600">
                  <MapPin className="h-3.5 w-3.5" /> Endereço de Entrega
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="CEP *"
                  value={deliveryPostalCode}
                  onChange={(e) => handleCepChange(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {cepStatus === "loading" && (
                  <p className="text-[11px] font-bold text-blue-600">Buscando endereço…</p>
                )}
                {cepStatus === "error" && (
                  <p className="text-[11px] font-bold text-[var(--status-danger)]">{cepError || "CEP não encontrado."}</p>
                )}
                {cepStatus === "resolved" && (
                  <p className="text-[11px] font-bold text-blue-600">
                    {deliveryStreet}, {deliveryNeighborhood} — {deliveryCity}/{deliveryState}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nº"
                    disabled={cepStatus !== "resolved"}
                    value={deliveryNumber}
                    onChange={(e) => setDeliveryNumber(e.target.value)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    placeholder="Complemento"
                    disabled={cepStatus !== "resolved"}
                    value={deliveryComplement}
                    onChange={(e) => setDeliveryComplement(e.target.value)}
                    className="col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Ponto de referência (opcional)"
                  disabled={cepStatus !== "resolved"}
                  value={deliveryReference}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                />
                {deliveryEnabled && deliveryFeeEstimate > 0 && (
                  <p className="text-[11px] font-bold text-blue-600">
                    Taxa de entrega estimada: {currency.format(deliveryFeeEstimate)}
                  </p>
                )}
                {!deliveryEnabled && (
                  <p className="text-[11px] font-bold text-amber-600">
                    ⚠ Entrega não está habilitada nas configurações. O pedido será rejeitado pelo servidor.
                  </p>
                )}
              </div>
            )}

            {/* Packaging fee notice (per-item takeout) */}
            {showPackagingFee && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-xs font-bold text-amber-600">
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
              {profileLookupState === "error" && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2.5">
                  <p className="text-[11px] font-bold text-[var(--status-danger)]">
                    {profileNotice}
                  </p>
                  <button
                    type="button"
                    onClick={() => setProfileLookupRetry((value) => value + 1)}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--status-danger)]/30 bg-[var(--bg-surface)] px-3 text-[11px] font-black text-[var(--status-danger)]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Remember toggle — só aparece com telefone valido */}
              {normalizeBrazilPhone(customerPhone) && (
                <button
                  type="button"
                  onClick={() => setRememberCustomerData((v) => !v)}
                  className={`mt-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    rememberCustomerData
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-xs font-black ${rememberCustomerData ? "text-emerald-600" : "text-[var(--text-primary)]"}`}>
                      Salvar dados deste cliente
                    </span>
                    <span className={`mt-0.5 block text-[10px] font-medium leading-relaxed ${rememberCustomerData ? "text-emerald-600" : "text-[var(--text-muted)]"}`}>
                      Da próxima vez que ele digitar o WhatsApp, o nome aparece sozinho.
                    </span>
                  </span>
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${rememberCustomerData ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`}>
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

            {/* Dividir conta toggle — só aparece quando há 2+ itens e não é entrega */}
            {items.length > 1 && !isDeliveryOrder && (
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
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${splitBill ? "bg-brand-red" : "bg-[var(--border-strong)]"}`}>
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
                        <div className="rounded-xl bg-emerald-500/10 px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-600">Troco</span>
                          <span className="text-base font-black text-emerald-600">
                            {currency.format(change)}
                          </span>
                        </div>
                      )}
                      {isPartial && (
                        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600">
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
              {deliveryFeeEstimate > 0 && (
                <div className="flex justify-between text-sm font-semibold text-[var(--text-secondary)]">
                  <span>Entrega</span>
                  <span>{currency.format(deliveryFeeEstimate)}</span>
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
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600">
                  Pedido ficará com pagamento pendente. O desconto informado acima será enviado ao servidor.
                </div>
              )}
              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                O valor oficial é calculado pelo servidor após confirmação.
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--status-danger)]">
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
    <DiscardChangesDialog
      isOpen={isDiscardCheckoutOpen}
      title="Fechar checkout?"
      description="O carrinho continua salvo. Revise desconto, entrega e pagamento em andamento ao reabrir."
      onCancel={() => setIsDiscardCheckoutOpen(false)}
      onDiscard={finishClose}
    />

    {/* PayItemsModal após criar pedido em modo "dividir conta" */}
    {splitOrder && (
      <PayItemsModal
        order={splitOrder}
        includeIfood
        allowPending
        context="new-order"
        onPaymentRegistered={async () => {
          const refreshed = await pdvApi.getOrder(splitOrder.id).catch(() => null);
          if (refreshed) setSplitOrder(refreshed);
        }}
        onClose={() => {
          setSplitOrder(null);
          setSuccessData({ daily_number: splitOrder.daily_number, total_amount: splitOrder.total_amount, order_type: (splitOrder.type as "BALCAO" | "VIAGEM" | "ENTREGA" | undefined) ?? orderType });
        }}
        onPaid={() => {
          setSplitOrder(null);
          setSuccessData({ daily_number: splitOrder.daily_number, total_amount: splitOrder.total_amount, order_type: (splitOrder.type as "BALCAO" | "VIAGEM" | "ENTREGA" | undefined) ?? orderType });
        }}
      />
    )}
    </>
  );
}
