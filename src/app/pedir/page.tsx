"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Leaf,
  Loader2,
  LocateFixed,
  Minus,
  Package,
  PackageX,
  Pencil,
  Plus,
  QrCode,
  Search,
  Share2,
  ShoppingCart,
  Tag,
  Trash2,
  Utensils,
  ClipboardCopy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { ProductImage } from "@/components/menu/ProductImage";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { pdvApi, CreatePublicOrderPayload, CreatePublicOrderResponse, MercadoPagoPaymentResponse, OrderingClosedError } from "@/lib/api/pdv-api";
import { Addon, CustomerAddress, DeliveryZone, Ingredient, OrderStatus, Product } from "@/types/pdv";
import { CartItem, useCart } from "@/features/cart/useCart";
import {
  isOrderTypeAvailableForBranch,
  normalizeNeighborhood,
  resolveAvailableOrderType,
} from "@/lib/utils/delivery";
import { AcompanharPedido } from "./_components/AcompanharPedido";
import { MercadoPagoBrick } from "./_components/MercadoPagoBrick";
import { PixCheckout } from "./_components/PixCheckout";
import { ProgressSteps } from "./_components/ProgressSteps";
import { CheckoutSummary } from "./_components/CheckoutSummary";
import { FloatingInput } from "./_components/FloatingInput";
import {
  countProductInCart,
  findPlainCartItem,
  getCartItemTotal,
  getFallbackArt,
  getFirstName,
  getProductsRequiringChoice,
} from "@/lib/menu/public-menu-ui";
import { TimelineStep } from "./_components/TimelineStep";
import { PAYMENT_METHOD_CODE, isValidEmail } from "./_components/payment-helpers";
import { formatCep, onlyCepDigits, isValidCepFormat } from "@/lib/utils/cep";
// Cópias locais destas duas viviam neste arquivo e ficaram pra trás quando a
// versão compartilhada foi corrigida: elas cortavam o "55" inicial de qualquer
// número, então um celular com DDD 55 (RS) era rejeitado como inválido e o
// cliente não conseguia informar o WhatsApp — nem pedir entrega, que exige.
import { formatWhatsAppInput, normalizeBrazilPhone } from "@/lib/utils/phone";
import {
  describeCustomerPhone,
  resolveNameAfterPhoneChange,
  resolveNameFromInput,
  resolveNameFromLookup,
  validateCustomerIdentity,
  wasPhoneErased,
  type CustomerNameSource,
} from "@/lib/utils/customer-identity";
import { getCurrentPosition } from "@/lib/utils/geolocation";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { rememberLastBranchSlug } from "@/lib/utils/lastBranch";
import { BRANCHES_PAGE_PATH, DEFAULT_BRANCH_SLUG } from "@/lib/constants/branches";
import {
  ALL_FILTER,
  buildMenuIndexes,
  getProductSummary,
  getProductTags,
  resolveInitialCategoryId,
  splitProductName,
} from "@/lib/menu/productTags";

import { resolvePublicOrderAttempt, clearPublicOrderAttempt, publicOrderAttemptPayload } from "@/lib/checkout/public-order-attempt";
import { orderFailureCategory, usePublicFunnel } from "@/lib/analytics/use-public-funnel";
import { DELIVERY_PAYMENT_LABELS, isDeliveryPaymentMethod, type DeliveryPaymentMethod } from "@/lib/checkout/delivery-payment";

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

  // Sem slug → abre direto na filial principal (Núcleo Bandeirante).
  // O QR Code divulgado aponta pra /pedir "seco"; mandar o cliente pra um
  // picker antes do cardápio custava um toque a mais e confundia. A lista
  // de filiais continua disponível em /pedir/filiais.
  return <PedirBranchPage branchSlug={branchSlug ?? DEFAULT_BRANCH_SLUG} />;
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
  /** Slug da URL não corresponde a nenhuma filial — ver o guard em loadMenu. */
  const [branchNotFound, setBranchNotFound] = useState(false);
  /** A config desta filial já respondeu (ver `isOrderTypeAvailable`). */
  const [branchConfigLoaded, setBranchConfigLoaded] = useState(false);
  const [onlineOrderingEnabled, setOnlineOrderingEnabled] = useState(true);
  const [orderingClosedReason, setOrderingClosedReason] = useState("");
  const [packagingFee, setPackagingFee] = useState(0);
  const [applyPackagingFeeForTakeout, setApplyPackagingFeeForTakeout] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(0);
  const [branchAddress, setBranchAddress] = useState<string | null>(null);
  const [codEnabled, setCodEnabled] = useState(false);
  const [codMethods, setCodMethods] = useState<DeliveryPaymentMethod[]>([]);
  const [paymentTiming, setPaymentTiming] = useState<"ONLINE" | "ON_DELIVERY">("ONLINE");
  const [expectedMethod, setExpectedMethod] = useState<DeliveryPaymentMethod | "">("");
  const [cashChangeFor, setCashChangeFor] = useState("");
  const useCod = paymentTiming === "ON_DELIVERY" && orderType === "ENTREGA" && codEnabled;
  const orderRequestSignatureRef = useRef<string | null>(null);

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressForm>(EMPTY_DELIVERY_ADDRESS);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "resolved" | "error">("idle");
  const [cepError, setCepError] = useState("");
  const cepRequestIdRef = useRef(0);
  // Chave de idempotência do checkout: mantida entre tentativas do MESMO carrinho
  // para que um retry (erro de rede, duplo toque, "voltar") devolva o pedido já
  // criado em vez de gerar um gêmeo. Zerada quando o pedido sai ou o carrinho muda.
  const orderIdempotencyKeyRef = useRef<string | null>(null);
  // Assinatura do carrinho: mexeu no que vai ser comprado, a tentativa anterior
  // deixou de valer — senão um retry depois de editar o carrinho devolveria o
  // pedido antigo, com os itens errados.
  const cartSignature = useMemo(
    () => items.map((item) => [
      item.product.id,
      item.quantity,
      item.is_takeout ? "v" : "",
      (item.removed_ingredients ?? []).join(","),
      (item.addons ?? []).map((addon) => `${addon.addon_id}x${addon.quantity}`).join(","),
      item.notes ?? "",
    ].join(":")).join("|"),
    [items],
  );
  useEffect(() => {
    orderIdempotencyKeyRef.current = null;
  }, [cartSignature]);
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
  // clearCart() zera nome e WhatsApp ao aprovar o pagamento; a confirmação
  // guarda só o primeiro nome e o número para agradecer e dizer onde avisamos.
  const [paidCustomer, setPaidCustomer] = useState<{ firstName: string; phone: string } | null>(null);
  const [isEditingOrderType, setIsEditingOrderType] = useState(false);
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [step, setStep] = useState<"MENU" | "REVIEW" | "INFO" | "PAYMENT" | "PAID">("MENU");
  // Lido dentro do polling de revalidação de horário (interval, closure velha) — sem
  // isso o polling não sabe que o usuário já avançou pro pagamento e pode derrubar
  // o checkout no meio do preenchimento do cartão.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [rememberCheckoutData, setRememberCheckoutData] = useState(false);
  const [profileLookupState, setProfileLookupState] = useState<"idle" | "checking" | "found" | "not_found">("idle");
  const [profileNotice, setProfileNotice] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const submitLockRef = useRef(false);
  const { consent: analyticsConsent, setConsent: setAnalyticsConsent, track: trackFunnel, context: analyticsContext } = usePublicFunnel(branchSlug, orderType, !!branchId && branchConfigLoaded);
  const lastFunnelStepRef = useRef("");
  useEffect(() => {
    if (step === "MENU") trackFunnel("menu_view", {}, "menu");
    const key = `${branchSlug}:${step}:${analyticsConsent}`;
    if (lastFunnelStepRef.current === key) return;
    lastFunnelStepRef.current = key;
    if (step === "REVIEW") trackFunnel("cart_view");
    if (step === "INFO") trackFunnel("checkout_start");
  }, [step, branchSlug, analyticsConsent, trackFunnel]);
  const [orderData, setOrderData] = useState<CreatePublicOrderResponse["order"] | null>(null);
  const [paymentMode, setPaymentMode] = useState<"PIX" | "CARD">("PIX");
  const [checkoutError, setCheckoutError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    description?: string | null;
    discount_type: "PERCENT" | "AMOUNT" | "FREE_DELIVERY";
    discount_value: number;
    discount_amount: number;
    cart_signature: string;
  } | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const lastAutofilledPhoneRef = useRef<string | null>(null);
  // Depois que a pessoa escolhe a modalidade na mão, o autofill de perfil
  // salvo (local ou do servidor) nunca mais pode sobrescrever essa escolha —
  // sem isso, digitar o telefone DEPOIS de escolher "Entrega" silenciosamente
  // trocava de volta pro último tipo de pedido salvo (ex: "Para levar").
  const hasManuallySelectedOrderTypeRef = useRef(false);
  /** Regras em `@/lib/utils/delivery` (com teste). Lido via ref pra não entrar
   * nas deps do efeito de perfil: mudar as deps dispararia de novo o lookup
   * debounced no servidor toda vez que a config da filial carregasse. */
  const branchDeliveryState = useMemo(
    () => ({ branchConfigLoaded, deliveryEnabled }),
    [branchConfigLoaded, deliveryEnabled],
  );
  const branchDeliveryStateRef = useRef(branchDeliveryState);
  useEffect(() => { branchDeliveryStateRef.current = branchDeliveryState; }, [branchDeliveryState]);

  // Corrige a modalidade assim que a config da filial confirma que ela não
  // entrega — o `orderType` vem do localStorage e pode ser de outra unidade.
  useEffect(() => {
    const available = resolveAvailableOrderType(orderType, branchDeliveryState);
    if (available !== orderType) setOrderType(available);
  }, [branchDeliveryState, orderType, setOrderType]);

  // Latest customerName captured for use inside the debounced profile lookup;
  // keeps the autofill effect from re-running on every keystroke in the name field.
  const customerNameRef = useRef(customerName);
  useEffect(() => {
    customerNameRef.current = customerName;
  }, [customerName]);

  // Origem do nome no campo: o que a pessoa digita (MANUAL) sobrevive a apagar
  // ou corrigir o WhatsApp; só o nome vindo de consulta (LOOKUP) é descartado.
  const [nameSuggestion, setNameSuggestion] = useState<string | null>(null);
  const nameSourceRef = useRef<CustomerNameSource>("NONE");
  /** Dígitos do WhatsApp na passada anterior — só apaga o que a consulta
   * preencheu quando havia número escrito e ele foi apagado de fato. */
  const previousPhoneDigitsRef = useRef("");
  const applyResolvedName = useCallback((
    resolved: { name: string; source: CustomerNameSource; suggestion: string | null },
    phone: string,
  ) => {
    setCustomerInfo(resolved.name, phone);
    nameSourceRef.current = resolved.source;
    setNameSuggestion(resolved.suggestion);
  }, [setCustomerInfo]);

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
    async function loadMenu() {
      try {
        setLoading(true);
        setBranchConfigLoaded(false);
        const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
        if (!config.success) throw new Error(config.error || "Não conseguimos abrir esta unidade agora. Tente de novo em instantes.");

        // Slug que não existe (QR antigo, link com typo): a config volta global,
        // e `getMenuData(null)` não filtraria por filial — o cliente veria o
        // catálogo de todas as unidades misturado e só descobriria o problema no
        // create-public-order, com o pedido inteiro montado. Para aqui.
        if (config.branch_not_found || !config.branch?.id) {
          setBranchNotFound(true);
          return;
        }
        setBranchNotFound(false);
        // Só depois de confirmar que a filial existe — senão um slug inválido
        // viraria o fallback de "fazer novo pedido" em /pedido/[token].
        rememberLastBranchSlug(branchSlug);
        const resolvedBranchId = config.branch.id;
        setBranchName(config.branch.name ?? null);
        setBranchId(resolvedBranchId);
        setBranchAddress(config.branch.address ?? null);
        setCodEnabled(config.branch.cod_enabled === true && config.branch.delivery_enabled === true);
        setCodMethods((config.branch.cod_methods ?? []).filter(isDeliveryPaymentMethod));
        setDeliveryEnabled(config.branch.delivery_enabled === true);
        setDefaultDeliveryFee(Number(config.branch.default_delivery_fee ?? 0));
        setBranchConfigLoaded(true);
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

        const data = await menuApi.getMenuData(resolvedBranchId);
        setMenuData(data);
        setSelectedCategoryId(resolveInitialCategoryId(data.categories, data.products));
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

  useEffect(() => {
    const normalizedPhone = normalizeBrazilPhone(customerPhone);
    const phoneWasErased = wasPhoneErased(previousPhoneDigitsRef.current, customerPhone);
    previousPhoneDigitsRef.current = customerPhone;

    if (!normalizedPhone) {
      const timer = window.setTimeout(() => {
        if (lastAutofilledPhoneRef.current && phoneWasErased) {
          lastAutofilledPhoneRef.current = null;
          applyResolvedName(
            resolveNameAfterPhoneChange({
              currentName: customerNameRef.current,
              nameSource: nameSourceRef.current,
            }),
            formatWhatsAppInput(customerPhone),
          );
          setCustomerEmail("");
          setMarketingOptIn(false);
          setRememberCheckoutData(false);
          setSavedAddresses([]);
          setSelectedAddressId(null);
        }
        setProfileLookupState("idle");
        if (!customerPhone.trim()) setProfileNotice("");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    // Opt-out por padrão: com telefone válido informado, já vem marcado para
    // salvar (decisão de negócio 2026-08-20 — ataca a causa raiz de baixa
    // captura de telefone). O cliente pode desmarcar no toggle abaixo.
    const optOutTimer = window.setTimeout(() => setRememberCheckoutData(true), 0);

    const saved = readSavedPublicProfile();
    if (saved?.phone_e164 === normalizedPhone) {
      const timer = window.setTimeout(() => {
        applyResolvedName(
          resolveNameFromLookup({
            currentName: customerNameRef.current,
            nameSource: nameSourceRef.current,
            profileName: saved.name,
            completePartial: true,
          }),
          formatWhatsAppInput(saved.phone_e164),
        );
        setCustomerEmail(saved.email ?? "");
        setMarketingOptIn(saved.marketing_opt_in);
        setRememberCheckoutData(true);
        // Mesmo filtro que o lookup do servidor já aplica: só reaproveita a
        // modalidade se ela existir nesta filial. ENTREGA vinda de outra
        // unidade abriria um formulário de endereço que o servidor recusa.
        if (
          !hasManuallySelectedOrderTypeRef.current &&
          isOrderTypeAvailableForBranch(saved.order_type, branchDeliveryStateRef.current)
        ) {
          setOrderType(saved.order_type);
        }
        lastAutofilledPhoneRef.current = saved.phone_e164;
        setProfileLookupState("found");
        setProfileNotice("Encontramos seus dados salvos neste aparelho.");
      }, 0);
      return () => {
        window.clearTimeout(optOutTimer);
        window.clearTimeout(timer);
      };
    }

    if (lastAutofilledPhoneRef.current && lastAutofilledPhoneRef.current !== normalizedPhone) {
      lastAutofilledPhoneRef.current = null;
      applyResolvedName(
        resolveNameAfterPhoneChange({
          currentName: customerNameRef.current,
          nameSource: nameSourceRef.current,
        }),
        formatWhatsAppInput(normalizedPhone),
      );
      setCustomerEmail("");
      setMarketingOptIn(false);
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
          applyResolvedName(
            resolveNameFromLookup({
              currentName: customerNameRef.current,
              nameSource: nameSourceRef.current,
              profileName: response.profile.name,
              completePartial: true,
            }),
            formatWhatsAppInput(normalizedPhone),
          );
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
          setProfileNotice("Encontramos seus dados pelo WhatsApp.");
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
      window.clearTimeout(optOutTimer);
      window.clearTimeout(timer);
    };
  }, [applyResolvedName, customerPhone, setOrderType]);

  useEffect(() => {
    const recheck = async () => {
      // Não revalida (nem limpa carrinho/derruba a tela) com o cliente em
      // PAGAMENTO/PAGO: isso forçava um re-render do componente inteiro a
      // cada 60s, o que remontava o widget de cartão do Mercado Pago e
      // apagava os dados já digitados. Ver MercadoPagoBrick.
      if (stepRef.current === "PAYMENT" || stepRef.current === "PAID") return;
      try {
        const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
        if (!config.success) throw new Error(config.error || "Não conseguimos confirmar o horário de atendimento.");
        const settings = config.settings;
        const start = settings.public_ordering_start_time ?? DEFAULT_ORDERING_START;
        const end = settings.public_ordering_end_time ?? DEFAULT_ORDERING_END;
        const isEnabled = config.online_ordering_enabled;

        setOrderingSchedule({ start, end });
        setOnlineOrderingEnabled(isEnabled);
        setOrderingClosedReason(config.ordering_closed_reason);

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

  /** Categorias que realmente viram section no cardápio. Tabs e sections usam
   * esta mesma lista: antes as tabs vinham de `categories` inteiro enquanto as
   * sections pulavam as vazias, então tocar numa aba de categoria sem produto
   * não fazia nada (não existia âncora pra rolar até). */
  const visibleCategories = useMemo(
    () => (menuData?.categories ?? []).filter((c) => (productsByCategory[c.id]?.length ?? 0) > 0),
    [menuData, productsByCategory],
  );

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
  const couponIsCurrent = appliedCoupon?.cart_signature === cartSignature
    && (appliedCoupon?.discount_type !== "FREE_DELIVERY" || orderType === "ENTREGA");
  const estimatedCouponDiscount = couponIsCurrent ? (appliedCoupon?.discount_amount ?? 0) : 0;
  const freeDeliveryCoupon = couponIsCurrent && appliedCoupon?.discount_type === "FREE_DELIVERY" && orderType === "ENTREGA";
  const estimatedTotal = Math.max(
    0,
    estimatedSubtotal + estimatedPackagingFee + (freeDeliveryCoupon ? 0 : estimatedDeliveryFee) - estimatedCouponDiscount,
  );
  const deliveryFeeKnown = orderType !== "ENTREGA" || (
    (!!selectedSavedAddress || cepStatus === "resolved") && !!effectiveNeighborhood.trim() && !deliveryBlocked
  );
  const checkoutPreviewTotal = deliveryFeeKnown ? estimatedTotal : Math.max(0, estimatedSubtotal + estimatedPackagingFee - estimatedCouponDiscount);
  const checkoutSummary = (
    <CheckoutSummary
      orderType={orderType}
      subtotal={estimatedSubtotal}
      packagingFee={estimatedPackagingFee}
      deliveryFee={estimatedDeliveryFee}
      deliveryFeeKnown={deliveryFeeKnown}
      deliveryBlocked={deliveryBlocked}
      couponCode={couponIsCurrent ? appliedCoupon?.code : undefined}
      couponDiscount={estimatedCouponDiscount}
      freeDelivery={freeDeliveryCoupon}
      total={checkoutPreviewTotal}
    />
  );
  const checkoutPhone = useMemo(() => normalizeBrazilPhone(customerPhone), [customerPhone]);
  /** Aviso de número pela metade — some assim que o WhatsApp fica válido. */
  const customerPhoneWarning = useMemo(() => describeCustomerPhone(customerPhone).message, [customerPhone]);
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
    trackFunnel("product_view", { product_id: product.id });
    if (branchDraftMismatch) {
      addToast("error", "Você tem uma sacola aberta em outra unidade. Finalize ou comece uma nova para continuar.");
      return;
    }
    setSelectedProduct(product);
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
  }, [addToast, branchDraftMismatch, trackFunnel]);

  // Histórico do navegador: enquanto o modal de personalização está aberto,
  // o botão Voltar fecha o modal em vez de sair da página — pusha uma
  // entrada extra no histórico ao abrir e a consome no popstate.
  // history.back() é assíncrono. Se a próxima tela fizer pushState antes de ele
  // terminar (fechar a folha e tocar logo em "Ver sacola"), o back desfaz a
  // entrada nova e o checkout volta sozinho ao cardápio. Enquanto houver um back
  // pendente, nenhum pushState acontece; o popstate libera e o efeito refaz.
  const pendingHistoryBackRef = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const historyBack = useCallback(() => {
    pendingHistoryBackRef.current += 1;
    window.history.back();
  }, []);
  useEffect(() => {
    const onPopState = () => {
      if (pendingHistoryBackRef.current > 0) {
        pendingHistoryBackRef.current -= 1;
        setHistoryTick((tick) => tick + 1);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Histórico do navegador: sair do cardápio (REVIEW/INFO/PAYMENT/PAID) pusha
  // UMA entrada (não uma por passo — trocar de passo dentro do checkout não
  // pusha de novo, só a entrada e saída do fluxo). O botão Voltar do
  // navegador fecha o checkout inteiro e volta pro cardápio em vez de sair
  // de /pedir — e sair pelo botão "Cardápio"/"Voltar ao cardápio" da própria
  // UI consome essa entrada (history.back()), então também não sobra uma
  // entrada "fantasma" exigindo um Voltar extra depois.
  // Declarado antes do efeito do modal: com um back pendente liberado, os dois
  // efeitos rodam no mesmo commit e a entrada do checkout precisa vir primeiro
  // na pilha, senão fechar a folha desfaz a entrada do checkout.
  const wizardHistoryPushedRef = useRef(false);
  useEffect(() => {
    if (pendingHistoryBackRef.current > 0) return;
    if (step !== "MENU" && !wizardHistoryPushedRef.current) {
      window.history.pushState({ pedirWizard: true }, "");
      wizardHistoryPushedRef.current = true;
    } else if (step === "MENU" && wizardHistoryPushedRef.current) {
      wizardHistoryPushedRef.current = false;
      historyBack();
    }
  }, [step, historyTick, historyBack]);

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

  const modalHistoryPushedRef = useRef(false);
  useEffect(() => {
    if (selectedProduct && !modalHistoryPushedRef.current && pendingHistoryBackRef.current === 0) {
      window.history.pushState({ pedirModal: true }, "");
      modalHistoryPushedRef.current = true;
    }
  }, [selectedProduct, historyTick]);

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
      historyBack();
    } else {
      setSelectedProduct(null);
      setEditingCartItemId(null);
    }
  }, [historyBack]);

  const productsRequiringChoice = useMemo(
    () => getProductsRequiringChoice(menuData?.productAddons ?? []),
    [menuData],
  );

  /** "+" do cardápio (#235): adiciona direto; com adicional obrigatório abre a folha. */
  const handleQuickAdd = useCallback((product: Product) => {
    if (branchDraftMismatch) {
      addToast("error", "Você tem uma sacola aberta em outra unidade. Finalize ou comece uma nova para continuar.");
      return;
    }
    if (productsRequiringChoice.has(product.id)) {
      openCustomization(product);
      return;
    }
    trackFunnel("add_to_cart", { product_id: product.id });
    const plain = findPlainCartItem(items, product.id);
    if (plain) updateItem(plain.id, { quantity: plain.quantity + 1 });
    else addItem({ product, quantity: 1, removed_ingredients: [], addons: [], is_takeout: orderType === "VIAGEM" });
    addToast("success", `${splitProductName(product.name).title} adicionado à sacola`);
  }, [addItem, addToast, branchDraftMismatch, items, openCustomization, orderType, productsRequiringChoice, trackFunnel, updateItem]);

  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return;
    if (!editingCartItemId) trackFunnel("add_to_cart", { product_id: selectedProduct.id });
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
      : `${splitProductName(selectedProduct.name).title} adicionado à sacola`);
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
    trackFunnel,
  ]);

  /** "Não é você?" — descarta o autofill e limpa o perfil salvo neste dispositivo. */
  const handleForgetSavedProfile = useCallback(() => {
    localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
    lastAutofilledPhoneRef.current = null;
    applyResolvedName({ name: "", source: "NONE", suggestion: null }, customerPhone);
    setCustomerEmail("");
    setMarketingOptIn(false);
    setRememberCheckoutData(false);
    setSavedAddresses([]);
    setSelectedAddressId(null);
    setProfileNotice("");
    setProfileLookupState("not_found");
    addToast("success", "Pronto! Apagamos os dados salvos neste aparelho.");
  }, [addToast, applyResolvedName, customerPhone]);

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
      trackFunnel("delivery_check", { error_category: result.success && result.address ? "NONE" : "ADDRESS" });
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
  }, [trackFunnel]);

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
    clearSavedPublicOrderSession();
    setStep("MENU");
  }, []);

  /** true quando existe um pedido criado mas ainda não pago — é o único caso
   * em que faz sentido oferecer "continuar pagamento" em vez de só permitir
   * seguir criando um pedido novo. Uma vez pago, o polling em outro efeito já
   * limpa orderData/cart e leva pra tela PAID sozinho. */
  const orderAwaitingPayment = !!orderData && orderData.payment_status !== "PAID";

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon(null);
      setCouponMessage("Digite o código do cupom.");
      return;
    }

    // O cupom é informado na revisão, antes de o cliente escolher a modalidade
    // na próxima etapa. Para FERIADOU, valide como entrega e só altere a
    // modalidade se o servidor confirmar que a promoção está válida.
    const wantsFeriadouDelivery = code === "FERIADOU" && orderType !== "ENTREGA";
    if (wantsFeriadouDelivery && (!branchConfigLoaded || !deliveryEnabled)) {
      setAppliedCoupon(null);
      setCouponMessage("O FERIADOU vale só para entrega, que não está disponível nesta unidade.");
      return;
    }
    const couponOrderType = wantsFeriadouDelivery ? "ENTREGA" : orderType;

    setCouponLoading(true);
    setCouponMessage("");
    try {
      const result = await pdvApi.validateCoupon({
        coupon_code: code,
        branch_slug: branchSlug,
        subtotal: estimatedSubtotal,
        order_type: couponOrderType,
      });

      if (!result.valid || !result.coupon) {
        setAppliedCoupon(null);
        setCouponMessage(result.error || "Esse cupom não é válido. Confira o código.");
        return;
      }

      if (wantsFeriadouDelivery) {
        hasManuallySelectedOrderTypeRef.current = true;
        setOrderType("ENTREGA");
      }
      setCouponInput(result.coupon.code);
      setAppliedCoupon({ ...result.coupon, cart_signature: cartSignature });
      setCouponMessage(wantsFeriadouDelivery
        ? "Frete grátis aplicado! Mudamos para entrega: informe o endereço na próxima etapa."
        : "Cupom aplicado!");
    } catch (error) {
      setAppliedCoupon(null);
      setCouponMessage(getFriendlyErrorMessage(error, "Não conseguimos validar o cupom agora. Tente de novo."));
    } finally {
      setCouponLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmittingOrder(true);
    try {
    setCheckoutError("");

    // Revalida o horario no momento exato do clique para garantir que o cliente
    // nao consiga submeter um pedido quando o atendimento ja encerrou ou foi pausado.
    // Precisa passar a filial: sem ela a resposta é a config GLOBAL, então uma
    // filial pausada (ou fora do horário dela) passava por aqui e só era barrada
    // pelo servidor — e o catch de OrderingClosedError apaga o carrinho.
    try {
      const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
      if (!config.success) throw new Error(config.error || "Não conseguimos confirmar o horário de atendimento.");
      const settings = config.settings;
      const start = settings.public_ordering_start_time ?? DEFAULT_ORDERING_START;
      const end = settings.public_ordering_end_time ?? DEFAULT_ORDERING_END;

      setOrderingSchedule({ start, end });
      setOnlineOrderingEnabled(config.online_ordering_enabled);
      setOrderingClosedReason(config.ordering_closed_reason);

      if (!config.online_ordering_enabled) {
        const reason = config.ordering_closed_reason || "No momento não estamos recebendo pedidos.";
        setCheckoutError(reason);
        return;
      }
    } catch (err) {
      setCheckoutError(getFriendlyErrorMessage(err, "Não foi possível validar o horário de atendimento."));
      return;
    }
    if (items.length === 0) {
      setCheckoutError("Sua sacola está vazia.");
      return;
    }
    const normalizedPhone = normalizeBrazilPhone(customerPhone);
    // Mesma régua do checkout do atendente: número pela metade avisa o que
    // falta, e a entrega é a única modalidade que exige contato.
    const identityError = validateCustomerIdentity(customerPhone, {
      requirePhone: orderType === "ENTREGA",
      requiredMessage: "Para entrega, informe um WhatsApp com DDD para falarmos com você.",
    });
    if (identityError) {
      setCheckoutError(identityError);
      return;
    }
    if (customerEmail.trim() && !isValidEmail(customerEmail)) {
      setCheckoutError("Confira o e-mail informado. Ele parece incompleto.");
      return;
    }
    if (orderType === "ENTREGA") {
      if (!selectedSavedAddress) {
        if (!isValidCepFormat(deliveryAddress.postal_code)) {
          setCheckoutError("Informe um CEP válido para a entrega.");
          return;
        }
        if (cepStatus !== "resolved") {
          setCheckoutError(cepStatus === "error" ? (cepError || "CEP não encontrado.") : "Só um instante: ainda estamos conferindo o CEP.");
          return;
        }
        if (!deliveryAddress.street.trim() || !deliveryAddress.neighborhood.trim()) {
          setCheckoutError("Informe ao menos rua e bairro para a entrega.");
          return;
        }
      }
      if (deliveryBlocked) {
        setCheckoutError("Ainda não entregamos nesse bairro.");
        return;
      }
    }

    const changeValue = useCod && expectedMethod === "CASH" && cashChangeFor.trim()
      ? Number(cashChangeFor.replace(",", ".")) : undefined;
    if (useCod && (!isDeliveryPaymentMethod(expectedMethod) || !codMethods.includes(expectedMethod))) {
      setCheckoutError("Escolha como vai pagar na entrega."); return;
    }
    if (changeValue !== undefined && (!Number.isFinite(changeValue) || changeValue < estimatedTotal)) {
      setCheckoutError("O troco precisa ser para um valor igual ou maior que o total."); return;
    }

    setIsSubmittingOrder(true);
    try {
      const publicOrderType: "BALCAO" | "VIAGEM" | "ENTREGA" = orderType;
      const payload: CreatePublicOrderPayload = {
        analytics_consent: analyticsConsent,
        analytics_context: analyticsConsent ? analyticsContext() : undefined,
        payment_timing: useCod ? "ON_DELIVERY" : "ONLINE",
        expected_payment_method: useCod && isDeliveryPaymentMethod(expectedMethod) ? expectedMethod : undefined,
        cash_change_for: changeValue,
        order_type: publicOrderType,
        customer_name: customerName.trim() || undefined,
        customer_phone: normalizedPhone ?? undefined,
        customer_email: customerEmail.trim() || undefined,
        marketing_opt_in: !!normalizedPhone && marketingOptIn,
        remember_checkout_data: !!normalizedPhone && !!customerName.trim() && rememberCheckoutData,
        notes: orderNotes.trim() || undefined,
        payment_method_code: PAYMENT_METHOD_CODE,
        branch_slug: branchSlug,
        coupon_code: couponIsCurrent ? appliedCoupon?.code : undefined,
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
      };
      const signature = JSON.stringify(publicOrderAttemptPayload(payload));
      if (!orderIdempotencyKeyRef.current || orderRequestSignatureRef.current !== signature) {
        orderIdempotencyKeyRef.current = await resolvePublicOrderAttempt(sessionStorage, branchSlug, payload);
        orderRequestSignatureRef.current = signature;
      }
      if (canExpressCheckout) trackFunnel("checkout_start", {}, orderIdempotencyKeyRef.current);
      trackFunnel("order_submit", {}, orderIdempotencyKeyRef.current);
      const response = await pdvApi.createPublicOrder(payload, orderIdempotencyKeyRef.current);

      clearPublicOrderAttempt(sessionStorage, branchSlug);
      if (["EXPIRADO", "CANCELADO"].includes(response.order.status)) {
        orderIdempotencyKeyRef.current = null;
        setCheckoutError("O envio anterior não foi concluído. Confira os dados e envie de novo.");
        return;
      }
      // Pedido saiu: a próxima compra é outro pedido, logo outra chave.
      orderIdempotencyKeyRef.current = null;
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
      if (response.order.payment_timing === "ON_DELIVERY") {
        clearCart(); clearSavedPublicOrderSession();
        router.push(`/pedido/${encodeURIComponent(response.order.public_token)}`);
        return;
      }
      savePublicOrderSession(response.order, customerEmail, branchSlug);
      setPaymentMode("PIX");
      setStep("PAYMENT");
    } catch (err) {
      trackFunnel("order_failure", { error_category: orderFailureCategory(err, err instanceof OrderingClosedError) });
      if (err instanceof OrderingClosedError) {
        setOnlineOrderingEnabled(false);
        setOrderingClosedReason(err.message);
      } else {
        setCheckoutError(getFriendlyErrorMessage(err, "Não conseguimos enviar seu pedido. Tente de novo em instantes."));
      }
    } finally {
      setIsSubmittingOrder(false);
    }
    } finally { submitLockRef.current = false; setIsSubmittingOrder(false); }
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

  // Antes de `error` porque não é falha nossa nem do cliente: o link é que
  // aponta pra uma unidade que não existe. A saída útil é a lista de filiais.
  if (branchNotFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ backgroundColor: "var(--bg-base)" }}>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--status-warning-bg)", color: "var(--status-warning)" }}
        >
          <PackageX className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Unidade não encontrada</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
          O link que você abriu aponta para uma unidade que não existe mais. Escolha uma das unidades disponíveis para fazer seu pedido.
        </p>
        <button
          type="button"
          onClick={() => router.push(BRANCHES_PAGE_PATH)}
          className="flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
          style={{ height: 48 }}
        >
          Ver unidades disponíveis
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
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
              onClick={() => router.push(BRANCHES_PAGE_PATH)}
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

  const orderTypeLabel = orderType === "ENTREGA" ? "Entrega" : orderType === "VIAGEM" ? "Para levar" : "Comer aqui";

  const selectOrderType = (next: "BALCAO" | "VIAGEM" | "ENTREGA") => {
    hasManuallySelectedOrderTypeRef.current = true;
    if (next !== "ENTREGA" && appliedCoupon?.discount_type === "FREE_DELIVERY") {
      setAppliedCoupon(null);
      setCouponMessage("O cupom de frete grátis vale só para entrega e foi removido.");
    }
    setOrderType(next);
  };

  /** Seletor único de modalidade (#235); a mesma peça no cardápio, na sacola e nos dados. */
  const renderOrderTypeOptions = (onPicked?: () => void) => (
    <div role="radiogroup" aria-label="Como quer receber" className="flex gap-0.5 rounded-full bg-[var(--bg-subtle)] p-1 md:max-w-md">
      {([{ type: "BALCAO", label: "Comer aqui" }, { type: "VIAGEM", label: "Para levar" }, ...(deliveryEnabled ? [{ type: "ENTREGA", label: "Entrega" }] as const : [])] as const).map((option) => (
        <button
          type="button"
          role="radio"
          key={option.type}
          aria-checked={orderType === option.type}
          className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${orderType === option.type ? "bg-[var(--bg-inverse)] text-white shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          onClick={() => {
            selectOrderType(option.type);
            onPicked?.();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  /** Resumo "Para levar · Unidade [Alterar]" usado depois do cardápio. */
  const renderOrderTypeSummary = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {orderTypeLabel}{branchName ? ` · ${branchName}` : ""}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {orderType === "ENTREGA"
              ? "Entregamos no endereço que você informar."
              : orderType === "VIAGEM"
                ? "Você retira no balcão, embalado para viagem."
                : "Para comer aqui na unidade."}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isEditingOrderType}
          onClick={() => setIsEditingOrderType((current) => !current)}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[var(--text-primary)] underline underline-offset-4"
        >
          {isEditingOrderType ? "Fechar" : "Alterar"}
        </button>
      </div>
      {isEditingOrderType && renderOrderTypeOptions(() => setIsEditingOrderType(false))}
    </div>
  );

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
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: onlineOrderingEnabled ? "var(--status-success)" : "var(--text-muted)" }}
                />
                <span className="truncate">
                  {branchName ?? "Pedido online"}
                  {" · "}
                  {onlineOrderingEnabled ? `Aberto até ${orderingSchedule.end}` : `Atendimento das ${orderingSchedule.start} às ${orderingSchedule.end}`}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {step === "MENU" && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--text-primary)] underline underline-offset-4"
                onClick={() => router.push(BRANCHES_PAGE_PATH)}
              >
                Trocar<span className="sr-only"> unidade</span>
              </button>
            )}
            {step === "MENU" && !orderData && (
              <button
                type="button"
                aria-label="Acompanhar pedido"
                title="Acompanhar pedido"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                onClick={() => document.getElementById("acompanhar-pedido")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              >
                <Package className="h-5 w-5" strokeWidth={1.75} />
              </button>
            )}
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
                Cardápio
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
                    Pra pedir aqui {branchName ? `em ${branchName}` : "nesta unidade"}, comece um novo pedido — o carrinho da outra unidade some.
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

          {/* Modalidade única (#235): escolhida aqui e mostrada como resumo nos dados. */}
          <section aria-label="Como quer receber" className="space-y-1.5">
            {!onlineOrderingEnabled && orderingClosedReason && (
              <p className="rounded-xl bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--status-warning)]">{orderingClosedReason}</p>
            )}
            {renderOrderTypeOptions()}
            <p className="px-1 text-xs text-[var(--text-muted)]">
              {orderType === "ENTREGA"
                ? `Pague online com Pix ou cartão${codEnabled ? ", ou na entrega após a unidade confirmar" : ""}`
                : branchAddress ? `Retire em ${branchAddress}` : "Pague online com Pix ou cartão"}
            </p>
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
              {visibleCategories.map((category) => {
                const isActive = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    ref={(el) => { tabRefs.current[category.id] = el; }}
                    onClick={() => scrollToCategory(category.id)}
                    className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${
                      isActive
                        ? "bg-[var(--text-primary)] text-white shadow-[var(--shadow-sm)]"
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
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Esta unidade ainda não tem itens para pedido online. Volte mais tarde ou escolha outra unidade.</p>
            </div>
          ) : (
          <>
          {/* Uma section por categoria com produto — usuário rola entre elas */}
          {visibleCategories.map((category) => {
            const categoryProducts = productsByCategory[category.id] ?? [];
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
                  <p className="text-sm text-[var(--text-muted)] py-2">Nenhum item com esse filtro.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 2xl:grid-cols-3">
                    {visibleProducts.map((product) => {
                      const { code, title } = splitProductName(product.name);
                      const tags = getProductTags(product, category.name, menuIndexes);
                      const summary = getProductSummary(product, category.name, menuIndexes);
                      const isMostOrdered = publicStats.topByCategory[product.category_id ?? ""] === product.id;
                      const inCart = countProductInCart(items, product.id);
                      const fallbackArt = getFallbackArt(category.name, product.name);
                      const tag = tags[0] && tags[0] !== "Outros" ? tags[0] : null;

                      return (
                        <div key={product.id} className="relative border-b border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => openCustomization(product)}
                            className="focus-ring flex w-full items-start gap-4 rounded-xl py-4 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              {(code || isMostOrdered || tag) && (
                                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                  {code && <span className="text-caption font-medium tabular-nums text-[var(--text-muted)]">#{code}</span>}
                                  {/* "Mais pedido" vem da estatística real da filial (get-public-branch-stats). */}
                                  {isMostOrdered && (
                                    <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-micro font-semibold text-[var(--text-secondary)]">Mais pedido</span>
                                  )}
                                  {tag && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-micro font-semibold text-[var(--text-secondary)]">
                                      {tag === "Vegetariano" && <Leaf className="h-2.5 w-2.5" strokeWidth={1.75} />}
                                      {tag}
                                    </span>
                                  )}
                                </div>
                              )}
                              <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-[var(--text-primary)]">{title}</h3>
                              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{summary}</p>
                              <p className="mt-2 text-[15px] font-bold tabular-nums text-[var(--text-primary)]">{currency.format(product.price)}</p>
                            </div>
                            <ProductImage
                              src={product.image_url}
                              width={104}
                              height={104}
                              sizes="104px"
                              className="h-26 w-26 shrink-0 rounded-2xl object-cover bg-[var(--bg-subtle)]"
                              fallback={fallbackArt ? (
                                <Image src={fallbackArt} alt="" width={104} height={104} unoptimized className="h-26 w-26 shrink-0 rounded-2xl object-cover" />
                              ) : (
                                <div className="flex h-26 w-26 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                                  <Utensils className="h-7 w-7" strokeWidth={1.5} />
                                </div>
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(product)}
                            aria-label={inCart > 0 ? `Adicionar mais um ${title} (${inCart} na sacola)` : `Adicionar ${title}`}
                            className={`focus-ring absolute bottom-2 right-0 flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-base font-bold shadow-[var(--shadow-md)] transition-transform active:scale-95 motion-reduce:transition-none ${
                              inCart > 0
                                ? "bg-brand-red text-white"
                                : "border border-[var(--border-strong)] bg-[var(--bg-surface)] text-brand-red"
                            }`}
                          >
                            {inCart > 0 ? <span className="tabular-nums">{inCart}</span> : <Plus className="h-5 w-5" strokeWidth={2.25} />}
                          </button>
                        </div>
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
              <div className="sticky top-24 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Sua sacola</h2>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {orderType === "ENTREGA" ? "Entrega" : orderType === "VIAGEM" ? "Para levar" : "Comer aqui"}
                    {branchName ? ` · ${branchName}` : ""}
                  </p>
                </div>

                {items.length === 0 || branchDraftMismatch ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-5 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {branchDraftMismatch ? "Finalize ou descarte a sacola da outra unidade, no aviso acima." : "Sua sacola está vazia. Toque em + para escolher."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <div key={item.id} className="border-b border-[var(--border)] pb-2 last:border-b-0">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                <span className="tabular-nums">{item.quantity}×</span> {splitProductName(item.product.name).title}
                              </p>
                              {item.addons.length > 0 && (
                                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                  + {item.addons.map((addon) => `${addon.quantity > 1 ? `${addon.quantity}× ` : ""}${addon.addon_name}`).join(", ")}
                                </p>
                              )}
                              <button type="button" onClick={() => openCustomization(item.product, item)} className="mt-0.5 min-h-8 text-xs font-semibold text-[var(--text-primary)] underline underline-offset-4">
                                Editar
                              </button>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{currency.format(getCartItemTotal(item))}</span>
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
                    <div className="border-t border-[var(--border)] pt-3">
                      <div className="flex items-center justify-between text-base font-bold text-[var(--text-primary)]">
                        <span>Total estimado</span>
                        <span className="tabular-nums">{currency.format(estimatedTotal)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("REVIEW")}
                        className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
                      >
                        Continuar
                      </button>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">O valor final é confirmado quando você envia o pedido.</p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <footer className="space-y-3 pt-2">
            <details className="text-xs text-[var(--text-muted)]">
              <summary className="min-h-11 cursor-pointer py-3">Privacidade</summary>
              <label className="flex min-h-11 items-start gap-2 py-2"><input type="checkbox" className="mt-1" checked={analyticsConsent} onChange={event => setAnalyticsConsent(event.target.checked)} />Permitir que a gente meça a navegação para melhorar o cardápio. Não usamos seu nome, telefone, endereço nem os dados do pedido. Você pode desmarcar quando quiser.</label>
            </details>

            {/* Acompanhar pedido — recolhido pra não competir com o cardápio.
               Precisa existir aqui, e não só no hub /pedir/filiais: o QR Code
               leva direto pra esta tela, então quem perdeu o link do pedido
               não tinha por onde voltar sem sair da filial. */}
            <div id="acompanhar-pedido" className="scroll-mt-24"><AcompanharPedido variant="collapsed" /></div>
          </footer>

          {/* Sticky bottom cart bar — só mobile/tablet (sidebar cobre desktop) */}
          {items.length > 0 && !branchDraftMismatch && (
            <div
              className="xl:hidden fixed left-3 right-3 bottom-3 z-40 animate-in slide-in-from-bottom-8"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <button
                type="button"
                onClick={() => setStep("REVIEW")}
                className="flex h-14 w-full items-center gap-3 rounded-full bg-brand-red pl-4 pr-2 text-white shadow-[0_8px_20px_rgba(231,51,53,0.30)] active:scale-[0.98] motion-reduce:transform-none"
              >
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-1.5 text-sm font-bold tabular-nums">
                  {items.reduce((total, item) => total + item.quantity, 0)}
                </span>
                <span className="text-[15px] font-bold">Ver sacola</span>
                <span className="ml-auto flex h-10 items-center gap-1 rounded-full bg-black/15 px-4 text-[15px] font-bold tabular-nums">
                  {currency.format(estimatedTotal)}
                  <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </button>
            </div>
          )}
        </main>
      )}

      {/* ── Tela 3: REVIEW — só a revisão dos itens do pedido ──────────── */}
      {step === "REVIEW" && (
        <main className="mx-auto max-w-2xl space-y-4 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep("MENU")}
              aria-label="Voltar ao cardápio"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <h2 className="flex-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">Sua sacola</h2>
            <button
              type="button"
              onClick={() => setStep("MENU")}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--text-primary)] underline underline-offset-4"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Adicionar itens
            </button>
          </div>
          <ProgressSteps current={0} />

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="border-b border-[var(--border)] pb-3">{renderOrderTypeSummary()}</div>

            {items.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-6 text-center">
                <ShoppingCart className="mx-auto h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Sua sacola está vazia.</p>
                <button
                  type="button"
                  onClick={() => setStep("MENU")}
                  className="mt-3 min-h-11 text-sm font-semibold text-brand-red hover:text-brand-red-dark"
                >
                  Ver cardápio
                </button>
              </div>
            ) : (
            <>
            {/* Cada item: o que vai no krep, preço da linha e três ações explícitas
               (#235): quantidade, "Editar" (reabre a personalização) e "Remover". */}
            <ul className="divide-y divide-[var(--border)]">
              {items.map((item) => {
                const removedNames = item.removed_ingredients
                  .map((id) => menuIndexes?.ingredientsById.get(id)?.name)
                  .filter(Boolean);
                const title = splitProductName(item.product.name).title;
                return (
                  <li key={item.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold leading-snug text-[var(--text-primary)]">{title}</p>
                        {item.addons.length > 0 && (
                          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                            + {item.addons.map((addon) => `${addon.quantity > 1 ? `${addon.quantity}× ` : ""}${addon.addon_name}`).join(", ")}
                          </p>
                        )}
                        {removedNames.length > 0 && (
                          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Sem {removedNames.join(", ")}</p>
                        )}
                        {item.notes && <p className="mt-0.5 text-xs italic text-[var(--text-muted)]">“{item.notes}”</p>}
                      </div>
                      <p className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--text-primary)]">{currency.format(getCartItemTotal(item))}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="flex h-11 items-center rounded-full border border-[var(--border-strong)]" role="group" aria-label={`Quantidade de ${title}`}>
                        <button
                          type="button"
                          className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-brand-red disabled:text-[var(--text-muted)]"
                          aria-label={`Diminuir ${title}`}
                          disabled={item.quantity === 1}
                          onClick={() => updateItem(item.id, { quantity: item.quantity - 1 })}
                        >
                          <Minus className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">{item.quantity}</span>
                        <button
                          type="button"
                          className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-brand-red"
                          aria-label={`Aumentar ${title}`}
                          onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                        >
                          <Plus className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCustomization(item.product, item)}
                        aria-label={`Editar ${title}: ingredientes, adicionais e observação`}
                        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remover ${title} da sacola`}
                        className="inline-flex h-11 items-center px-2 text-sm font-semibold text-[var(--status-danger)] underline-offset-4 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4">{checkoutSummary}</div>

            {!(isCouponOpen || couponInput || appliedCoupon) ? (
              <button
                type="button"
                onClick={() => setIsCouponOpen(true)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
              >
                <Tag className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} />
                Tenho um cupom
              </button>
            ) : (
            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <label htmlFor="coupon-code" className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Tag className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" strokeWidth={1.75} />
                Cupom de desconto
              </label>
              {couponInput.trim().toUpperCase() === "FERIADOU" && orderType !== "ENTREGA" && deliveryEnabled && (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  O FERIADOU oferece frete grátis. Ao aplicar, você seleciona Entrega para continuar.
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  value={couponInput}
                  onChange={(event) => {
                    setCouponInput(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40));
                    if (couponIsCurrent) {
                      setAppliedCoupon(null);
                      setCouponMessage("");
                    }
                  }}
                  id="coupon-code"
                  placeholder="Código do cupom"
                  autoCapitalize="characters"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)] outline-none placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:border-brand-red"
                />
                <button
                  type="button"
                  onClick={() => void handleApplyCoupon()}
                  disabled={couponLoading || !couponInput.trim()}
                  className="h-11 shrink-0 rounded-xl bg-[var(--bg-inverse)] px-4 text-sm font-semibold text-white disabled:opacity-45"
                >
                  {couponLoading ? "Validando…" : couponIsCurrent ? "Reaplicar" : "Aplicar"}
                </button>
              </div>
              {couponMessage && (
                <p className={`mt-2 text-xs font-semibold ${couponIsCurrent ? "text-[var(--status-success)]" : "text-[var(--status-danger)]"}`}>
                  {couponMessage}
                </p>
              )}
              {couponIsCurrent && appliedCoupon?.description && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">{appliedCoupon.description}</p>
              )}
            </div>
            )}
            </>
            )}
          </section>

          {items.length > 0 && upsellSuggestions.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-sm font-semibold text-[var(--text-primary)]">Os mais pedidos daqui</h3>
              <div className="flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
                {upsellSuggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleQuickAdd(product)}
                    aria-label={`Adicionar ${splitProductName(product.name).title}`}
                    className="flex w-36 shrink-0 flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-micro font-semibold text-[var(--text-secondary)]">
                        Mais pedido
                      </span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-red text-white">
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs font-semibold leading-tight text-[var(--text-primary)]">
                      {splitProductName(product.name).title}
                    </p>
                    <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{currency.format(product.price)}</p>
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
                Olá, {getFirstName(customerName)}! Seus dados já estão salvos.
              </div>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isSubmittingOrder}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
                style={{ height: 52 }}
              >
                {isSubmittingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" strokeWidth={1.75} />}
                Ir para o pagamento
              </button>
              <button
                type="button"
                onClick={() => setStep("INFO")}
                className="flex w-full items-center justify-center gap-1 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Revisar meus dados
              </button>
            </div>
          ) : items.length > 0 ? (
            <button
              type="button"
              onClick={() => setStep("INFO")}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
              style={{ height: 52 }}
            >
              Continuar para seus dados
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
        </main>
      )}

      {/* ── Tela 4: INFO — dados do cliente + modalidade ───────────────── */}
      {step === "INFO" && (
        <main className="mx-auto max-w-6xl grid grid-cols-1 gap-4 p-3 pb-40 sm:p-4 sm:pb-40 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Linha compacta: voltar + progress inline (mobile só mostra textos curtos) */}
          <div className="flex items-center gap-3 lg:col-span-2">
            <button
              type="button"
              onClick={() => setStep("REVIEW")}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Voltar para a sacola"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="flex-1 min-w-0">
              <ProgressSteps current={1} />
            </div>
          </div>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Seus dados</h2>

            {/* Ordem pedida na #235: nome primeiro, WhatsApp depois. A busca do
                perfil continua disparando pelo WhatsApp e nunca sobrescreve um
                nome diferente digitado à mão; nome que é o começo do salvo
                ("Ana" → "Ana Souza") é completado (completePartial). */}
            <FloatingInput
              label="Nome (opcional)"
              name="name"
              autoComplete="name"
              value={customerName}
              onChange={(v) => applyResolvedName(resolveNameFromInput(v), customerPhone)}
              placeholder="Como podemos te chamar?"
            />

            {/* Nome digitado diferente do salvo para este WhatsApp: nunca trocamos
                sozinhos, mas a sugestão fica logo abaixo do campo, com ação explícita. */}
            {nameSuggestion && (
              <div className="-mt-1 flex items-center gap-3 rounded-xl bg-[var(--bg-subtle)] px-3 py-1" role="status">
                <p className="min-w-0 flex-1 text-xs text-[var(--text-secondary)]">
                  Nome salvo neste WhatsApp: <strong className="text-[var(--text-primary)]">{nameSuggestion}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => applyResolvedName(
                    { name: nameSuggestion, source: "LOOKUP", suggestion: null },
                    customerPhone,
                  )}
                  aria-label={`Usar o nome ${nameSuggestion}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[var(--text-primary)] underline underline-offset-4"
                >
                  Usar
                </button>
              </div>
            )}

            <FloatingInput
              // Sem aviso de obrigatoriedade no campo (pedido do operador, #235). Em
              // ENTREGA o envio continua bloqueado com mensagem se faltar o número.
              label="WhatsApp com DDD"
              name="tel"
              autoComplete="tel"
              value={customerPhone}
              onChange={(v) => setCustomerInfo(customerName, formatWhatsAppInput(v))}
              onBlur={() => setCustomerInfo(customerName, formatWhatsAppInput(customerPhone))}
              placeholder="(61) 99999-9999"
              type="tel"
              inputMode="tel"
              // Número pela metade avisa aqui, e não só quando o pedido é enviado.
              error={customerPhoneWarning}
            />

            {isProfileChecking && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-red" />
                Buscando seus dados…
              </div>
            )}

                {profileNotice && (
                  <div className="flex items-center justify-between gap-2" role="status">
                    <p className="text-xs font-medium text-[var(--status-success)]">{profileNotice}</p>
                    <button
                      type="button"
                      onClick={handleForgetSavedProfile}
                      className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
                    >
                      Não é você?
                    </button>
                  </div>
                )}
                {checkoutPhone && profileLookupState === "not_found" && (
                  <p className="text-xs font-medium text-[var(--text-secondary)]" role="status">
                    Não encontramos dados salvos com este WhatsApp.
                  </p>
                )}


                {/* E-mail continua opcional (#235): recolhido para não competir com o essencial. */}
                {isEmailOpen || customerEmail ? (
                  <FloatingInput
                    label="E-mail (opcional)"
                    name="email"
                    autoComplete="email"
                    value={customerEmail}
                    onChange={setCustomerEmail}
                    placeholder="voce@exemplo.com"
                    type="email"
                    inputMode="email"
                    help="Usado no pagamento online, com Pix ou cartão."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEmailOpen(true)}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
                  >
                    <Plus className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={2} />
                    Adicionar e-mail (opcional)
                  </button>
                )}

                <div className="rounded-xl border border-[var(--border)] px-3 py-2">{renderOrderTypeSummary()}</div>

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
                          ? "Localização marcada. Toque para atualizar"
                          : "Usar minha localização atual (opcional)"}
                      </button>
                      {locationStatus === "error" && (
                        <p className="text-[11px] text-[var(--text-secondary)]">{locationError}</p>
                      )}
                    </div>

                    {selectedAddressId === null && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="col-span-2 min-h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red"
                          placeholder="CEP *"
                          aria-label="CEP (obrigatório)"
                          name="postal-code"
                          autoComplete="postal-code"
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
                          <p className="col-span-2 text-xs text-[var(--text-secondary)]" role="status">
                            {deliveryAddress.street}, {deliveryAddress.neighborhood} — {deliveryAddress.city}/{deliveryAddress.state}
                          </p>
                        )}
                        <input
                          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red disabled:opacity-50"
                          placeholder="Nº do imóvel"
                          aria-label="Número do imóvel (casa, prédio ou lote)"
                          name="address-number"
                          autoComplete="off"
                          inputMode="numeric"
                          disabled={cepStatus !== "resolved"}
                          value={deliveryAddress.number}
                          onChange={(e) => setDeliveryAddress((p) => ({ ...p, number: e.target.value }))}
                        />
                        <input
                          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red disabled:opacity-50"
                          placeholder="Complemento"
                          aria-label="Complemento (apto, bloco, quadra)"
                          name="address-complement"
                          autoComplete="address-line2"
                          disabled={cepStatus !== "resolved"}
                          value={deliveryAddress.complement}
                          onChange={(e) => setDeliveryAddress((p) => ({ ...p, complement: e.target.value }))}
                        />
                        <input
                          className="col-span-2 min-h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red disabled:opacity-50"
                          placeholder="Ponto de referência (opcional)"
                          aria-label="Ponto de referência (opcional)"
                          name="address-reference"
                          autoComplete="off"
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
                          onClick={() => {
                            if (appliedCoupon?.discount_type === "FREE_DELIVERY") {
                              setAppliedCoupon(null);
                              setCouponMessage("O cupom de frete grátis vale só para entrega e foi removido.");
                            }
                            hasManuallySelectedOrderTypeRef.current = true;
                            setOrderType("VIAGEM");
                          }}
                          className="focus-ring mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-surface)] text-xs font-bold text-[var(--status-danger)] ring-1 ring-inset ring-[var(--status-danger)]/30 transition-colors hover:bg-[var(--status-danger-bg)]"
                        >
                          Retirar no balcão em vez disso
                        </button>
                      </div>
                    ) : effectiveNeighborhood.trim() ? (
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Taxa de entrega estimada: {freeDeliveryCoupon ? "Grátis com FERIADOU" : currency.format(estimatedDeliveryFee)}
                      </p>
                    ) : null}
                  </div>
                )}

                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  aria-label="Observações para a unidade (opcional)"
                  placeholder="Observações para a unidade (opcional)"
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
                    Salvar para próximos pedidos e contar meus selos de fidelidade
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
          </section>

          <aside className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:self-start">
          {orderType === "ENTREGA" && codEnabled && codMethods.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4" aria-label="Quando pagar">
              <h2 className="font-semibold">Quando pagar</h2>
              <label className="flex min-h-11 items-center gap-2"><input type="radio" name="payment-timing" checked={!useCod} onChange={() => setPaymentTiming("ONLINE")} /> Online — Pix ou cartão</label>
              <label className="flex min-h-11 items-center gap-2"><input type="radio" name="payment-timing" checked={useCod} onChange={() => { setPaymentTiming("ON_DELIVERY"); trackFunnel("payment_option_select", {payment_option:"ON_DELIVERY"}); }} /> Pagar na entrega</label>
              {useCod && <>
                <p className="text-sm text-[var(--text-secondary)]">A unidade precisa confirmar o pedido antes do preparo. O pagamento será feito ao receber a entrega.</p>
                <label className="block text-sm">Forma de pagamento esperada
                  <select className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2" value={expectedMethod} onChange={event => { setExpectedMethod(isDeliveryPaymentMethod(event.target.value) ? event.target.value : ""); setCheckoutError(""); }}>
                    <option value="">Escolha</option>
                    {codMethods.map(method => <option key={method} value={method}>{DELIVERY_PAYMENT_LABELS[method]}</option>)}
                  </select>
                </label>
                {expectedMethod === "CASH" && <FloatingInput label="Troco para quanto? (opcional)" value={cashChangeFor} onChange={value => { setCashChangeFor(value); setCheckoutError(""); }}inputMode="decimal" placeholder="Ex.: 50,00" help="Deixe vazio se tiver o valor exato." />}
              </>}
            </section>
          )}
          {checkoutSummary}

          {/* Barra fixa no rodapé — resumo + CTA sempre na zona do polegar,
             mesmo em formulários longos (endereço de entrega). */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 space-y-2 border-t border-[var(--border)] bg-[var(--bg-surface)] px-3 pt-3 sm:px-4 lg:static lg:border-0 lg:bg-transparent lg:p-0"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto max-w-2xl space-y-2">
              <div className="flex items-baseline justify-between px-1 lg:hidden">
                <span className="text-sm text-[var(--text-secondary)]">
                  {deliveryFeeKnown ? "Total estimado" : "Total parcial"} · {items.reduce((total, item) => total + item.quantity, 0)} {items.reduce((total, item) => total + item.quantity, 0) === 1 ? "item" : "itens"}
                </span>
                <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                  {currency.format(checkoutPreviewTotal)}
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
                {useCod ? "Solicitar pedido para entrega" : "Continuar para pagamento"}
              </button>
            </div>
          </div>
          </aside>
        </main>
      )}

      {step === "PAYMENT" && orderData && (
        <main className="mx-auto max-w-3xl space-y-4 p-4">
          <ProgressSteps current={2} />

          {/* Resumo do que será cobrado. Sem selos de confiança genéricos (#235):
             "Cancelamento fácil" não tinha fluxo de cancelamento pelo cliente. */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Total a pagar</p>
                <p className="text-3xl font-bold leading-tight tabular-nums text-[var(--text-primary)]">{currency.format(orderData.total_amount)}</p>
                {orderData.coupon_code && Number(orderData.discount_amount ?? 0) > 0 && (
                  <p className="mt-1 text-xs font-semibold text-[var(--status-success)]">
                    Cupom {orderData.coupon_code} · -{currency.format(Number(orderData.discount_amount ?? 0))}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-[var(--text-muted)]">Pedido</p>
                <p className="text-base font-bold tabular-nums text-[var(--text-primary)]">nº {String(orderData.daily_number).padStart(3, "0")}</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-base font-semibold text-[var(--text-primary)]">Como quer pagar?</h2>
            <button
              type="button"
              onClick={() => { setPaymentMode("PIX"); trackFunnel("payment_option_select", {payment_option:"PIX"}); }}
              aria-pressed={paymentMode === "PIX"}
              className={`w-full flex min-h-16 items-center gap-3 rounded-2xl p-4 text-left ${
                paymentMode === "PIX"
                  ? "border-2 border-[var(--text-primary)] bg-[var(--bg-surface)]"
                  : "border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)]">
                <QrCode className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Pix</p>
                <p className="text-xs text-[var(--text-secondary)]">QR Code ou código copia e cola</p>
              </div>
              {paymentMode === "PIX" && <CheckCircle2 className="h-5 w-5 text-[var(--text-primary)] shrink-0" strokeWidth={2} />}
            </button>

            <button
              type="button"
              onClick={() => { setPaymentMode("CARD"); trackFunnel("payment_option_select", {payment_option:"CARD"}); }}
              aria-pressed={paymentMode === "CARD"}
              className={`w-full flex min-h-16 items-center gap-3 rounded-2xl p-4 text-left ${
                paymentMode === "CARD"
                  ? "border-2 border-[var(--text-primary)] bg-[var(--bg-surface)]"
                  : "border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info)]">
                <CreditCard className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Cartão de crédito ou débito</p>
                <p className="text-xs text-[var(--text-secondary)]">Dados digitados no formulário do Mercado Pago</p>
              </div>
              {paymentMode === "CARD" && <CheckCircle2 className="h-5 w-5 text-[var(--text-primary)] shrink-0" strokeWidth={2} />}
            </button>
            <p className="px-1 pt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Pagamento processado pelo Mercado Pago. O pedido vai para o preparo depois da aprovação.
            </p>
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
              // Só o estado muda a cada tecla; a gravação em sessionStorage
              // (que serializa o pedido inteiro) acontece no blur do campo.
              onPayerEmailChange={setCustomerEmail}
              onPayerEmailCommit={(email) => savePublicOrderSession(orderData, email, branchSlug)}
              onPaid={() => {
                setPaidCustomer({ firstName: getFirstName(customerName), phone: normalizeBrazilPhone(customerPhone) ? customerPhone : "" });
                clearCart();
                clearSavedPublicOrderSession();
                setStep("PAID");
              }}
            />
          ) : (
            <MercadoPagoBrick
              order={orderData}
              onPaid={() => {
                setPaidCustomer({ firstName: getFirstName(customerName), phone: normalizeBrazilPhone(customerPhone) ? customerPhone : "" });
                clearCart();
                clearSavedPublicOrderSession();
                setStep("PAID");
              }}
            />
          )}

          {/* PixResult era renderizado aqui pro resultado do cartão. Ele é uma
             tela de Pix — QR Code e contagem regressiva de 5 min — e no cartão
             saía com o contador congelado quando havia ticket_url. O retorno do
             cartão agora é comunicado pelo próprio MercadoPagoBrick (aprovado,
             em análise ou recusado com o motivo). */}
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
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--status-success-bg)] px-3 text-xs font-bold text-[var(--status-success)]">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Pagamento aprovado
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {paidCustomer?.firstName ? `Obrigado, ${paidCustomer.firstName}!` : "Obrigado!"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                {paidCustomer?.phone
                  ? `Seu pedido já está com a unidade. Vamos avisar pelo WhatsApp ${paidCustomer.phone} quando ele estiver pronto.`
                  : "Seu pedido já está com a unidade. Acompanhe o andamento pelo link abaixo."}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Número do pedido</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{orderNum}</p>
                </div>
                {trackingUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(trackingUrl);
                      addToast("success", "Link copiado!");
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] underline underline-offset-4"
                  >
                    <ClipboardCopy className="h-4 w-4" strokeWidth={1.75} />
                    Copiar link
                  </button>
                )}
              </div>
            </section>

            {/* Timeline de status */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <h3 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Acompanhamento</h3>
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
              <div className="flex h-[52px] shrink-0 items-center rounded-full border border-[var(--border-strong)]">
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full text-brand-red disabled:text-[var(--text-muted)]"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" strokeWidth={2} />
                </button>
                <span className="w-6 text-center text-base font-bold text-[var(--text-primary)] tabular-nums" aria-live="polite">{quantity}</span>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full text-brand-red"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-brand-red px-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] hover:bg-brand-red-dark active:scale-[0.98]"
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
            {/* Hero (#235): foto quando houver; sem foto, a ilustração inteira da categoria
               sobre o bege da marca (object-contain para não cortar o desenho). */}
            {(() => {
              const fallbackArt = getFallbackArt(selectedProductCategory?.name, selectedProduct.name);
              const isArt = !selectedProduct.image_url || selectedProduct.image_url.startsWith("/cardapio/");
              return (
                <div className="mx-5 mt-2 flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-[var(--bg-subtle)]">
                  <ProductImage
                    src={selectedProduct.image_url}
                    width={480}
                    height={360}
                    sizes="(max-width: 448px) 100vw, 448px"
                    className={isArt ? "h-44 w-44 object-cover" : "h-full w-full object-cover"}
                    priority
                    fallback={fallbackArt ? (
                      <Image src={fallbackArt} alt="" width={176} height={176} unoptimized className="h-44 w-44 object-cover" />
                    ) : (
                      <Utensils className="h-12 w-12 text-[var(--text-muted)]" strokeWidth={1.25} />
                    )}
                  />
                </div>
              );
            })()}

            <div className="px-5 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                  {splitProductName(selectedProduct.name).title}
                </h3>
                <p className="shrink-0 text-lg font-bold tabular-nums text-[var(--text-primary)]">{currency.format(selectedProduct.price)}</p>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                {getProductSummary(selectedProduct, selectedProductCategory?.name, menuIndexes)}
              </p>
            </div>

            {/* Ingredientes — desmarcar retira do krep */}
            {productDefaultIngredients.length > 0 && (
              <section className="mt-5 px-5" aria-labelledby="sheet-ingredients">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 id="sheet-ingredients" className="text-[15px] font-bold text-[var(--text-primary)]">Ingredientes</h4>
                  <span className="text-xs text-[var(--text-muted)]">Desmarque para retirar</span>
                </div>
                <ul className="mt-1 divide-y divide-[var(--border)]">
                  {productDefaultIngredients.map((ingredient) => {
                    const isIncluded = !removedIngredientIds.has(ingredient.id);
                    return (
                      <li key={ingredient.id}>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => {
                              setRemovedIngredientIds((current) => {
                                const next = new Set(current);
                                if (next.has(ingredient.id)) next.delete(ingredient.id);
                                else next.add(ingredient.id);
                                return next;
                              });
                            }}
                            className="h-5 w-5 shrink-0 accent-[var(--text-primary)]"
                          />
                          <span className={`text-sm font-semibold ${isIncluded ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] line-through"}`}>
                            {ingredient.name}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Adicionais — todos os vinculados ao produto, sem limite de quantidade. */}
            {productAddons.length > 0 && (
              <section className="mt-5 px-5" aria-labelledby="sheet-addons">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 id="sheet-addons" className="text-[15px] font-bold text-[var(--text-primary)]">Adicionais</h4>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-micro font-semibold text-[var(--text-secondary)]">
                    {selectedAddonCount > 0 ? `${selectedAddonCount} ${selectedAddonCount === 1 ? "escolhido" : "escolhidos"}` : "Opcional"}
                  </span>
                </div>
                <ul className="mt-1 divide-y divide-[var(--border)]">
                  {productAddons.map((addon) => {
                    const qty = selectedAddons.get(addon.id) || 0;
                    return (
                      <li key={addon.id} className="flex min-h-14 items-center gap-3 py-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{addon.name}</p>
                          <p className="text-xs tabular-nums text-[var(--text-secondary)]">+ {currency.format(addon.price)}</p>
                        </div>
                        <div className="flex h-11 items-center rounded-full border border-[var(--border-strong)]">
                          <button
                            type="button"
                            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-brand-red disabled:text-[var(--text-muted)]"
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
                          <span className="w-6 text-center text-sm font-bold tabular-nums text-[var(--text-primary)]" aria-live="polite">{qty}</span>
                          <button
                            type="button"
                            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-brand-red"
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
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Observação */}
            <section className="mt-5 px-5">
              <FloatingInput
                label="Observação para a cozinha (opcional)"
                value={itemNotes}
                onChange={setItemNotes}
                placeholder="Ex.: bem passado, pouco queijo"
              />
            </section>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
