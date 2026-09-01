"use client";

import { useCallback, useState } from "react";
import type { ComponentType } from "react";
import {
  Banknote,
  Clock,
  CreditCard,
  Gift,
  QrCode,
  Smartphone,
} from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { couriersApi } from "@/lib/api/branches-admin-api";
import { pdvApi } from "@/lib/api/pdv-api";
import type { Courier, Order, OrderItem, PaymentMethod, PaymentStatus } from "@/types/pdv";

export const orderCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const POST_PAYMENT_ADDITION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Uma comanda paga segue aberta por uma hora para acréscimos. Depois disso,
 * novos itens precisam virar um novo pedido, para não reabrir vendas antigas.
 */
export function isOrderOpenForAdditions(order: Order, now = Date.now()) {
  if (["CANCELADO", "EXPIRADO", "AGUARDANDO_CONFIRMACAO", "SAIU_PARA_ENTREGA"].includes(order.status)) return false;
  if (!order.paid_at) return true;
  return now - new Date(order.paid_at).getTime() <= POST_PAYMENT_ADDITION_WINDOW_MS;
}

export function additionWindowRemainingMinutes(order: Order, now = Date.now()) {
  if (!order.paid_at) return null;
  return Math.max(0, Math.ceil((POST_PAYMENT_ADDITION_WINDOW_MS - (now - new Date(order.paid_at).getTime())) / 60_000));
}

export function formatOrderTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;

  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function formatDuration(minutes: number | null) {
  if (minutes === null) return "--";
  return minutes < 60 ? `${minutes}min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

type PaymentOption = {
  value: PaymentMethod;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  color: string;
};

// Fonte única para rótulos, ícones e cores usados no detalhe mobile e desktop.
export const ORDER_DETAILS_PAYMENT_METHODS: readonly PaymentOption[] = [
  { value: "PIX", label: "PIX", Icon: QrCode, color: "border-teal-500/30 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20" },
  { value: "CASH", label: "Dinheiro", Icon: Banknote, color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" },
  { value: "DEBIT_CARD", label: "Débito", Icon: CreditCard, color: "border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
  { value: "CREDIT_CARD", label: "Crédito", Icon: CreditCard, color: "border-violet-500/30 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20" },
  { value: "IFOOD", label: "iFood", Icon: Smartphone, color: "border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" },
  { value: "COURTESY", label: "Cortesia", Icon: Gift, color: "border-pink-500/30 bg-pink-500/10 text-pink-600 hover:bg-pink-500/20" },
  { value: "PENDING", label: "Pendente", Icon: Clock, color: "border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" },
];

export const ORDER_DETAILS_PAYMENT_METHOD_BY_VALUE = Object.fromEntries(
  ORDER_DETAILS_PAYMENT_METHODS.map((method) => [method.value, method]),
) as Record<PaymentMethod, PaymentOption>;

export const ORDER_DETAILS_PAYMENT_LABELS = Object.fromEntries(
  ORDER_DETAILS_PAYMENT_METHODS.map((method) => [method.value, method.label]),
) as Record<PaymentMethod, string>;

export function getOutstandingOrderAmount(order: Order) {
  const pendingItemsTotal = (order.items ?? [])
    .filter((item) => item.status !== "CANCELLED" && item.payment_status !== "PAID" && item.payment_status !== "COURTESY")
    .reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);
  const feesTotal = !order.paid_at ? Number(order.packing_fee ?? 0) + Number(order.delivery_fee ?? 0) : 0;

  return pendingItemsTotal + feesTotal;
}

type OrderDetailsActionParams = {
  order: Order | null;
  onClose: () => void;
  onOrderUpdated: () => void | Promise<void>;
};

/**
 * Estado e ações comuns ao detalhe mobile e desktop. A superfície decide só a
 * disposição visual; regras de pedido, pagamento e despacho ficam em um lugar.
 */
export function useOrderDetailsActions({ order, onClose, onOrderUpdated }: OrderDetailsActionParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showPayItems, setShowPayItems] = useState(false);
  const [showChangeMethod, setShowChangeMethod] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [courierNameInput, setCourierNameInput] = useState("");
  const [courierPhoneInput, setCourierPhoneInput] = useState("");
  const [courierIdInput, setCourierIdInput] = useState("");
  const [registeredCouriers, setRegisteredCouriers] = useState<Courier[]>([]);

  const handleAction = async (action: () => Promise<unknown>, options: { closeAfter?: boolean } = {}) => {
    const closeAfter = options.closeAfter ?? false;
    setIsLoading(true);
    setErrorMsg("");
    try {
      await action();
      await onOrderUpdated();
      if (closeAfter) onClose();
    } catch (err: unknown) {
      setErrorMsg(getFriendlyErrorMessage(err, "Ocorreu um erro. Tente novamente."));
    } finally {
      setIsLoading(false);
    }
  };

  const onConfirm = () => order && handleAction(() => pdvApi.confirmOrder(order.id));
  const onReady = () => order && handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "PRONTO" }));
  const onDeliver = () => order && handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "ENTREGUE" }));
  const onRevertToQueue = () => order && handleAction(() => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "NA_FILA" }));
  const onConfirmDelivery = () => order && handleAction(() => pdvApi.confirmDelivery({ orderId: order.id }));
  const onCancel = () => {
    if (!order) return;
    if (!cancelReason.trim()) {
      setErrorMsg("Motivo obrigatório.");
      return;
    }
    void handleAction(
      () => pdvApi.updateOrderStatus({ orderId: order.id, newStatus: "CANCELADO", reason: cancelReason }),
      { closeAfter: true },
    );
  };
  const onMarkPayment = (method: PaymentMethod, status: PaymentStatus) =>
    order && handleAction(() => pdvApi.markPayment({
      orderId: order.id,
      paymentMethod: method,
      status,
      amount: getOutstandingOrderAmount(order),
    }));
  const onChangeMethod = (method: PaymentMethod) =>
    order && handleAction(async () => {
      await pdvApi.changePaymentMethod({ orderId: order.id, paymentMethod: method });
      setShowChangeMethod(false);
    });
  const onReprint = () => order && handleAction(() => pdvApi.reprintOrder({
    orderId: order.id,
    copies: order.source === "APP" ? ["KITCHEN", "JUICE_POTATO"] : ["CUSTOMER", "KITCHEN", "JUICE_POTATO"],
  }));
  const onDispatch = async () => {
    if (!order) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      await pdvApi.dispatchDelivery({
        orderId: order.id,
        courierId: courierIdInput || undefined,
        courierName: courierIdInput ? undefined : (courierNameInput.trim() || undefined),
        courierPhone: courierIdInput ? undefined : (courierPhoneInput.trim() || undefined),
      });
      await onOrderUpdated();
      setShowDispatchForm(false);
    } catch (err: unknown) {
      setErrorMsg(getFriendlyErrorMessage(err, "Ocorreu um erro ao despachar a entrega."));
    } finally {
      setIsLoading(false);
    }
  };
  const openDispatchForm = async () => {
    if (!order) return;
    setCourierNameInput(order.courier_name || "");
    setCourierPhoneInput(order.courier_phone || "");
    setCourierIdInput("");
    setShowDispatchForm(true);
    try {
      setRegisteredCouriers(await couriersApi.listByBranch(order.branch_id));
    } catch {
      setRegisteredCouriers([]);
    }
  };

  const resetActionPanels = useCallback(() => {
    setErrorMsg("");
    setShowCancelReason(false);
    setCancelReason("");
    setShowPaymentSelection(false);
    setShowChangeMethod(false);
    setShowDispatchForm(false);
  }, []);

  return {
    isLoading,
    errorMsg,
    setErrorMsg,
    showCancelReason,
    setShowCancelReason,
    cancelReason,
    setCancelReason,
    showPaymentSelection,
    setShowPaymentSelection,
    showPayItems,
    setShowPayItems,
    showChangeMethod,
    setShowChangeMethod,
    editingItem,
    setEditingItem,
    showDispatchForm,
    setShowDispatchForm,
    courierNameInput,
    setCourierNameInput,
    courierPhoneInput,
    setCourierPhoneInput,
    courierIdInput,
    setCourierIdInput,
    registeredCouriers,
    onConfirm,
    onReady,
    onDeliver,
    onRevertToQueue,
    onConfirmDelivery,
    onCancel,
    onMarkPayment,
    onChangeMethod,
    onReprint,
    onDispatch,
    openDispatchForm,
    resetActionPanels,
  };
}
