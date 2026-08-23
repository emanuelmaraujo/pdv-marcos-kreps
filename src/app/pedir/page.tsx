"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Flame,
  Leaf,
  Loader2,
  LocateFixed,
  Minus,
  Package,
  PackageX,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Share2,
  Sparkles,
  ShoppingCart,
  Tag,
  Trash2,
  Utensils,
  ClipboardCopy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { PedirLanding } from "./PedirLanding";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { pdvApi, CreatePublicOrderResponse, MercadoPagoPaymentResponse, OrderingClosedError } from "@/lib/api/pdv-api";
import { Addon, CustomerAddress, DeliveryZone, Ingredient, OrderStatus, Product } from "@/types/pdv";
import { CartItem, useCart } from "@/features/cart/useCart";
import { normalizeNeighborhood } from "@/lib/utils/delivery";
import { MercadoPagoBrick } from "./_components/MercadoPagoBrick";
import { PixCheckout } from "./_components/PixCheckout";
import { PixResult } from "./_components/PixResult";
import { ProgressSteps } from "./_components/ProgressSteps";
import { FloatingInput } from "./_components/FloatingInput";
import { TimelineStep } from "./_components/TimelineStep";
import { PAYMENT_METHOD_CODE, isValidEmail } from "./_components/payment-helpers";
import { formatCep, onlyCepDigits, isValidCepFormat } from "@/lib/utils/cep";
import { getCurrentPosition } from "@/lib/utils/geolocation";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { rememberLastBranchSlug } from "@/lib/utils/lastBranch";
import {
  ALL_FILTER,
  buildMenuIndexes,
  getCategoryKind,
  getProductSummary,
  getProductTags,
  splitProductName,
} from "@/lib/menu/productTags";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DEFAULT_ORDERING_START = "17:00";
const DEFAULT_ORDERING_END = "23:30";
const INSTAGRAM_URL = "https://www.instagram.com/marcos_kreps/";
const SITE_BASE = "https://marcoskreps.com.br";
const PUBLIC_ORDER_STORAGE_KEY = "pdv-public-order";
const PUBLIC_CUSTOMER_PROFILE_KEY = "pdv-public-customer-profile";
const PENDING_ORDER_RESTORE_MS = 20 * 60 * 1000;

type SavedPublicCustomerProfile = {
  phone_e164: string;
  name: string;
  email?: string;
  order_type: "BALCAO" | "VIAGEM" | "ENTREGA";
  marketing_opt_in: boolean;
  saved_at: string;
};

type DeliveryAddressForm = {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  reference: string;
  latitude?: number;
  longitude?: number;
};

const EMPTY_DELIVERY_ADDRESS: DeliveryAddressForm = {
  street: "", number: "", complement: "", neighborhood: "",
  city: "", state: "", postal_code: "", reference: "",
  latitude: undefined, longitude: undefined,
};

type SavedPublicOrderSession = {
  order?: CreatePublicOrderResponse["order"];
  customerEmail?: string;
  saved_at?: string;
  /** Filial dona deste pedido salvo — evita restaurar a tela de pagamento/
   * confirmação de uma filial diferente da que o cliente está navegando agora. */
  branchSlug?: string;
};

function useHorizontalDragScroll() {
  const ref = useRef<HTMLElement | null>(null);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const didDragRef = useRef(false);

  const finishDrag = useCallback(() => {
    isPointerDownRef.current = false;
    ref.current?.classList.remove("cursor-grabbing");
  }, []);

  const onMouseDown = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || !ref.current) return;
    isPointerDownRef.current = true;
    didDragRef.current = false;
    startXRef.current = event.pageX - ref.current.offsetLeft;
    scrollLeftRef.current = ref.current.scrollLeft;
    ref.current.classList.add("cursor-grabbing");
  }, []);

  const onMouseMove = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!isPointerDownRef.current || !ref.current) return;
    const x = event.pageX - ref.current.offsetLeft;
    const distance = x - startXRef.current;
    if (Math.abs(distance) > 4) didDragRef.current = true;
    if (didDragRef.current) event.preventDefault();
    ref.current.scrollLeft = scrollLeftRef.current - distance;
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!didDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }, []);

  return {
    ref,
    onMouseDown,
    onMouseLeave: finishDrag,
    onMouseUp: finishDrag,
    onMouseMove,
    onClickCapture,
  };
}

function normalizeBrazilPhone(value: string) {
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

function formatWhatsAppInput(value: string) {
  const normalized = normalizeBrazilPhone(value);
  const digits = (normalized ? normalized.replace(/^\+55/, "") : value.replace(/\D/g, "").replace(/^55/, "")).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const SAVED_PROFILE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias — dispositivo compartilhado não guarda autofill pra sempre.

function readSavedPublicProfile(): SavedPublicCustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PUBLIC_CUSTOMER_PROFILE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SavedPublicCustomerProfile;
    if (!parsed.phone_e164 || !parsed.name) return null;
    const savedAt = parsed.saved_at ? new Date(parsed.saved_at).getTime() : NaN;
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > SAVED_PROFILE_TTL_MS) {
      localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
    return null;
  }
}

function savePublicProfile(profile: SavedPublicCustomerProfile) {
  localStorage.setItem(PUBLIC_CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
}

function clearSavedPublicOrderSession() {
  sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
}

function savePublicOrderSession(order: CreatePublicOrderResponse["order"], customerEmail: string, branchSlug: string) {
  sessionStorage.setItem(PUBLIC_ORDER_STORAGE_KEY, JSON.stringify({
    order,
    customerEmail: customerEmail.trim(),
    saved_at: new Date().toISOString(),
    branchSlug,
  }));
}

function hasActivePendingTransaction(transaction: MercadoPagoPaymentResponse["transaction"] | null | undefined) {
  const providerStatus = String(transaction?.provider_status ?? "").toLowerCase();
  if (!["pending", "in_process"].includes(providerStatus)) return false;
  if (!transaction?.expires_at) return false;
  return new Date(transaction.expires_at).getTime() > Date.now();
}

function isRecentPendingOrder(createdAt: string | undefined) {
  if (!createdAt) return false;
  const createdAtTime = new Date(createdAt).getTime();
  return Number.isFinite(createdAtTime) && Date.now() - createdAtTime <= PENDING_ORDER_RESTORE_MS;
}

/** Estágio (1-3) do TimelineStep na tela de confirmação, a partir do status
 * real do pedido — `null` (ainda não buscado) cai no mesmo estágio inicial
 * que a tela sempre mostrou, então não há regressão visual antes do primeiro fetch. */
function getOrderProgressStage(status: OrderStatus | null): 1 | 2 | 3 {
  switch (status) {
    case "PRONTO_PARCIAL":
    case "PRONTO":
    case "SAIU_PARA_ENTREGA":
      return 2;
    case "ENTREGUE":
      return 3;
    default:
      return 1;
  }
}

export default function PedirPublicPage() {
  const searchParams = useSearchParams();
  // Lê slug da rota /pedir/[slug] OU do search param ?branch=
  // — assim funciona quando essa page é renderizada por /pedir/page.tsx
  // (sem rota dinâmica) e por /pedir/[slug]/page.tsx (slug na URL).
  const routeParams = useParams<{ slug?: string }>();
  const _rawBranch = routeParams?.slug ?? searchParams.get("branch");
  // Guarda contra a string literal "undefined" que pode aparecer.
  const branchSlug = (_rawBranch && _rawBranch !== "undefined") ? _rawBranch : undefined;

  // Sem slug → renderiza a landing pública (picker de filial + tracking).
  // Esse caminho é o "hub" pra divulgar /pedir e deixar o cliente escolher.
  if (!branchSlug) {
    return <PedirLanding />;
  }

  return <PedirBranchPage branchSlug={branchSlug} />;
}

function PedirBranchPage({ branchSlug }: { branchSlug: string }) {
  const router = useRouter();
  const categoryDragScroll = useHorizontalDragScroll();
  const filterDragScroll = useHorizontalDragScroll();
  const {
    items,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    getEstimatedSubtotal,
    orderType,
    setOrderType,
    customerName,
    customerPhone,
    setCustomerInfo,
    orderNotes,
    setOrderNotes,
    branchSlug: cartBranchSlug,
    setBranchSlug: setCartBranchSlug,
  } = useCart();

  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Social proof: pedidos hoje + produto top por categoria. Falha silenciosa. */
  const [publicStats, setPublicStats] = useState<{ ordersToday: number; topByCategory: Record<string, string> }>({
    ordersToday: 0,
    topByCategory: {},
  });
  const [error, setError] = useState("");
  const [onlineOrderingEnabled, setOnlineOrderingEnabled] = useState(true);
  const [orderingClosedReason, setOrderingClosedReason] = useState("");
  const [packagingFee, setPackagingFee] = useState(0);
  const [applyPackagingFeeForTakeout, setApplyPackagingFeeForTakeout] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(0);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressForm>(EMPTY_DELIVERY_ADDRESS);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "resolved" | "error">("idle");
  const [cepError, setCepError] = useState("");
  const cepRequestIdRef = useRef(0);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "resolved" | "error">("idle");
  const [locationError, setLocationError] = useState("");
  const [orderingSchedule, setOrderingSchedule] = useState({
    start: DEFAULT_ORDERING_START,
    end: DEFAULT_ORDERING_END,
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [removedIngredientIds, setRemovedIngredientIds] = useState<Set<string>>(new Set());
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [step, setStep] = useState<"MENU" | "REVIEW" | "INFO" | "PAYMENT" | "PAID">("MENU");
  const [customerEmail, setCustomerEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [rememberCheckoutData, setRememberCheckoutData] = useState(false);
  const [profileLookupState, setProfileLookupState] = useState<"idle" | "checking" | "found" | "not_found">("idle");
  const [profileNotice, setProfileNotice] = useState("");
  const [addonsExpanded, setAddonsExpanded] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderData, setOrderData] = useState<CreatePublicOrderResponse["order"] | null>(null);
  const [paymentResult, setPaymentResult] = useState<MercadoPagoPaymentResponse | null>(null);
  const [paymentMode, setPaymentMode] = useState<"PIX" | "CARD">("PIX");
  const [checkoutError, setCheckoutError] = useState("");
  const { toasts, addToast, removeToast } = useToast();
  const lastAutofilledPhoneRef = useRef<string | null>(null);
  // Depois que a pessoa escolhe a modalidade na mão, o autofill de perfil
  // salvo (local ou do servidor) nunca mais pode sobrescrever essa escolha —
  // sem isso, digitar o telefone DEPOIS de escolher "Entrega" silenciosamente
  // trocava de volta pro último tipo de pedido salvo (ex: "Para levar").
  const hasManuallySelectedOrderTypeRef = useRef(false);
  // Latest customerName captured for use inside the debounced profile lookup;
  // keeps the autofill effect from re-running on every keystroke in the name field.
  const customerNameRef = useRef(customerName);
  useEffect(() => {
    customerNameRef.current = customerName;
  }, [customerName]);

  /** true quando há um carrinho com itens salvo de OUTRA filial — bloqueia
   * adicionar itens até o cliente decidir (banner com "Começar novo pedido").
   * Não depende de nenhum rastreamento próprio de "hidratou ou não": antes de
   * hidratar, cartBranchSlug vem do estado padrão (null), então `!!cartBranchSlug`
   * já garante que essa checagem só liga depois que o valor real (se houver)
   * chegou do localStorage — sem isso, uma janela entre "hidratou" (rastreado
   * separadamente) e "o valor já propagou pra este componente" deixava o
   * efeito de adoção abaixo sobrescrever o branchSlug certo pelo errado antes
   * do mismatch ser detectado. */
  const branchDraftMismatch = !!cartBranchSlug && cartBranchSlug !== branchSlug && items.length > 0;

  // Adota a filial atual no carrinho — só quando não há nada em risco (carrinho
  // vazio ou nunca associado a uma filial). Roda uma única vez por filial,
  // lendo o estado mais fresco possível via getState() no instante exato em
  // que o zustand termina de hidratar — não pelas props do hook, que podem
  // levar um render a mais pra refletir o valor hidratado.
  const branchOwnershipCheckedRef = useRef(false);
  useEffect(() => {
    branchOwnershipCheckedRef.current = false;
    const applyOwnership = () => {
      if (branchOwnershipCheckedRef.current) return;
      branchOwnershipCheckedRef.current = true;
      const state = useCart.getState();
      if ((state.items.length === 0 || !state.branchSlug) && state.branchSlug !== branchSlug) {
        state.setBranchSlug(branchSlug);
      }
    };
    if (useCart.persist.hasHydrated()) {
      applyOwnership();
      return;
    }
    return useCart.persist.onFinishHydration(applyOwnership);
  }, [branchSlug]);

  const handleStartFreshOrder = useCallback(() => {
    clearCart();
    setCartBranchSlug(branchSlug);
  }, [branchSlug, clearCart, setCartBranchSlug]);

  useEffect(() => {
    rememberLastBranchSlug(branchSlug);
  }, [branchSlug]);

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
        if (!config.success) throw new Error(config.error || "Erro ao carregar configuracoes de pedido.");
        const resolvedBranchId = config.branch?.id ?? null;
        setBranchName(config.branch?.name ?? null);
        setBranchId(resolvedBranchId);
        setDeliveryEnabled(config.branch?.delivery_enabled === true);
        setDefaultDeliveryFee(Number(config.branch?.default_delivery_fee ?? 0));
        const settings = config.settings;
        const start = settings.public_ordering_start_time ?? DEFAULT_ORDERING_START;
        const end = settings.public_ordering_end_time ?? DEFAULT_ORDERING_END;
        const isEnabled = config.online_ordering_enabled;
        const fee = Number(String(settings.packaging_fee ?? "0").replace(",", ".")) || 0;

        setOrderingSchedule({ start, end });
        setPackagingFee(fee);
        setApplyPackagingFeeForTakeout(settings.apply_packaging_fee_for_takeout === "true");
        setOnlineOrderingEnabled(isEnabled);
        setOrderingClosedReason(config.ordering_closed_reason);
        if (!isEnabled) clearCart();
        const data = await menuApi.getMenuData(resolvedBranchId);
        setMenuData(data);
        setSelectedCategoryId(data.categories[0]?.id ?? null);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, "Não conseguimos carregar o cardápio. Tente novamente."));
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, [clearCart, branchSlug]);

  // Zonas de entrega da filial (leitura pública direta, só para estimar a
  // taxa antes do envio — o cálculo autoritativo roda no servidor).
  useEffect(() => {
    if (!branchId || !deliveryEnabled) {
      const timer = window.setTimeout(() => setDeliveryZones([]), 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    pdvApi.listDeliveryZones(branchId).then((zones) => {
      if (!cancelled) setDeliveryZones(zones);
    });
    return () => { cancelled = true; };
  }, [branchId, deliveryEnabled]);

  // Carrega métricas de social proof (orders_today + top product por categoria).
  // Falha silenciosa: se der erro, simplesmente não exibe os badges.
  useEffect(() => {
    let cancelled = false;
    pdvApi.getPublicBranchStats(branchSlug).then((res) => {
      if (cancelled || !res.success) return;
      setPublicStats({
        ordersToday: res.orders_today ?? 0,
        topByCategory: res.top_product_by_category ?? {},
      });
    });
    return () => { cancelled = true; };
  }, [branchSlug]);

  useEffect(() => {
    let cancelled = false;
    try {
      const stored = sessionStorage.getItem(PUBLIC_ORDER_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as SavedPublicOrderSession;
      const savedOrder = parsed.order;
      if (!savedOrder?.order_id || !savedOrder.public_token) {
        clearSavedPublicOrderSession();
        return;
      }
      // Pedido salvo pertence a outra filial (ex: cliente pediu na Filial A,
      // depois abriu o link da Filial B na mesma aba) — não trava a tela nova
      // mostrando pagamento/confirmação de um pedido que não é deste lugar.
      if (parsed.branchSlug && parsed.branchSlug !== branchSlug) {
        clearSavedPublicOrderSession();
        return;
      }

      void pdvApi.getPublicOrderStatus({ public_token: savedOrder.public_token })
        .then((status) => {
          if (cancelled) return;
          if (status.order.payment_status === "PAID") {
            setOrderData(savedOrder);
            setCustomerEmail(parsed.customerEmail ?? "");
            clearCart();
            clearSavedPublicOrderSession();
            setStep("PAID");
            return;
          }

          const canRestorePayment =
            status.order.status === "AGUARDANDO_PAGAMENTO" &&
            status.order.payment_status === "PENDING" &&
            (hasActivePendingTransaction(status.transaction) || isRecentPendingOrder(status.order.created_at));

          if (canRestorePayment) {
            setOrderData(savedOrder);
            setCustomerEmail(parsed.customerEmail ?? "");
            setStep("PAYMENT");
            return;
          }

          clearSavedPublicOrderSession();
          setOrderData(null);
          setPaymentResult(null);
          setStep("MENU");
        })
        .catch(() => {
          clearSavedPublicOrderSession();
        });
    } catch {
      clearSavedPublicOrderSession();
    }
    return () => {
      cancelled = true;
    };
  }, [branchSlug, clearCart]);

  // Checkout expresso: se este dispositivo já tem um perfil salvo (90 dias)
  // de um pedido anterior, pré-popula o telefone assim que a página carrega
  // — não espera o cliente chegar em "Dados" e digitar de novo. O efeito
  // abaixo (que já existia) reconhece esse telefone e completa o resto
  // (nome/e-mail/modalidade) sozinho.
  useEffect(() => {
    if (customerPhone.trim()) return;
    const saved = readSavedPublicProfile();
    if (saved?.phone_e164) {
      setCustomerInfo(saved.name, formatWhatsAppInput(saved.phone_e164));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const normalizedPhone = normalizeBrazilPhone(customerPhone);
    if (!normalizedPhone) {
      const timer = window.setTimeout(() => {
        setProfileLookupState("idle");
        if (!customerPhone.trim()) setProfileNotice("");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const saved = readSavedPublicProfile();
    if (saved?.phone_e164 === normalizedPhone) {
      const timer = window.setTimeout(() => {
        setCustomerInfo(saved.name, formatWhatsAppInput(saved.phone_e164));
        setCustomerEmail(saved.email ?? "");
        setMarketingOptIn(saved.marketing_opt_in);
        setRememberCheckoutData(true);
        if (!hasManuallySelectedOrderTypeRef.current) setOrderType(saved.order_type);
        lastAutofilledPhoneRef.current = saved.phone_e164;
        setProfileLookupState("found");
        setProfileNotice("Dados salvos neste dispositivo encontrados.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (lastAutofilledPhoneRef.current && lastAutofilledPhoneRef.current !== normalizedPhone) {
      lastAutofilledPhoneRef.current = null;
      setCustomerInfo("", formatWhatsAppInput(normalizedPhone));
      setCustomerEmail("");
      setMarketingOptIn(false);
      setRememberCheckoutData(false);
      setProfileNotice("");
      setSavedAddresses([]);
      setSelectedAddressId(null);
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setProfileLookupState("checking");
        const response = await pdvApi.getPublicCustomerProfile({ customer_phone: normalizedPhone });
        if (cancelled) return;
        if (response.found && response.profile) {
          setCustomerInfo(response.profile.name ?? customerNameRef.current, formatWhatsAppInput(normalizedPhone));
          setCustomerEmail(response.profile.email ?? "");
          setMarketingOptIn(response.profile.marketing_opt_in === true);
          if (
            !hasManuallySelectedOrderTypeRef.current &&
            (response.profile.order_type === "BALCAO" || response.profile.order_type === "VIAGEM")
          ) {
            setOrderType(response.profile.order_type);
          }
          const addresses = response.addresses ?? [];
          setSavedAddresses(addresses);
          setSelectedAddressId(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null);
          setRememberCheckoutData(true);
          lastAutofilledPhoneRef.current = normalizedPhone;
          setProfileLookupState("found");
          setProfileNotice("Encontrei seus dados salvos pelo WhatsApp.");
        } else {
          setProfileLookupState("not_found");
          setProfileNotice("");
          setSavedAddresses([]);
          setSelectedAddressId(null);
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
  }, [customerPhone, setCustomerInfo, setOrderType]);

  useEffect(() => {
    const recheck = async () => {
      try {
        const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
        if (!config.success) throw new Error(config.error || "Erro ao validar horario.");
        const settings = config.settings;
        const start = settings.public_ordering_start_time ?? DEFAULT_ORDERING_START;
        const end = settings.public_ordering_end_time ?? DEFAULT_ORDERING_END;
        const isEnabled = config.online_ordering_enabled;

        setOrderingSchedule({ start, end });
        setOnlineOrderingEnabled(isEnabled);
        setOrderingClosedReason(config.ordering_closed_reason);
        if (!isEnabled) clearCart();
      } catch {
        // best-effort: mantem o estado atual em caso de erro
      }
    };

    const interval = window.setInterval(recheck, 60_000);
    return () => window.clearInterval(interval);
  }, [branchSlug, clearCart]);

  useEffect(() => {
    if (!orderData || step === "PAID") return;

    const interval = window.setInterval(async () => {
      try {
        const status = await pdvApi.getPublicOrderStatus({
          public_token: orderData.public_token,
        });
        if (status.order.payment_status === "PAID") {
          clearCart();
          clearSavedPublicOrderSession();
          setStep("PAID");
        }
      } catch {
        // Polling is best-effort; the Brick and webhook remain the source of truth.
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [clearCart, orderData, step]);

  // Status real do pedido na tela de confirmação (PAID) — antes o TimelineStep
  // sempre mostrava "Em preparo" fixo, sem refletir o que de fato acontece na
  // cozinha. Frequência mais baixa que o polling de pagamento (pré-pagamento):
  // aqui é só a confirmação visual, o acompanhamento completo vive em
  // /pedido/[publicToken].
  const [liveOrderStatus, setLiveOrderStatus] = useState<OrderStatus | null>(null);
  useEffect(() => {
    if (step !== "PAID" || !orderData) return;

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const result = await pdvApi.getPublicOrderStatus({ public_token: orderData.public_token });
        if (!cancelled) setLiveOrderStatus(result.order.status);
      } catch {
        // Best-effort: a tela de confirmação cai de volta pro estado genérico se a checagem falhar.
      }
    };

    void fetchStatus();
    const interval = window.setInterval(fetchStatus, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [step, orderData]);

  const menuIndexes = useMemo(() => buildMenuIndexes(menuData), [menuData]);

  // Upsell na REVIEW: sugere o produto mais pedido de categorias que ainda
  // não estão no carrinho (ex: carrinho só tem salgado → sugere bebida/doce).
  // Usa publicStats.topByCategory, que já era buscado e antes só alimentava
  // a badge "Mais pedido" — reaproveitado aqui em vez de virar dado morto.
  const upsellSuggestions = useMemo(() => {
    if (!menuData) return [];
    const cartCategoryIds = new Set(items.map((item) => item.product.category_id));
    const productById = new Map(menuData.products.map((product) => [product.id, product]));
    return Object.entries(publicStats.topByCategory)
      .filter(([categoryId]) => !cartCategoryIds.has(categoryId))
      .map(([, productId]) => productById.get(productId))
      .filter((product): product is Product => !!product && product.active !== false)
      .slice(0, 4);
  }, [menuData, items, publicStats.topByCategory]);


  // Mapa { categoryId → produtos } na ordem das categorias
  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    if (!menuData) return map;
    for (const c of menuData.categories) {
      map[c.id] = menuData.products.filter((p) => p.category_id === c.id);
    }
    return map;
  }, [menuData]);

  // Filtros por categoria — só faz sentido mostrar quando há 2+ tags
  const filtersByCategory = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!menuData) return map;
    for (const c of menuData.categories) {
      const tags = new Set<string>();
      for (const p of (productsByCategory[c.id] ?? [])) {
        getProductTags(p, c.name, menuIndexes).forEach((t) => tags.add(t));
      }
      map[c.id] = tags.size >= 2 ? [ALL_FILTER, ...Array.from(tags)] : [];
    }
    return map;
  }, [menuData, productsByCategory, menuIndexes]);

  // Filtro ativo por categoria (default: Todos)
  const [filterByCategory, setFilterByCategory] = useState<Record<string, string>>({});
  const setCategoryFilter = useCallback((categoryId: string, filter: string) => {
    setFilterByCategory((prev) => ({ ...prev, [categoryId]: filter }));
  }, []);

  // Refs para section / tab — usados pelo scroll-spy e pelo scroll programático
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const suppressSpyRef = useRef(false);

  // Scroll-spy: atualiza categoria ativa conforme o usuário rola.
  // Capture phase pega scroll de qualquer container aninhado.
  useEffect(() => {
    if (!menuData) return;
    let raf = 0;
    const TRIGGER_OFFSET = 180; // abaixo do header (56) + tabs sticky (~110)

    function pickActive() {
      raf = 0;
      if (suppressSpyRef.current) return;
      let bestId: string | null = null;
      let bestTop = -Infinity;
      for (const [id, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= TRIGGER_OFFSET && top > bestTop) {
          bestTop = top;
          bestId = id;
        }
      }
      if (bestId) setSelectedCategoryId(bestId);
    }
    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(pickActive);
    }
    pickActive();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [menuData]);

  // Scroll suave até a section + bypass do scroll-spy
  const scrollToCategory = useCallback((categoryId: string) => {
    const el = sectionRefs.current[categoryId];
    if (!el) return;
    suppressSpyRef.current = true;
    setSelectedCategoryId(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => { suppressSpyRef.current = false; }, 700);
  }, []);

  // Centraliza horizontalmente a tab ativa
  useEffect(() => {
    if (!selectedCategoryId) return;
    const el = tabRefs.current[selectedCategoryId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedCategoryId]);

  const productDefaultIngredients = useMemo(() => {
    if (!selectedProduct || !menuIndexes) return [];
    const ingredientIds = menuIndexes.ingredientIdsByProduct.get(selectedProduct.id) ?? [];
    return ingredientIds.map((id) => menuIndexes.ingredientsById.get(id)).filter(Boolean) as Ingredient[];
  }, [menuIndexes, selectedProduct]);

  const selectedProductCategory = useMemo(() => {
    if (!menuData || !selectedProduct) return undefined;
    return menuData.categories.find((category) => category.id === selectedProduct.category_id);
  }, [menuData, selectedProduct]);

  const productAddons = useMemo(() => {
    if (!selectedProduct || !menuIndexes) return [];
    const addonIds = menuIndexes.addonIdsByProduct.get(selectedProduct.id) ?? [];
    return addonIds.map((id) => menuIndexes.addonsById.get(id)).filter(Boolean) as Addon[];
  }, [menuIndexes, selectedProduct]);

  const sheetSubtotal = useMemo(() => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    selectedAddons.forEach((qty, addonId) => {
      const addon = menuIndexes?.addonsById.get(addonId);
      if (addon) total += addon.price * qty;
    });
    return total * quantity;
  }, [menuIndexes, quantity, selectedAddons, selectedProduct]);

  const estimatedSubtotal = getEstimatedSubtotal();
  const estimatedPackagingFee = orderType === "VIAGEM" && applyPackagingFeeForTakeout ? packagingFee : 0;

  // Estimativa de taxa de entrega — mesma regra do servidor (resolveDeliveryFee):
  // sem zona cadastrada usa a taxa padrão da filial; com zonas, bairro fora da
  // lista fica bloqueado. O total oficial sempre é recalculado no backend.
  const selectedSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId) ?? null;
  const effectiveNeighborhood = selectedSavedAddress ? selectedSavedAddress.neighborhood : deliveryAddress.neighborhood;
  const deliveryNeighborhoodNormalized = normalizeNeighborhood(effectiveNeighborhood);
  const matchedDeliveryZone = deliveryZones.find(
    (zone) => zone.neighborhood_normalized === deliveryNeighborhoodNormalized,
  );
  const deliveryBlocked = orderType === "ENTREGA"
    && deliveryZones.length > 0
    && !!deliveryNeighborhoodNormalized
    && !matchedDeliveryZone;
  const estimatedDeliveryFee = orderType === "ENTREGA"
    ? (matchedDeliveryZone ? matchedDeliveryZone.fee : deliveryZones.length === 0 ? defaultDeliveryFee : 0)
    : 0;
  const estimatedTotal = estimatedSubtotal + estimatedPackagingFee + estimatedDeliveryFee;
  const checkoutPhone = useMemo(() => normalizeBrazilPhone(customerPhone), [customerPhone]);
  const isProfileChecking = !!checkoutPhone && profileLookupState === "checking";

  // Elegível a pular a tela de Dados: já reconhecemos o cliente (perfil
  // encontrado) e a modalidade não precisa de endereço — ENTREGA sempre
  // passa por Dados pra confirmar/escolher o endereço, o perfil salvo neste
  // dispositivo não guarda isso.
  const canExpressCheckout = profileLookupState === "found"
    && (orderType === "BALCAO" || orderType === "VIAGEM")
    && !!customerName.trim()
    && !!checkoutPhone;
  const selectedAddonCount = useMemo(() => {
    let count = 0;
    selectedAddons.forEach((qty) => {
      count += qty;
    });
    return count;
  }, [selectedAddons]);

  const openCustomization = useCallback((product: Product, existingItem?: CartItem) => {
    if (branchDraftMismatch) {
      addToast("error", "Resolva o pedido em aberto de outra unidade antes de continuar.");
      return;
    }
    setSelectedProduct(product);
    setAddonsExpanded(false);
    if (existingItem) {
      setEditingCartItemId(existingItem.id);
      setRemovedIngredientIds(new Set(existingItem.removed_ingredients));
      setSelectedAddons(new Map(existingItem.addons.map((addon) => [addon.addon_id, addon.quantity])));
      setQuantity(existingItem.quantity);
      setItemNotes(existingItem.notes || "");
    } else {
      setEditingCartItemId(null);
      setRemovedIngredientIds(new Set());
      setSelectedAddons(new Map());
      setQuantity(1);
      setItemNotes("");
    }
  }, [addToast, branchDraftMismatch]);

  // Histórico do navegador: enquanto o modal de personalização está aberto,
  // o botão Voltar fecha o modal em vez de sair da página — pusha uma
  // entrada extra no histórico ao abrir e a consome no popstate.
  const modalHistoryPushedRef = useRef(false);
  useEffect(() => {
    if (selectedProduct && !modalHistoryPushedRef.current) {
      window.history.pushState({ pedirModal: true }, "");
      modalHistoryPushedRef.current = true;
    }
  }, [selectedProduct]);

  useEffect(() => {
    const onPopState = () => {
      if (modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = false;
        setSelectedProduct(null);
        setEditingCartItemId(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const closeCustomization = useCallback(() => {
    if (modalHistoryPushedRef.current) {
      // Consome a entrada extra do histórico — o listener de popstate acima
      // termina de limpar o estado quando o evento disparar.
      window.history.back();
    } else {
      setSelectedProduct(null);
      setEditingCartItemId(null);
    }
  }, []);

  // Histórico do navegador: sair do cardápio (REVIEW/INFO/PAYMENT/PAID) pusha
  // UMA entrada (não uma por passo — trocar de passo dentro do checkout não
  // pusha de novo, só a entrada e saída do fluxo). O botão Voltar do
  // navegador fecha o checkout inteiro e volta pro cardápio em vez de sair
  // de /pedir — e sair pelo botão "Cardápio"/"Voltar ao cardápio" da própria
  // UI consome essa entrada (history.back()), então também não sobra uma
  // entrada "fantasma" exigindo um Voltar extra depois.
  const wizardHistoryPushedRef = useRef(false);
  useEffect(() => {
    if (step !== "MENU" && !wizardHistoryPushedRef.current) {
      window.history.pushState({ pedirWizard: true }, "");
      wizardHistoryPushedRef.current = true;
    } else if (step === "MENU" && wizardHistoryPushedRef.current) {
      wizardHistoryPushedRef.current = false;
      window.history.back();
    }
  }, [step]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { pedirWizard?: boolean } | null;
      if (!state?.pedirWizard && wizardHistoryPushedRef.current) {
        wizardHistoryPushedRef.current = false;
        setStep("MENU");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return;
    const addonsArray = Array.from(selectedAddons.entries()).map(([addonId, qty]) => {
      const addon = menuIndexes?.addonsById.get(addonId);
      return { addon_id: addonId, addon_name: addon?.name, quantity: qty, price: addon?.price || 0 };
    });

    const itemData = {
      product: selectedProduct,
      quantity,
      removed_ingredients: Array.from(removedIngredientIds),
      addons: addonsArray,
      notes: itemNotes.trim() || undefined,
      is_takeout: orderType === "VIAGEM",
    };

    if (editingCartItemId) updateItem(editingCartItemId, itemData);
    else addItem(itemData);

    addToast("success", editingCartItemId
      ? `${splitProductName(selectedProduct.name).title} atualizado`
      : `${splitProductName(selectedProduct.name).title} adicionado ao pedido`);
    closeCustomization();
  }, [
    addItem,
    addToast,
    closeCustomization,
    editingCartItemId,
    itemNotes,
    menuIndexes,
    orderType,
    quantity,
    removedIngredientIds,
    selectedAddons,
    selectedProduct,
    updateItem,
  ]);

  /** "Não é você?" — descarta o autofill e limpa o perfil salvo neste dispositivo. */
  const handleForgetSavedProfile = useCallback(() => {
    localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
    lastAutofilledPhoneRef.current = null;
    setCustomerInfo("", customerPhone);
    setCustomerEmail("");
    setMarketingOptIn(false);
    setRememberCheckoutData(false);
    setSavedAddresses([]);
    setSelectedAddressId(null);
    setProfileNotice("");
    setProfileLookupState("not_found");
    addToast("success", "Dados salvos neste dispositivo foram apagados.");
  }, [addToast, customerPhone, setCustomerInfo]);

  // CEP é a fonte de verdade pra rua/bairro/cidade/UF — bloqueia digitar um
  // bairro atendido só pra escapar do bloqueio de zona. Número/complemento/
  // referência continuam livres. O servidor sempre revalida o CEP de novo.
  const handleCepChange = useCallback((raw: string) => {
    const formatted = formatCep(raw);
    const digits = onlyCepDigits(raw);
    setDeliveryAddress((p) => ({ ...p, postal_code: formatted, street: "", neighborhood: "", city: "", state: "", latitude: undefined, longitude: undefined }));
    setCepStatus("idle");
    setCepError("");
    setLocationStatus("idle");
    setLocationError("");

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
      setDeliveryAddress((p) => ({
        ...p,
        street: result.address!.street,
        neighborhood: result.address!.neighborhood,
        city: result.address!.city,
        state: result.address!.state,
      }));
      setCepStatus("resolved");
    });
  }, []);

  // Pin de GPS é só um complemento pro motoboy achar o lugar mais fácil —
  // nunca bloqueia o pedido. Sem permissão, segue normalmente sem o pin.
  const handleUseCurrentLocation = useCallback(async () => {
    setLocationStatus("loading");
    setLocationError("");
    try {
      const { latitude, longitude } = await getCurrentPosition();
      setDeliveryAddress((p) => ({ ...p, latitude, longitude }));
      setLocationStatus("resolved");
    } catch (err) {
      setLocationStatus("error");
      setLocationError(getFriendlyErrorMessage(err, "Não foi possível obter sua localização agora."));
    }
  }, []);

  /** Volta pro cardápio SEM descartar um pedido aguardando pagamento — o
   * cliente pode continuar navegando/montando outro pedido normalmente, e o
   * pedido pendente fica disponível pra retomar via o banner em "orderData
   * && orderAwaitingPayment" logo abaixo (botão "Continuar pagamento"). */
  const handleBackToMenu = useCallback(() => {
    setStep("MENU");
  }, []);

  /** Descarta de vez o pedido aguardando pagamento — usado quando o cliente
   * escolhe explicitamente "Começar um novo pedido" (banner do cardápio) ou
   * quando o pedido já foi pago (tela de confirmação não precisa de opção
   * de retomar, já está concluído). */
  const handleDiscardPendingOrder = useCallback(() => {
    setOrderData(null);
    setPaymentResult(null);
    clearSavedPublicOrderSession();
    setStep("MENU");
  }, []);

  /** true quando existe um pedido criado mas ainda não pago — é o único caso
   * em que faz sentido oferecer "continuar pagamento" em vez de só permitir
   * seguir criando um pedido novo. Uma vez pago, o polling em outro efeito já
   * limpa orderData/cart e leva pra tela PAID sozinho. */
  const orderAwaitingPayment = !!orderData && orderData.payment_status !== "PAID";

  const handleCreateOrder = async () => {
    if (isSubmittingOrder) return;
    setCheckoutError("");

    // Revalida o horario no momento exato do clique para garantir que o cliente
    // nao consiga submeter um pedido quando o atendimento ja encerrou ou foi pausado.
    try {
      const config = await pdvApi.getPublicCheckoutConfig();
      if (!config.success) throw new Error(config.error || "Erro ao validar horario.");
      const settings = config.settings;
      const start = settings.public_ordering_start_time ?? DEFAULT_ORDERING_START;
      const end = settings.public_ordering_end_time ?? DEFAULT_ORDERING_END;

      setOrderingSchedule({ start, end });
      setOnlineOrderingEnabled(config.online_ordering_enabled);
      setOrderingClosedReason(config.ordering_closed_reason);

      if (!config.online_ordering_enabled) {
        const reason = config.ordering_closed_reason || "No momento nao estamos recebendo pedidos.";
        setCheckoutError(reason);
        clearCart();
        return;
      }
    } catch (err) {
      setCheckoutError(getFriendlyErrorMessage(err, "Não foi possível validar o horário de atendimento."));
      return;
    }
    if (items.length === 0) {
      setCheckoutError("Seu carrinho esta vazio.");
      return;
    }
    const normalizedPhone = normalizeBrazilPhone(customerPhone);
    if (customerPhone.trim() && !normalizedPhone) {
      setCheckoutError("Informe um WhatsApp valido com DDD.");
      return;
    }
    if (customerEmail.trim() && !isValidEmail(customerEmail)) {
      setCheckoutError("Se informar e-mail, use um endereco valido.");
      return;
    }
    if (orderType === "ENTREGA") {
      if (!normalizedPhone) {
        setCheckoutError("Informe um WhatsApp valido com DDD para pedidos de entrega.");
        return;
      }
      if (!selectedSavedAddress) {
        if (!isValidCepFormat(deliveryAddress.postal_code)) {
          setCheckoutError("Informe um CEP válido para a entrega.");
          return;
        }
        if (cepStatus !== "resolved") {
          setCheckoutError(cepStatus === "error" ? (cepError || "CEP não encontrado.") : "Aguarde a confirmação do CEP.");
          return;
        }
        if (!deliveryAddress.street.trim() || !deliveryAddress.neighborhood.trim()) {
          setCheckoutError("Informe ao menos rua e bairro para a entrega.");
          return;
        }
      }
      if (deliveryBlocked) {
        setCheckoutError("Não realizamos entregas nesse bairro no momento.");
        return;
      }
    }

    setIsSubmittingOrder(true);
    try {
      const publicOrderType: "BALCAO" | "VIAGEM" | "ENTREGA" = orderType;
      const response = await pdvApi.createPublicOrder({
        order_type: publicOrderType,
        customer_name: customerName.trim() || undefined,
        customer_phone: normalizedPhone ?? undefined,
        customer_email: customerEmail.trim() || undefined,
        marketing_opt_in: !!normalizedPhone && marketingOptIn,
        remember_checkout_data: !!normalizedPhone && !!customerName.trim() && rememberCheckoutData,
        notes: orderNotes.trim() || undefined,
        payment_method_code: PAYMENT_METHOD_CODE,
        branch_slug: branchSlug,
        delivery_address_id: orderType === "ENTREGA" ? selectedSavedAddress?.id : undefined,
        delivery_address: orderType === "ENTREGA" && !selectedSavedAddress ? {
          street: deliveryAddress.street.trim(),
          number: deliveryAddress.number.trim() || undefined,
          complement: deliveryAddress.complement.trim() || undefined,
          neighborhood: deliveryAddress.neighborhood.trim(),
          city: deliveryAddress.city.trim() || undefined,
          state: deliveryAddress.state.trim() || undefined,
          postal_code: onlyCepDigits(deliveryAddress.postal_code) || undefined,
          reference: deliveryAddress.reference.trim() || undefined,
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
        } : undefined,
        // Cobre o caso de reaproveitar endereço salvo: o pin marcado agora
        // vale mesmo sem digitar um endereço novo.
        location_latitude: orderType === "ENTREGA" ? deliveryAddress.latitude : undefined,
        location_longitude: orderType === "ENTREGA" ? deliveryAddress.longitude : undefined,
        save_address: orderType === "ENTREGA" && !selectedSavedAddress && saveThisAddress,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          removed_ingredient_ids: item.removed_ingredients,
          addons: item.addons.map((addon) => ({ addon_id: addon.addon_id, quantity: addon.quantity })),
          notes: item.is_takeout || orderType === "VIAGEM"
            ? `[VIAGEM] ${item.notes || ""}`.trim()
            : item.notes,
        })),
      });

      setOrderData(response.order);
      if (rememberCheckoutData && normalizedPhone && customerName.trim()) {
        savePublicProfile({
          phone_e164: normalizedPhone,
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          order_type: publicOrderType,
          marketing_opt_in: marketingOptIn,
          saved_at: new Date().toISOString(),
        });
      } else {
        localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
      }
      savePublicOrderSession(response.order, customerEmail, branchSlug);
      setPaymentResult(null);
      setPaymentMode("PIX");
      setStep("PAYMENT");
    } catch (err) {
      if (err instanceof OrderingClosedError) {
        setOnlineOrderingEnabled(false);
        setOrderingClosedReason(err.message);
        clearCart();
      } else {
        setCheckoutError(getFriendlyErrorMessage(err, "Não conseguimos criar o pedido. Tente novamente."));
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 space-y-4" style={{ backgroundColor: "var(--bg-base)" }}>
        {/* Skeleton hero */}
        <div className="skeleton h-44 w-full rounded-3xl" />
        {/* Skeleton tabs */}
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        {/* Skeleton product cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-44 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ backgroundColor: "var(--bg-base)" }}>
        <AlertCircle className="h-12 w-12 text-brand-red" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Não foi possível abrir o cardápio</h1>
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark"
          style={{ height: 44 }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!onlineOrderingEnabled) {
    return (
      <div className="flex min-h-screen flex-col text-[var(--text-primary)]" style={{ backgroundColor: "var(--bg-base)" }}>
        <header
          className="border-b border-[var(--border)] px-4 py-3 shadow-[var(--shadow-sm)]"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <Image
              src="/logo.png"
              alt="Marcos Krep's"
              width={48}
              height={48}
              className="h-11 w-11 shrink-0 rounded-full ring-2 ring-[var(--border)]"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] truncate">Marcos Krep&apos;s</h1>
              <p className="text-xs font-medium text-[var(--text-secondary)] truncate">
                {branchName ? `Pedido online · ${branchName}` : "Pedido online"}
              </p>
            </div>
          </div>
        </header>
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "var(--status-warning-bg, #FFFBEB)", color: "var(--status-warning, #D97706)" }}
          >
            <Clock className="h-10 w-10" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold text-brand-red">Pedidos pausados</p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)] leading-tight">
              No momento não estamos recebendo pedidos.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {orderingClosedReason || `O atendimento online funciona das ${orderingSchedule.start} às ${orderingSchedule.end}.`}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              Enquanto isso, siga o Marcos Krep&apos;s no Instagram para acompanhar novidades.
            </p>
          </div>
          <div className="grid w-full max-w-xs gap-2">
            {/* Primária: voltar ao landing pra escolher outra filial ou acompanhar pedido */}
            <button
              type="button"
              onClick={() => router.push("/pedir")}
              className="flex items-center justify-center gap-2 rounded-full bg-brand-red px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
              style={{ height: 48 }}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              Voltar para escolher
            </button>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-[0.98]"
              style={{ height: 44 }}
            >
              Seguir no Instagram
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-medium text-[var(--text-muted)] underline hover:text-[var(--text-secondary)] mt-1"
            >
              Verificar novamente
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 text-[var(--text-primary)]" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Header sticky. Fundo sólido (não translúcido) + transform: translateZ(0)
         para criar uma compositor layer própria — evita o flicker/shake que
         o backdrop-blur causava ao rolar com outros elementos sticky abaixo. */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)] px-4 py-3 shadow-[var(--shadow-sm)]"
        style={{ backgroundColor: "var(--bg-surface)", transform: "translateZ(0)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo.png"
              alt="Marcos Krep's"
              width={48}
              height={48}
              className="h-11 w-11 shrink-0 rounded-full ring-2 ring-[var(--border)] sm:h-12 sm:w-12"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] truncate">Marcos Krep&apos;s</h1>
              <p className="text-xs font-medium text-[var(--text-secondary)] truncate">
                {branchName ? `Pedido online · ${branchName}` : "Pedido online"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {orderData && step === "MENU" && (
              <button
                type="button"
                onClick={() => router.push(`/pedido/${encodeURIComponent(orderData.public_token)}?branch=${encodeURIComponent(branchSlug)}`)}
                className="flex items-center gap-1.5 rounded-full bg-[var(--status-success-bg)] px-3 py-1.5 text-caption font-semibold text-[var(--status-success)] hover:opacity-90 animate-pulse"
              >
                <Package className="h-3.5 w-3.5" strokeWidth={1.75} />
                Pedido #{String(orderData.daily_number).padStart(3, "0")} em andamento
              </button>
            )}
            {step !== "MENU" && (
              <Button variant="ghost" size="sm" className="min-h-11 gap-1" onClick={handleBackToMenu}>
                <ChevronLeft className="h-4 w-4" />
                Cardapio
              </Button>
            )}
          </div>
        </div>
      </header>

      {step === "MENU" && (
        <main className="mx-auto max-w-7xl space-y-5 p-4 xl:px-6">
          {/* Pedido criado mas ainda não pago — o cliente pode retomar o pagamento
             OU seguir montando um pedido novo normalmente, sem ficar preso
             num ou noutro. */}
          {orderAwaitingPayment && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--status-info-bg)", color: "var(--status-info, #2563EB)" }}
                >
                  <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Pedido #{String(orderData!.daily_number).padStart(3, "0")} aguardando pagamento
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {currency.format(orderData!.total_amount)} · Continue de onde parou ou monte um pedido novo.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setStep("PAYMENT")}
                      className="flex h-9 items-center justify-center rounded-full bg-brand-red px-4 text-xs font-semibold text-white hover:bg-brand-red-dark active:scale-[0.98]"
                    >
                      Continuar pagamento
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardPendingOrder}
                      className="flex h-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-[0.98]"
                    >
                      Começar um novo pedido
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Carrinho órfão de outra filial — bloqueia adicionar item até resolver */}
          {branchDraftMismatch && (
            <section className="rounded-2xl border border-[var(--status-warning,#D97706)]/30 bg-[var(--status-warning-bg,#FFFBEB)] p-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--status-warning-bg, #FFFBEB)", color: "var(--status-warning, #D97706)" }}
                >
                  <ShoppingCart className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Você tem um pedido em aberto em outra unidade</p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Pra pedir aqui em {branchName ?? "esta unidade"}, comece um novo pedido — o carrinho da outra unidade some.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleStartFreshOrder}
                      className="flex h-9 items-center justify-center rounded-full bg-brand-red px-4 text-xs font-semibold text-white hover:bg-brand-red-dark active:scale-[0.98]"
                    >
                      Começar um novo pedido
                    </button>
                    {cartBranchSlug && (
                      <button
                        type="button"
                        onClick={() => router.push(`/pedir/${cartBranchSlug}`)}
                        className="flex h-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-[0.98]"
                      >
                        Ver esse pedido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Hero — marrom escuro, copy direta ao benefício */}
          <section
            className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[var(--shadow-md)] md:p-8"
            style={{ backgroundColor: "var(--bg-inverse)" }}
          >
            {/* Glow vermelho sutil no canto */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-red/20 blur-3xl" />
            <div className="pointer-events-none absolute right-12 bottom-0 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-2xl" />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                {/* Badge "Aberto agora" com pulso verde */}
                {onlineOrderingEnabled ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    Aberto agora · fecha às {orderingSchedule.end}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                    Fechado · abre às {orderingSchedule.start}
                  </span>
                )}

                <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight md:text-[28px]">
                  Krep caprichado, pedido sem fila.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65 md:text-[15px]">
                  Escolha o recheio, ajuste a composição e pague com segurança quando estiver tudo certo.
                </p>
                {publicStats.ordersToday > 0 && (
                  <p className="mt-2 text-xs font-medium text-white/55">
                    {publicStats.ordersToday === 1
                      ? "1 pedido feito hoje"
                      : `${publicStats.ordersToday} pedidos feitos hoje`}
                  </p>
                )}
              </div>

              {/* Carrinho compacto no canto direito (desktop) */}
              {items.length > 0 && !branchDraftMismatch && (
                <button
                  type="button"
                  onClick={() => setStep("REVIEW")}
                  className="hidden md:flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left hover:bg-white/15"
                >
                  <ShoppingCart className="h-5 w-5 text-white" strokeWidth={1.75} />
                  <div className="leading-tight">
                    <p className="text-caption text-white/70">Seu pedido</p>
                    <p className="text-sm font-semibold text-white tabular-nums">{items.length} {items.length === 1 ? "item" : "itens"} · {currency.format(estimatedTotal)}</p>
                  </div>
                </button>
              )}
            </div>
          </section>

          {/* Tabs sticky — colado abaixo do header do /pedir.
             Header h-11 logo + py-3 = ~68px no mobile, sm:h-12 = ~72px no sm+.
             Usamos ~70px que cobre ambos sem deixar gap visível. */}
          <div
            className="sticky top-[68px] sm:top-[72px] z-30 -mx-4 px-3 py-2 border-b border-[var(--border)] shadow-[var(--shadow-sm)]"
            style={{ backgroundColor: "var(--bg-surface)", transform: "translateZ(0)" }}
          >
            <section
              {...categoryDragScroll}
              className="flex cursor-grab select-none gap-1.5 overflow-x-auto hide-scrollbar"
            >
              {menuData?.categories.map((category) => {
                const isActive = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    ref={(el) => { tabRefs.current[category.id] = el; }}
                    onClick={() => scrollToCategory(category.id)}
                    className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold ${
                      isActive
                        ? "bg-brand-red text-white shadow-[var(--shadow-sm)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-6">
          {(menuData?.products.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
              <PackageX className="mx-auto h-8 w-8 text-[var(--text-muted)]" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Cardápio indisponível no momento</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Esta unidade ainda não cadastrou itens pra pedido online. Volte mais tarde.</p>
            </div>
          ) : (
          <>
          {/* Render TODAS as categorias como sections — usuário rola entre elas */}
          {menuData?.categories.map((category) => {
            const categoryProducts = productsByCategory[category.id] ?? [];
            if (categoryProducts.length === 0) return null;
            const filters = filtersByCategory[category.id] ?? [];
            const activeFilter = filterByCategory[category.id] ?? ALL_FILTER;
            const visibleProducts = filters.length === 0 || activeFilter === ALL_FILTER
              ? categoryProducts
              : categoryProducts.filter((p) => getProductTags(p, category.name, menuIndexes).includes(activeFilter));

            return (
              <section
                key={category.id}
                ref={(el) => { sectionRefs.current[category.id] = el; }}
                data-category-id={category.id}
                className="scroll-mt-32"
              >
                <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight mb-3">{category.name}</h2>

                {/* Filtros — só aparecem quando há 2+ tags */}
                {filters.length > 0 && (
                  <section
                    {...filterDragScroll}
                    className="flex cursor-grab select-none gap-1.5 overflow-x-auto pb-3 hide-scrollbar"
                  >
                    {filters.map((filter) => {
                      const isActive = activeFilter === filter;
                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setCategoryFilter(category.id, filter)}
                          className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium ${
                            isActive
                              ? "bg-[var(--brand-light)] text-brand-red border border-brand-red/30"
                              : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {filter === ALL_FILTER ? <Search className="h-3 w-3" strokeWidth={1.75} /> : <Tag className="h-3 w-3" strokeWidth={1.75} />}
                          {filter}
                        </button>
                      );
                    })}
                  </section>
                )}

                {visibleProducts.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-2">Nenhum item para esse filtro.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleProducts.map((product) => {
                      const { code, title } = splitProductName(product.name);
                      const tags = getProductTags(product, category.name, menuIndexes);
                      const summary = getProductSummary(product, category.name, menuIndexes);
                      const categoryKind = getCategoryKind(category.name);
                      const isMostOrdered = publicStats.topByCategory[product.category_id ?? ""] === product.id;

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => openCustomization(product)}
                          className="group relative flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] active:scale-[0.98]"
                        >
                          {isMostOrdered && (
                            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-micro font-semibold text-[var(--accent)]">
                              🔥 Mais pedido
                            </span>
                          )}
                          <div className="flex items-start gap-3">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt=""
                                width={56}
                                height={56}
                                sizes="56px"
                                className="h-14 w-14 shrink-0 rounded-xl object-cover bg-[var(--bg-subtle)]"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-brand-red">
                                {categoryKind === "SAVORY" ? <Flame className="h-6 w-6" strokeWidth={1.75} />
                                : categoryKind === "SWEET" ? <Sparkles className="h-6 w-6" strokeWidth={1.75} />
                                : categoryKind === "DRINK" ? <Package className="h-6 w-6" strokeWidth={1.75} />
                                : <Utensils className="h-6 w-6" strokeWidth={1.75} />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {code && (
                                  <span className="text-caption font-medium text-[var(--text-muted)] tabular-nums">#{code}</span>
                                )}
                                {tags[0] && tags[0] !== "Outros" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-micro font-semibold text-brand-red">
                                    {tags[0] === "Vegetariano" ? <Leaf className="h-2.5 w-2.5" strokeWidth={1.75} /> : <Flame className="h-2.5 w-2.5" strokeWidth={1.75} />}
                                    {tags[0]}
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-[var(--text-primary)]">{title}</h3>
                              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{summary}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <p className="text-lg font-bold text-brand-red tabular-nums">
                              <span className="text-xs mr-0.5 font-medium opacity-70">R$</span>
                              {product.price.toFixed(2).replace(".", ",")}
                            </p>
                            <span className="flex h-11 items-center gap-1 rounded-full bg-brand-red px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] group-hover:bg-brand-red-dark">
                              <Plus className="h-4 w-4" strokeWidth={2} />
                              Montar
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
          </>
          )}
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-24 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-muted)]">Seu pedido</p>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Carrinho</h2>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)]">
                    <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                </div>

                {items.length === 0 || branchDraftMismatch ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-5 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {branchDraftMismatch ? "Resolva o pedido em aberto de outra unidade acima." : "Escolha um krep para montar seu pedido."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                          <div className="flex items-start gap-2">
                            <span className="rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)]">{item.quantity}×</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.product.name}</p>
                              {item.addons.length > 0 && (
                                <p className="mt-0.5 truncate text-xs text-[var(--status-success)]">
                                  + {item.addons.map((addon) => `${addon.quantity}× ${addon.addon_name}`).join(", ")}
                                </p>
                              )}
                            </div>
                            <button
                              className="focus-ring relative rounded-lg bg-[var(--bg-surface)] p-1.5 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] after:absolute after:inset-[-8px] after:content-['']"
                              onClick={() => removeItem(item.id)}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-subtle)] p-4">
                      <div className="flex items-center justify-between text-sm font-semibold text-[var(--text-primary)]">
                        <span>Total estimado</span>
                        <span className="text-xl tabular-nums" style={{ color: "var(--accent)" }}>{currency.format(estimatedTotal)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("REVIEW")}
                        className="mt-3 flex w-full h-12 items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
                      >
                        <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                        Fechar pedido
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Sticky bottom cart bar — só mobile/tablet (sidebar cobre desktop) */}
          {items.length > 0 && !branchDraftMismatch && (
            <div
              className="xl:hidden fixed left-3 right-3 bottom-3 z-40 animate-in slide-in-from-bottom-8"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <button
                type="button"
                onClick={() => setStep("REVIEW")}
                className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 shadow-[var(--shadow-lg)] active:scale-[0.98]"
                style={{ backgroundColor: "var(--bg-inverse)" }}
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white">
                  <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-micro font-semibold text-brand-red ring-2 ring-[var(--bg-inverse)]">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 text-left leading-tight">
                  <p className="text-caption text-white/60">{items.length === 1 ? "1 item no pedido" : `${items.length} itens no pedido`}</p>
                  <p className="text-base font-semibold text-white tabular-nums">
                    <span className="text-xs text-white/60 mr-0.5 font-medium">R$</span>
                    {estimatedTotal.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-white/80 shrink-0 pr-2">
                  Ver carrinho
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </button>
            </div>
          )}
        </main>
      )}

      {/* ── Tela 3: REVIEW — só a revisão dos itens do pedido ──────────── */}
      {step === "REVIEW" && (
        <main className="mx-auto max-w-2xl space-y-4 p-4">
          <ProgressSteps current={1} />

          <section className="rounded-2xl px-5 py-4 text-white shadow-[var(--shadow-sm)]" style={{ backgroundColor: "var(--bg-inverse)" }}>
            <h2 className="text-lg font-semibold tracking-tight md:text-xl">Confira seu pedido</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              Revise os itens. Em seguida você informa seus dados e paga.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Seus itens</h2>
              <button
                type="button"
                onClick={() => setStep("MENU")}
                className="text-xs font-semibold text-brand-red hover:text-brand-red-dark"
              >
                + Adicionar mais
              </button>
            </div>

            {items.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-6 text-center">
                <ShoppingCart className="mx-auto h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Seu carrinho está vazio.</p>
                <button
                  type="button"
                  onClick={() => setStep("MENU")}
                  className="mt-3 text-sm font-semibold text-brand-red hover:text-brand-red-dark"
                >
                  Ver cardápio
                </button>
              </div>
            ) : (
            <>
            <div className="mt-3 divide-y divide-[var(--border)]">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  <span className="rounded-md bg-[var(--bg-inverse)] px-2 py-0.5 text-xs font-semibold text-white shrink-0 tabular-nums">{item.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.product.name}</p>
                    {item.addons.length > 0 && (
                      <p className="mt-0.5 text-xs text-[var(--status-success)]">
                        + {item.addons.map((addon) => `${addon.quantity}× ${addon.addon_name}`).join(", ")}
                      </p>
                    )}
                    {item.notes && <p className="mt-0.5 text-xs italic text-[var(--text-muted)]">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                      {currency.format((item.product.price + item.addons.reduce((s, a) => s + a.price * a.quantity, 0)) * item.quantity)}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--bg-subtle)] p-2.5 text-[var(--text-secondary)] hover:bg-[var(--border)] ml-2"
                      onClick={() => openCustomization(item.product, item)}
                      aria-label="Editar item"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--status-danger-bg)] p-2.5 text-[var(--status-danger)] hover:opacity-80"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-[var(--bg-subtle)] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <span>Subtotal</span>
                <span className="tabular-nums">{currency.format(estimatedSubtotal)}</span>
              </div>
              {estimatedPackagingFee > 0 && (
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Embalagem para viagem</span>
                  <span className="tabular-nums">{currency.format(estimatedPackagingFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">
                <span>Total</span>
                <span className="text-xl tabular-nums" style={{ color: "var(--accent)" }}>{currency.format(estimatedTotal)}</span>
              </div>
            </div>
            </>
            )}
          </section>

          {items.length > 0 && upsellSuggestions.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-sm font-semibold text-[var(--text-primary)]">Complete seu pedido</h3>
              <div className="flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
                {upsellSuggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openCustomization(product)}
                    className="flex w-36 shrink-0 flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-micro font-semibold text-[var(--accent)]">
                        🔥 Popular
                      </span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-red text-white">
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs font-semibold leading-tight text-[var(--text-primary)]">
                      {splitProductName(product.name).title}
                    </p>
                    <p className="text-sm font-bold text-brand-red tabular-nums">{currency.format(product.price)}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {items.length > 0 && checkoutError && (
            <div className="rounded-2xl bg-[var(--status-danger-bg)] p-3 text-sm font-medium text-[var(--status-danger)]">
              {checkoutError}
            </div>
          )}

          {items.length > 0 && canExpressCheckout ? (
            <div className="space-y-2">
              <div className="rounded-xl bg-[var(--status-success-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-success)]">
                Reconhecemos você, {customerName.trim().split(" ")[0]} — pode confirmar direto.
              </div>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isSubmittingOrder}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
                style={{ height: 52 }}
              >
                {isSubmittingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" strokeWidth={1.75} />}
                Confirmar e pagar
              </button>
              <button
                type="button"
                onClick={() => setStep("INFO")}
                className="flex w-full items-center justify-center gap-1 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Revisar meus dados antes de continuar
              </button>
            </div>
          ) : items.length > 0 ? (
            <button
              type="button"
              onClick={() => setStep("INFO")}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
              style={{ height: 52 }}
            >
              Continuar
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
        </main>
      )}

      {/* ── Tela 4: INFO — dados do cliente + modalidade ───────────────── */}
      {step === "INFO" && (
        <main className="mx-auto max-w-2xl space-y-3 p-3 pb-40 sm:p-4 sm:pb-40">
          {/* Linha compacta: voltar + progress inline (mobile só mostra textos curtos) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("REVIEW")}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Voltar para itens"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="flex-1 min-w-0">
              <ProgressSteps current={2} />
            </div>
          </div>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Seus dados</h2>

            <FloatingInput
              label="WhatsApp com DDD (opcional)"
              value={customerPhone}
              onChange={(v) => setCustomerInfo(customerName, formatWhatsAppInput(v))}
              onBlur={() => setCustomerInfo(customerName, formatWhatsAppInput(customerPhone))}
              placeholder="(11) 99999-9999"
              type="tel"
              inputMode="tel"
              help="Opcional. Usamos o WhatsApp para enviar atualizacoes do pedido."
            />

            <div className="rounded-xl bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--status-warning)]">
              Voce pode comprar sem preencher seus dados. Se informar o WhatsApp, ele sera usado para avisos de status do pedido.
            </div>

            {isProfileChecking && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-red" />
                Buscando dados salvos...
              </div>
            )}

            <>
                {profileNotice && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--status-success)]">{profileNotice}</p>
                    <button
                      type="button"
                      onClick={handleForgetSavedProfile}
                      className="shrink-0 text-xs font-medium text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
                    >
                      Não é você?
                    </button>
                  </div>
                )}
                {checkoutPhone && profileLookupState === "not_found" && (
                  <p className="text-xs font-medium text-[var(--status-warning)]">
                    Não encontrei dados salvos. Complete abaixo.
                  </p>
                )}

                <FloatingInput
                  label="Nome (opcional)"
                  value={customerName}
                  onChange={(v) => setCustomerInfo(v, customerPhone)}
                  placeholder="Como te chamar?"
                />

                <FloatingInput
                  label="E-mail (opcional)"
                  value={customerEmail}
                  onChange={setCustomerEmail}
                  placeholder="usado no PIX"
                  type="email"
                />

                <div>
                  <p className="mb-1 text-caption font-medium text-[var(--text-muted)]">Modalidade</p>
                  <div className="flex rounded-xl bg-[var(--bg-subtle)] p-0.5">
                    {([
                      { v: "BALCAO", label: "Comer aqui" },
                      { v: "VIAGEM", label: "Para levar" },
                      ...(deliveryEnabled ? [{ v: "ENTREGA", label: "Entrega" }] as const : []),
                    ] as const).map((opt) => {
                      const isActive = orderType === opt.v;
                      return (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => {
                            hasManuallySelectedOrderTypeRef.current = true;
                            setOrderType(opt.v);
                          }}
                          className={`flex-1 h-11 rounded-lg text-sm font-semibold ${
                            isActive ? "text-white shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)]"
                          }`}
                          style={isActive ? { backgroundColor: "var(--bg-inverse)" } : undefined}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {orderType === "ENTREGA" && (
                  <div className="space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3">
                    <p className="text-caption font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                      Endereço de entrega
                    </p>

                    {savedAddresses.length > 0 && (
                      <div className="space-y-1.5">
                        {savedAddresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2.5 text-xs ${
                              selectedAddressId === addr.id
                                ? "border-brand-red bg-[var(--status-danger-bg)]"
                                : "border-[var(--border)] bg-[var(--bg-surface)]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="saved-address"
                              className="mt-0.5 accent-brand-red"
                              checked={selectedAddressId === addr.id}
                              onChange={() => setSelectedAddressId(addr.id)}
                            />
                            <span className="text-[var(--text-primary)]">
                              {addr.label && <strong className="font-semibold">{addr.label}: </strong>}
                              {addr.street}{addr.number ? `, ${addr.number}` : ""} — {addr.neighborhood}
                            </span>
                          </label>
                        ))}
                        <label
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2.5 text-xs ${
                            selectedAddressId === null
                              ? "border-brand-red bg-[var(--status-danger-bg)]"
                              : "border-[var(--border)] bg-[var(--bg-surface)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="saved-address"
                            className="accent-brand-red"
                            checked={selectedAddressId === null}
                            onChange={() => setSelectedAddressId(null)}
                          />
                          <span className="text-[var(--text-primary)]">Usar um novo endereço</span>
                        </label>
                      </div>
                    )}

                    {/* Sempre visível, mesmo reaproveitando um endereço salvo — o pin marcado
                        agora vale pra este pedido independente de qual endereço for usado. */}
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={locationStatus === "loading"}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] outline-none transition-colors hover:border-brand-red hover:text-brand-red disabled:cursor-default disabled:opacity-70"
                      >
                        {locationStatus === "loading" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <LocateFixed size={14} className={locationStatus === "resolved" ? "text-emerald-600" : undefined} />
                        )}
                        {locationStatus === "resolved"
                          ? "Localização marcada — toque para remarcar"
                          : "Marcar minha localização atual (opcional)"}
                      </button>
                      {locationStatus === "error" && (
                        <p className="text-[11px] text-[var(--text-secondary)]">{locationError}</p>
                      )}
                    </div>

                    {selectedAddressId === null && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red"
                          placeholder="CEP *"
                          inputMode="numeric"
                          maxLength={9}
                          value={deliveryAddress.postal_code}
                          onChange={(e) => handleCepChange(e.target.value)}
                        />
                        {cepStatus === "loading" && (
                          <p className="col-span-2 text-xs text-[var(--text-secondary)]">Buscando endereço…</p>
                        )}
                        {cepStatus === "error" && (
                          <p className="col-span-2 text-xs font-semibold text-[var(--status-danger)]">
                            {cepError || "CEP não encontrado."}
                          </p>
                        )}
                        {cepStatus === "resolved" && (
                          <p className="col-span-2 text-xs text-[var(--text-secondary)]">
                            {deliveryAddress.street}, {deliveryAddress.neighborhood} — {deliveryAddress.city}/{deliveryAddress.state}
                          </p>
                        )}
                        <input
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red disabled:opacity-50"
                          placeholder="Número"
                          inputMode="numeric"
                          disabled={cepStatus !== "resolved"}
                          value={deliveryAddress.number}
                          onChange={(e) => setDeliveryAddress((p) => ({ ...p, number: e.target.value }))}
                        />
                        <input
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red disabled:opacity-50"
                          placeholder="Complemento"
                          disabled={cepStatus !== "resolved"}
                          value={deliveryAddress.complement}
                          onChange={(e) => setDeliveryAddress((p) => ({ ...p, complement: e.target.value }))}
                        />
                        <input
                          className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red disabled:opacity-50"
                          placeholder="Ponto de referência (opcional)"
                          disabled={cepStatus !== "resolved"}
                          value={deliveryAddress.reference}
                          onChange={(e) => setDeliveryAddress((p) => ({ ...p, reference: e.target.value }))}
                        />
                        {checkoutPhone && (
                          <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2.5 py-2 text-xs text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={saveThisAddress}
                              onChange={(e) => setSaveThisAddress(e.target.checked)}
                              className="h-4 w-4 accent-brand-red"
                            />
                            Salvar este endereço para próximos pedidos
                          </label>
                        )}
                      </div>
                    )}

                    {deliveryBlocked ? (
                      <div className="rounded-xl border p-3" style={{ borderColor: "var(--status-danger)", backgroundColor: "var(--status-danger-bg)" }}>
                        <p className="text-xs font-semibold text-[var(--status-danger)]">
                          Não realizamos entregas nesse bairro no momento.
                        </p>
                        <button
                          type="button"
                          onClick={() => setOrderType("VIAGEM")}
                          className="focus-ring mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-surface)] text-xs font-bold text-[var(--status-danger)] ring-1 ring-inset ring-[var(--status-danger)]/30 transition-colors hover:bg-[var(--status-danger-bg)]"
                        >
                          Retirar no balcão em vez disso
                        </button>
                      </div>
                    ) : effectiveNeighborhood.trim() ? (
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Taxa de entrega estimada: {currency.format(estimatedDeliveryFee)}
                      </p>
                    ) : null}
                  </div>
                )}

                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  placeholder="Alguma observação para a equipe?"
                  className="h-14 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
                />

                {/* Consentimentos compactos lado a lado no espaço disponível */}
                <div className="-my-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 py-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={rememberCheckoutData && !!checkoutPhone && !!customerName.trim()}
                      onChange={(event) => setRememberCheckoutData(event.target.checked)}
                      disabled={!checkoutPhone || !customerName.trim()}
                      className="h-4 w-4 accent-brand-red"
                    />
                    Salvar para próximos pedidos
                  </label>
                  {checkoutPhone && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 py-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(event) => setMarketingOptIn(event.target.checked)}
                      className="h-4 w-4 accent-brand-red"
                    />
                    Receber novidades pelo WhatsApp
                    </label>
                  )}
                </div>
            </>
          </section>

          {/* Barra fixa no rodapé — resumo + CTA sempre na zona do polegar,
             mesmo em formulários longos (endereço de entrega). */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 -mx-3 space-y-2 border-t border-[var(--border)] px-3 pt-3 sm:mx-0 sm:px-4"
            style={{ backgroundColor: "var(--bg-base)", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto max-w-2xl space-y-2">
              <div
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-white"
                style={{ backgroundColor: "var(--bg-inverse)" }}
              >
                <span className="text-sm text-white/75">
                  {items.length} {items.length === 1 ? "item" : "itens"}
                  {estimatedPackagingFee > 0 && <span className="text-white/50"> · com embalagem</span>}
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-caption text-white/60">Total</span>
                  <span className="text-base font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                    {currency.format(estimatedTotal)}
                  </span>
                </span>
              </div>

              {checkoutError && (
                <div className="rounded-2xl bg-[var(--status-danger-bg)] p-3 text-sm font-medium text-[var(--status-danger)]">
                  {checkoutError}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isSubmittingOrder}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
                style={{ height: 52 }}
              >
                {isSubmittingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" strokeWidth={1.75} />}
                Continuar para pagamento
              </button>
            </div>
          </div>
        </main>
      )}

      {step === "PAYMENT" && orderData && (
        <main className="mx-auto max-w-3xl space-y-4 p-4">
          {/* Progress indicator — step 3 (Pagamento) */}
          <ProgressSteps current={3} />

          {/* Selos de confiança — obrigatórios no topo */}
          <section
            className="flex flex-wrap items-center justify-around gap-2 rounded-xl px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: "var(--status-success-bg)",
              color: "var(--status-success)",
              border: "1px solid rgba(22, 163, 74, 0.18)",
            }}
          >
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> Pagamento seguro</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Dados protegidos</span>
            <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Cancelamento fácil</span>
          </section>

          {/* Resumo (sempre visível, compacto) */}
          <section className="rounded-2xl px-5 py-4 text-white shadow-[var(--shadow-sm)]" style={{ backgroundColor: "var(--bg-inverse)" }}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-caption font-medium text-white/60">Pedido</p>
                <h2 className="text-2xl font-bold leading-tight tabular-nums">#{String(orderData.daily_number).padStart(3, "0")}</h2>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>{currency.format(orderData.total_amount)}</p>
            </div>
          </section>

          {/* Cards de método — grandes, com ícone + label + descrição */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-muted)] px-1">Forma de pagamento</p>
            <button
              type="button"
              onClick={() => setPaymentMode("PIX")}
              className={`w-full flex items-center gap-3 rounded-xl p-4 text-left ${
                paymentMode === "PIX"
                  ? "border-2 border-brand-red bg-[var(--brand-light)]"
                  : "border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)]">
                <QrCode className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">PIX</p>
                <p className="text-xs text-[var(--text-secondary)]">Aprovação imediata</p>
              </div>
              {paymentMode === "PIX" && <CheckCircle2 className="h-5 w-5 text-brand-red shrink-0" strokeWidth={2} />}
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode("CARD")}
              className={`w-full flex items-center gap-3 rounded-xl p-4 text-left ${
                paymentMode === "CARD"
                  ? "border-2 border-brand-red bg-[var(--brand-light)]"
                  : "border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info)]">
                <CreditCard className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Cartão de crédito ou débito</p>
                <p className="text-xs text-[var(--text-secondary)]">Parcelamento disponível</p>
              </div>
              {paymentMode === "CARD" && <CheckCircle2 className="h-5 w-5 text-brand-red shrink-0" strokeWidth={2} />}
            </button>
          </section>

          <button
            type="button"
            onClick={handleBackToMenu}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar ao cardápio
          </button>

          {paymentMode === "PIX" ? (
            <PixCheckout
              order={orderData}
              payerEmail={customerEmail}
              onPayerEmailChange={(email) => {
                setCustomerEmail(email);
                savePublicOrderSession(orderData, email, branchSlug);
              }}
              onPaid={() => {
                clearCart();
                clearSavedPublicOrderSession();
                setStep("PAID");
              }}
            />
          ) : (
            <MercadoPagoBrick
              order={orderData}
              onResult={setPaymentResult}
              onPaid={() => {
                clearCart();
                clearSavedPublicOrderSession();
                setStep("PAID");
              }}
            />
          )}

          {paymentMode === "CARD" && paymentResult && <PixResult payment={paymentResult} />}
        </main>
      )}

      {step === "PAID" && (() => {
        const trackingUrl = orderData ? `${SITE_BASE}/pedido/${orderData.public_token}` : null;
        const orderNum = orderData ? String(orderData.daily_number).padStart(3, "0") : "---";
        const shareText = trackingUrl
          ? `Acompanhe meu pedido #${orderNum} no Marcos Krep's:\n${trackingUrl}`
          : null;
        const waText = shareText ? encodeURIComponent(shareText) : null;

        async function handleShareTracking() {
          if (!shareText || !trackingUrl) return;
          // Web Share API abre o menu nativo do celular (WhatsApp, SMS, etc.) —
          // fallback pro link direto do WhatsApp em navegadores sem suporte (desktop).
          if (typeof navigator !== "undefined" && navigator.share) {
            try {
              await navigator.share({ text: shareText, url: trackingUrl });
              return;
            } catch {
              // Cancelado pelo usuário ou falhou — cai no fallback abaixo.
            }
          }
          window.open(`https://wa.me/?text=${waText}`, "_blank", "noopener,noreferrer");
        }

        return (
          <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
            {/* Progress final — step 4 (Pronto) */}
            <ProgressSteps current={4} />

            {/* Ícone confirmação */}
            <div className="flex flex-col items-center text-center gap-3 mt-2">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: "var(--status-success)" }} />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full shadow-[var(--shadow-md)]" style={{ backgroundColor: "var(--status-success)" }}>
                  <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={1.75} />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold" style={{ color: "var(--status-success)" }}>Pedido confirmado</p>
                <h2 className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">#{orderNum}</h2>
              </div>
            </div>

            {/* Timeline de status */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">Status do pedido</p>
              <ol className="space-y-3">
                {(() => {
                  const stage = getOrderProgressStage(liveOrderStatus);
                  return (
                    <>
                      <TimelineStep done label="Pedido recebido" />
                      <TimelineStep done={stage > 1} active={stage === 1} label="Em preparo" />
                      <TimelineStep
                        done={stage > 2}
                        active={stage === 2}
                        label={orderType === "VIAGEM" ? "Pronto para retirada" : "Pronto para servir"}
                      />
                      <TimelineStep
                        done={stage === 3}
                        label={orderType === "VIAGEM" ? "Entregue" : "Servido"}
                        isLast
                      />
                    </>
                  );
                })()}
              </ol>
            </section>

            {/* Notificação WhatsApp */}
            <div className="rounded-xl px-3 py-2.5 text-sm" style={{ backgroundColor: "var(--status-success-bg)", color: "var(--status-success)" }}>
              Se voce informou WhatsApp, enviaremos uma mensagem quando seu pedido estiver pronto.
            </div>

            {/* Link de acompanhamento */}
            {trackingUrl && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1.5">Link de acompanhamento</p>
                <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-subtle)] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-secondary)]">{trackingUrl}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(trackingUrl)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    title="Copiar link"
                    aria-label="Copiar link de acompanhamento"
                  >
                    <ClipboardCopy className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="grid w-full gap-2">
              {trackingUrl && (
                <button
                  type="button"
                  onClick={() => router.push(`/pedido/${encodeURIComponent(orderData!.public_token)}?branch=${encodeURIComponent(branchSlug)}`)}
                  className="flex items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
                  style={{ height: 52 }}
                >
                  <Package className="h-5 w-5" strokeWidth={1.75} />
                  Acompanhar pedido em tempo real
                </button>
              )}
              {waText && (
                <button
                  type="button"
                  onClick={handleShareTracking}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366] bg-[#25D366]/10 text-sm font-semibold text-[#128C7E] hover:bg-[#25D366]/20 active:scale-[0.98]"
                  style={{ height: 48 }}
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.75} />
                  Compartilhar link do pedido
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscardPendingOrder}
                className="flex w-full items-center justify-center rounded-full border-2 border-brand-red bg-transparent text-sm font-semibold text-brand-red hover:bg-[var(--brand-light)] active:scale-[0.98]"
                style={{ height: 44 }}
              >
                Fazer novo pedido
              </button>
            </div>
          </main>
        );
      })()}

      {/* Sticky bottom cart agora vive dentro do MENU main (acima) — esse bloco
         duplicado foi removido durante o redesign. */}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <BottomSheet
        isOpen={!!selectedProduct}
        onClose={closeCustomization}
        title={editingCartItemId ? "Editar item" : "Personalizar item"}
        footer={selectedProduct && (
          <div
            className="px-5 py-3 border-t border-[var(--border)] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)]"
            style={{ backgroundColor: "var(--bg-surface)", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] p-1 h-12">
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm disabled:opacity-40"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Diminuir"
                >
                  <Minus className="h-4 w-4" strokeWidth={2} />
                </button>
                <span className="w-7 text-center text-base font-bold text-[var(--text-primary)] tabular-nums">{quantity}</span>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-white shadow-sm"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Aumentar"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-md)] hover:bg-brand-red-dark active:scale-[0.98]"
                style={{ height: 52 }}
              >
                <span>{editingCartItemId ? "Salvar" : "Adicionar"}</span>
                <span className="tabular-nums">· {currency.format(sheetSubtotal)}</span>
              </button>
            </div>
          </div>
        )}
      >
        {selectedProduct && (
          <div className="pb-4">
            {/* Hero — foto (ou gradiente com ícone da categoria) com tags e preço flutuando por cima */}
            {(() => {
              const categoryKind = getCategoryKind(selectedProductCategory?.name);
              const HeroIcon = categoryKind === "SAVORY" ? Flame
                : categoryKind === "SWEET" ? Sparkles
                : categoryKind === "DRINK" ? Package
                : Utensils;
              const tags = getProductTags(selectedProduct, selectedProductCategory?.name, menuIndexes).filter((t) => t !== "Outros");
              return (
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bg-inverse)]">
                  {selectedProduct.image_url ? (
                    <Image
                      src={selectedProduct.image_url}
                      alt=""
                      width={480}
                      height={360}
                      sizes="(max-width: 448px) 100vw, 448px"
                      className="h-full w-full object-cover"
                      priority
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: "linear-gradient(135deg, var(--bg-inverse), var(--brand-red-dark))" }}
                    >
                      <HeroIcon className="h-16 w-16 text-white/20" strokeWidth={1.25} />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
                  {tags.length > 0 && (
                    <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-micro font-bold uppercase tracking-wide text-brand-red shadow-sm backdrop-blur-sm"
                        >
                          {tag === "Vegetariano" ? <Leaf className="h-3 w-3" strokeWidth={2} /> : <Flame className="h-3 w-3" strokeWidth={2} />}
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="absolute bottom-3 left-4 right-4 text-lg font-bold leading-tight text-white drop-shadow-sm">
                    {splitProductName(selectedProduct.name).title}
                  </p>
                </div>
              );
            })()}

            <div className="px-5 pt-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {getProductSummary(selectedProduct, selectedProductCategory?.name, menuIndexes)}
                </p>
                <p className="shrink-0 rounded-xl bg-[var(--brand-light)] px-3 py-1.5 text-lg font-bold text-brand-red tabular-nums">
                  <span className="text-xs mr-0.5 font-semibold opacity-70">R$</span>
                  {selectedProduct.price.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>

            {/* Ingredientes — chips tocáveis, risca quando removido */}
            {productDefaultIngredients.length > 0 && (
              <section className="mt-6 space-y-2 px-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ingredientes</p>
                <div className="flex flex-wrap gap-2">
                  {productDefaultIngredients.map((ingredient) => {
                    const isIncluded = !removedIngredientIds.has(ingredient.id);
                    return (
                      <button
                        key={ingredient.id}
                        type="button"
                        onClick={() => {
                          setRemovedIngredientIds((current) => {
                            const next = new Set(current);
                            if (next.has(ingredient.id)) next.delete(ingredient.id);
                            else next.add(ingredient.id);
                            return next;
                          });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                          isIncluded
                            ? "border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]"
                            : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)] line-through"
                        }`}
                      >
                        {isIncluded && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        {ingredient.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Adicionais — card destacado, "Quer deixar ainda melhor?" */}
            {productAddons.length > 0 && (
              <section
                className="mx-5 mt-6 rounded-2xl border-2 border-dashed p-3"
                style={{ borderColor: "rgba(231, 51, 53, 0.25)", backgroundColor: "var(--brand-light)" }}
              >
                <button
                  type="button"
                  onClick={() => setAddonsExpanded((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-caption font-semibold text-brand-red">Adicionais</p>
                    <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">Quer deixar ainda melhor?</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {selectedAddonCount > 0
                        ? `${selectedAddonCount} ${selectedAddonCount === 1 ? "selecionado" : "selecionados"}`
                        : `${productAddons.length} opções para turbinar`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-red px-3 py-1.5 text-xs font-semibold text-white">
                    {addonsExpanded ? "Fechar" : "Ver"}
                  </span>
                </button>

                {addonsExpanded && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {productAddons.map((addon) => {
                      const qty = selectedAddons.get(addon.id) || 0;
                      const isSelected = qty > 0;
                      return (
                        <div
                          key={addon.id}
                          className={`rounded-xl border p-3 ${
                            isSelected ? "bg-[var(--status-success-bg)] border-[var(--status-success)]/30" : "bg-[var(--bg-surface)] border-[var(--border)]"
                          }`}
                        >
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{addon.name}</p>
                          <p className={`text-xs font-semibold tabular-nums ${isSelected ? "text-[var(--status-success)]" : "text-brand-red"}`}>
                            +{currency.format(addon.price)}
                          </p>
                          <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--bg-subtle)] p-1">
                            <button
                              type="button"
                              className="focus-ring relative rounded-md bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] disabled:opacity-40 after:absolute after:inset-[-6px] after:content-['']"
                              disabled={qty === 0}
                              aria-label={`Diminuir ${addon.name}`}
                              onClick={() => {
                                setSelectedAddons((current) => {
                                  const next = new Map(current);
                                  const nextQty = Math.max(0, qty - 1);
                                  if (nextQty === 0) next.delete(addon.id);
                                  else next.set(addon.id, nextQty);
                                  return next;
                                });
                              }}
                            >
                              <Minus className="h-4 w-4" strokeWidth={2} />
                            </button>
                            <span className="font-semibold text-sm text-[var(--text-primary)] tabular-nums">{qty}</span>
                            <button
                              type="button"
                              className="focus-ring relative rounded-md bg-[var(--bg-surface)] p-1.5 text-brand-red after:absolute after:inset-[-6px] after:content-['']"
                              aria-label={`Aumentar ${addon.name}`}
                              onClick={() => {
                                setSelectedAddons((current) => {
                                  const next = new Map(current);
                                  next.set(addon.id, qty + 1);
                                  return next;
                                });
                              }}
                            >
                              <Plus className="h-4 w-4" strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Observação */}
            <section className="mt-6 px-5">
              <FloatingInput
                label="Observação"
                value={itemNotes}
                onChange={setItemNotes}
                placeholder="Ex: sem sal, bem passado..."
              />
            </section>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
