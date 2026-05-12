"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  CreditCard,
  Flame,
  Leaf,
  Loader2,
  Minus,
  Package,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  ShoppingCart,
  Tag,
  Trash2,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { pdvApi, CreatePublicOrderResponse, MercadoPagoPaymentResponse, OrderingClosedError } from "@/lib/api/pdv-api";
import { Addon, Ingredient, Product } from "@/types/pdv";
import { CartItem, useCart } from "@/features/cart/useCart";

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => {
      bricks: () => {
        create: (type: string, containerId: string, settings: Record<string, unknown>) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

interface MenuIndexes {
  ingredientsById: Map<string, Ingredient>;
  addonsById: Map<string, Addon>;
  ingredientIdsByProduct: Map<string, string[]>;
  addonIdsByProduct: Map<string, string[]>;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PAYMENT_METHOD_CODE = "MERCADO_PAGO_PAYMENT_BRICK";
const PIX_PAYMENT_METHOD_CODE = "PIX";
const ALL_FILTER = "Todos";
const DEFAULT_ORDERING_START = "17:00";
const DEFAULT_ORDERING_END = "23:30";
const INSTAGRAM_URL = "https://www.instagram.com/marcos_kreps/";
const PIX_WAIT_MINUTES = 5;
const PUBLIC_ORDER_STORAGE_KEY = "pdv-public-order";
const PUBLIC_CUSTOMER_PROFILE_KEY = "pdv-public-customer-profile";

type SavedPublicCustomerProfile = {
  phone_e164: string;
  name: string;
  email?: string;
  order_type: "BALCAO" | "VIAGEM";
  marketing_opt_in: boolean;
  saved_at: string;
};

const SAVORY_PROTEINS = ["presunto", "calabresa", "frango", "atum", "peito de peru", "carne de sol"];
const SWEET_BASES = ["banana", "morango", "nutella", "chocolate", "doce de leite", "goiabada"];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function splitProductName(name: string) {
  const match = name.match(/^(\d+)\s*-\s*(.+)$/);
  return {
    code: match?.[1] ?? "",
    title: match?.[2] ?? name,
  };
}

function getCategoryKind(categoryName?: string) {
  const normalized = normalizeText(categoryName ?? "");
  if (normalized.includes("salgado")) return "SAVORY";
  if (normalized.includes("doce")) return "SWEET";
  if (normalized.includes("bebida") || normalized.includes("combustive")) return "DRINK";
  if (normalized.includes("batata")) return "POTATO";
  return "OTHER";
}

function getProductIngredients(product: Product, indexes: MenuIndexes | null) {
  if (!indexes) return [];
  const ingredientIds = indexes.ingredientIdsByProduct.get(product.id) ?? [];
  return ingredientIds.map((id) => indexes.ingredientsById.get(id)).filter(Boolean) as Ingredient[];
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => (part.length <= 2 ? part : `${part[0]?.toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function getProductTags(product: Product, categoryName: string | undefined, indexes: MenuIndexes | null) {
  const kind = getCategoryKind(categoryName);
  const ingredients = getProductIngredients(product, indexes);
  const ingredientNames = ingredients.map((ingredient) => ingredient.name);
  const normalizedIngredients = ingredientNames.map(normalizeText);
  const normalizedName = normalizeText(product.name);

  if (kind === "SAVORY") {
    if (normalizedName.includes("maverick")) return ["Especial"];
    const protein = SAVORY_PROTEINS.find((item) => normalizedIngredients.includes(normalizeText(item)));
    if (protein) return [titleCase(protein)];
    if (normalizedIngredients.includes("ovo") || normalizedIngredients.includes("queijo")) return ["Vegetariano"];
    return ["Outros"];
  }

  if (kind === "SWEET") {
    const bases = SWEET_BASES.filter((item) => normalizedIngredients.includes(normalizeText(item)));
    return bases.length > 0 ? bases.map(titleCase) : ["Doces"];
  }

  if (kind === "DRINK") {
    if (normalizedName.includes("refrigerante") || normalizedName.includes("h2o")) return ["Geladas"];
    if (normalizedName.includes("polpa")) return ["Polpas"];
    if (normalizedName.includes("acai") || normalizedName.includes("creme")) return ["Cremes"];
    if (normalizedName.includes("soda")) return ["Soda"];
    if (normalizedName.includes("suco") || normalizedName.includes("laranja")) return ["Sucos"];
    return ["Bebidas"];
  }

  return [];
}

function getProductSummary(product: Product, categoryName: string | undefined, indexes: MenuIndexes | null) {
  const ingredients = getProductIngredients(product, indexes);
  if (product.description) return product.description;
  if (ingredients.length > 0) {
    return ingredients.map((ingredient) => ingredient.name).join(", ");
  }
  if (getCategoryKind(categoryName) === "DRINK") return "Bebida preparada para acompanhar seu pedido.";
  if (getCategoryKind(categoryName) === "POTATO") return "Porcao para dividir ou acompanhar seu krep.";
  return "Item do cardapio Marcos Krep's.";
}

function buildMenuIndexes(menuData: MenuData | null): MenuIndexes | null {
  if (!menuData) return null;
  const ingredientsById = new Map(menuData.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const addonsById = new Map(menuData.addons.map((addon) => [addon.id, addon]));
  const ingredientIdsByProduct = new Map<string, string[]>();
  const addonIdsByProduct = new Map<string, string[]>();

  for (const relation of menuData.productIngredients) {
    const current = ingredientIdsByProduct.get(relation.product_id);
    if (current) current.push(relation.ingredient_id);
    else ingredientIdsByProduct.set(relation.product_id, [relation.ingredient_id]);
  }

  for (const relation of menuData.productAddons) {
    const current = addonIdsByProduct.get(relation.product_id);
    if (current) current.push(relation.addon_id);
    else addonIdsByProduct.set(relation.product_id, [relation.addon_id]);
  }

  return { ingredientsById, addonsById, ingredientIdsByProduct, addonIdsByProduct };
}

function loadMercadoPagoScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Erro ao carregar Mercado Pago.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Erro ao carregar Mercado Pago."));
    document.body.appendChild(script);
  });
}

function MercadoPagoBrick({
  order,
  onResult,
  onPaid,
}: {
  order: CreatePublicOrderResponse["order"];
  onResult: (result: MercadoPagoPaymentResponse) => void;
  onPaid: () => void;
}) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

  useEffect(() => {
    let controller: { unmount: () => void } | null = null;
    let cancelled = false;

    async function renderBrick() {
      if (!publicKey) return;

      try {
        await loadMercadoPagoScript();
        if (cancelled || !window.MercadoPago) return;

        const mercadoPago = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mercadoPago.bricks();
        controller = await bricksBuilder.create("payment", "public-payment-brick", {
          initialization: {
            amount: Number(order.total_amount),
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              prepaidCard: "all",
              debitCard: "all",
            },
          },
          callbacks: {
            onReady: () => setIsReady(true),
            onSubmit: ({ formData }: { selectedPaymentMethod: string; formData: Record<string, unknown> }) => {
              return new Promise<void>((resolve, reject) => {
                const idempotencyKey = crypto.randomUUID();
                pdvApi.createMercadoPagoPayment({
                  order_id: order.order_id,
                  public_token: order.public_token,
                  payment_method_code: PAYMENT_METHOD_CODE,
                  form_data: formData,
                  idempotency_key: idempotencyKey,
                })
                  .then((response) => {
                    onResult(response);
                    if (!response.success) {
                      setError(response.error || "Nao foi possivel processar o pagamento.");
                      reject();
                      return;
                    }
                    if (response.payment?.status === "approved" || response.already_paid) {
                      onPaid();
                    }
                    resolve();
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : "Erro ao processar pagamento.");
                    reject();
                  });
              });
            },
            onError: (err: unknown) => {
              console.error("[MercadoPagoBrick] error", JSON.stringify(err, null, 2), err);
              setError("O checkout do Mercado Pago nao carregou corretamente.");
            },
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao iniciar Mercado Pago.");
      }
    }

    renderBrick();

    return () => {
      cancelled = true;
      if (controller) controller.unmount();
    };
  }, [onPaid, onResult, order.order_id, order.public_token, order.total_amount, publicKey]);

  if (!publicKey) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
        Configure `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` para habilitar o pagamento no checkout.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-black">Pagamento protegido pelo Mercado Pago</p>
        </div>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-800/80">
          Cartao de credito, debito e outros meios aparecem conforme disponibilidade do Mercado Pago.
        </p>
      </div>
      {!isReady && !error && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand-red" />
          Carregando pagamento seguro...
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      <div id="public-payment-brick" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3" />
    </div>
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function readSavedPublicProfile(): SavedPublicCustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PUBLIC_CUSTOMER_PROFILE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SavedPublicCustomerProfile;
    return parsed.phone_e164 && parsed.name ? parsed : null;
  } catch {
    localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
    return null;
  }
}

function savePublicProfile(profile: SavedPublicCustomerProfile) {
  localStorage.setItem(PUBLIC_CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function cpfDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidCpf(value: string) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

function formatCpfInput(value: string) {
  const digits = cpfDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function PixResult({
  payment,
  waitExpiresAt,
}: {
  payment: MercadoPagoPaymentResponse;
  waitExpiresAt?: string | null;
}) {
  const transaction = payment.transaction;
  const qrBase64 = transaction?.qr_code_base64;
  const qrCode = transaction?.qr_code;
  const ticketUrl = transaction?.ticket_url;
  const [copied, setCopied] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!waitExpiresAt) return PIX_WAIT_MINUTES * 60 * 1000;
    return new Date(waitExpiresAt).getTime() - Date.now();
  });

  useEffect(() => {
    if (!waitExpiresAt) return;
    const updateRemaining = () => setRemainingMs(new Date(waitExpiresAt).getTime() - Date.now());
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [waitExpiresAt]);

  if (!qrBase64 && !qrCode && !ticketUrl) return null;

  const isExpired = remainingMs <= 0;

  return (
    <div className="space-y-3 rounded-2xl border border-teal-100 bg-teal-50 p-4">
      <div className="flex items-center justify-between gap-3 text-teal-800">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-widest">Pix gerado</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${isExpired ? "bg-red-100 text-red-700" : "bg-white text-teal-700"}`}>
          {isExpired ? "Tempo esgotado" : formatCountdown(remainingMs)}
        </span>
      </div>
      <p className="text-sm font-semibold leading-relaxed text-teal-900/80">
        Copie o codigo Pix ou escaneie o QR Code. Mantenha esta tela aberta enquanto conferimos a aprovacao.
      </p>
      {qrBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${qrBase64}`}
          alt="QR Code Pix"
          className="mx-auto h-56 w-56 rounded-xl bg-white p-2"
        />
      )}
      {qrCode && (
        <Button
          variant="outline"
          className="w-full gap-2 border-teal-200 text-teal-700"
          onClick={async () => {
            await navigator.clipboard.writeText(qrCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Copy className="h-4 w-4" />
          {copied ? "Codigo copiado" : "Copiar Pix copia e cola"}
        </Button>
      )}
      {ticketUrl && (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-black uppercase tracking-wide text-white"
        >
          Abrir Pix no Mercado Pago
        </a>
      )}
    </div>
  );
}

function PixCheckout({
  order,
  payerEmail,
  onPayerEmailChange,
  onPaid,
}: {
  order: CreatePublicOrderResponse["order"];
  payerEmail: string;
  onPayerEmailChange: (email: string) => void;
  onPaid: () => void;
}) {
  const [payment, setPayment] = useState<MercadoPagoPaymentResponse | null>(null);
  const [waitExpiresAt, setWaitExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [pixIdempotencyKey, setPixIdempotencyKey] = useState(() => crypto.randomUUID());
  const [now, setNow] = useState(() => Date.now());
  const [payerCpf, setPayerCpf] = useState("");

  useEffect(() => {
    if (!payment) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [payment]);

  const hasActivePix = !!payment?.transaction?.qr_code && !!waitExpiresAt && new Date(waitExpiresAt).getTime() > now;

  const handleGeneratePix = async () => {
    if (isGenerating || hasActivePix) return;
    setError("");
    if (!isValidEmail(payerEmail)) {
      setError("Informe um e-mail valido para gerar o Pix pelo Mercado Pago.");
      return;
    }
    if (payerCpf.trim() && !isValidCpf(payerCpf)) {
      setError("Informe um CPF valido para gerar o Pix pelo Mercado Pago.");
      return;
    }

    setIsGenerating(true);
    const requestIdempotencyKey = payment && !hasActivePix ? crypto.randomUUID() : pixIdempotencyKey;
    if (requestIdempotencyKey !== pixIdempotencyKey) setPixIdempotencyKey(requestIdempotencyKey);

    try {
      const formData: Record<string, unknown> = {
        payment_method_id: "pix",
        email: payerEmail.trim(),
      };
      if (isValidCpf(payerCpf)) {
        formData.identificationType = "CPF";
        formData.identificationNumber = cpfDigits(payerCpf);
      }

      const response = await pdvApi.createMercadoPagoPayment({
        order_id: order.order_id,
        public_token: order.public_token,
        payment_method_code: PIX_PAYMENT_METHOD_CODE,
        direct_payment_method: "pix",
        form_data: formData,
        idempotency_key: requestIdempotencyKey,
      });

      setPayment(response);
      setWaitExpiresAt(response.transaction?.expires_at ?? null);

      if (!response.success) {
        setError(response.error || "Nao foi possivel gerar o Pix.");
        setPixIdempotencyKey(crypto.randomUUID());
        return;
      }
      if (response.payment?.status === "approved" || response.already_paid) {
        onPaid();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar Pix.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-teal-900">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-teal-700" />
          <p className="text-sm font-black">Pix copia e cola</p>
        </div>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-teal-900/75">
          Gere o codigo, pague pelo banco e deixe esta tela aberta. A confirmacao aparece automaticamente.
        </p>
      </div>

      <input
        value={payerEmail}
        onChange={(event) => onPayerEmailChange(event.target.value)}
        placeholder="E-mail exigido pelo Mercado Pago para Pix"
        type="email"
        disabled={!!payment}
        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none focus:border-teal-700 disabled:opacity-60"
      />
      <input
        value={payerCpf}
        onChange={(event) => setPayerCpf(formatCpfInput(event.target.value))}
        placeholder="CPF opcional, usado se o Mercado Pago exigir"
        type="text"
        inputMode="numeric"
        disabled={!!payment}
        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none focus:border-teal-700 disabled:opacity-60"
      />

      {!payment && (
        <Button className="w-full gap-2 bg-teal-700 hover:bg-teal-800" loading={isGenerating} onClick={handleGeneratePix}>
          <QrCode className="h-4 w-4" />
          Gerar Pix copia e cola
        </Button>
      )}

      {payment && <PixResult payment={payment} waitExpiresAt={waitExpiresAt} />}

      {payment && !hasActivePix && (
        <Button variant="outline" className="w-full gap-2" loading={isGenerating} onClick={handleGeneratePix}>
          <RefreshCw className="h-4 w-4" />
          Gerar novo Pix
        </Button>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}

export default function PedirPublicPage() {
  const router = useRouter();
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
  } = useCart();

  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlineOrderingEnabled, setOnlineOrderingEnabled] = useState(true);
  const [orderingClosedReason, setOrderingClosedReason] = useState("");
  const [packagingFee, setPackagingFee] = useState(0);
  const [applyPackagingFeeForTakeout, setApplyPackagingFeeForTakeout] = useState(false);
  const [orderingSchedule, setOrderingSchedule] = useState({
    start: DEFAULT_ORDERING_START,
    end: DEFAULT_ORDERING_END,
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState(ALL_FILTER);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [removedIngredientIds, setRemovedIngredientIds] = useState<Set<string>>(new Set());
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [step, setStep] = useState<"MENU" | "CHECKOUT" | "PAYMENT" | "PAID">("MENU");
  const [customerEmail, setCustomerEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [rememberCheckoutData, setRememberCheckoutData] = useState(false);
  const [profileLookupState, setProfileLookupState] = useState<"idle" | "checking" | "found">("idle");
  const [profileNotice, setProfileNotice] = useState("");
  const [addonsExpanded, setAddonsExpanded] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderData, setOrderData] = useState<CreatePublicOrderResponse["order"] | null>(null);
  const [paymentResult, setPaymentResult] = useState<MercadoPagoPaymentResponse | null>(null);
  const [paymentMode, setPaymentMode] = useState<"PIX" | "CARD">("PIX");
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const [data, config] = await Promise.all([
          menuApi.getMenuData(),
          pdvApi.getPublicCheckoutConfig(),
        ]);
        if (!config.success) throw new Error(config.error || "Erro ao carregar configuracoes de pedido.");
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
        setMenuData(data);
        setSelectedCategoryId(data.categories[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar cardapio.");
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, [clearCart]);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = sessionStorage.getItem(PUBLIC_ORDER_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        order?: CreatePublicOrderResponse["order"];
        customerEmail?: string;
      };
      if (parsed.order?.order_id && parsed.order.public_token) {
        timer = window.setTimeout(() => {
          setOrderData(parsed.order!);
          setCustomerEmail(parsed.customerEmail ?? "");
          setStep("PAYMENT");
        }, 0);
      }
    } catch {
      sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSavedPublicProfile();
      if (!saved) return;
      setCustomerInfo(saved.name, formatWhatsAppInput(saved.phone_e164));
      setCustomerEmail(saved.email ?? "");
      setMarketingOptIn(saved.marketing_opt_in);
      setRememberCheckoutData(true);
      setOrderType(saved.order_type);
      setProfileLookupState("found");
      setProfileNotice("Dados deste dispositivo preenchidos para agilizar seu pedido.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setCustomerInfo, setOrderType]);

  useEffect(() => {
    const normalizedPhone = normalizeBrazilPhone(customerPhone);
    if (!normalizedPhone) {
      const timer = window.setTimeout(() => setProfileLookupState("idle"), 0);
      return () => window.clearTimeout(timer);
    }

    const saved = readSavedPublicProfile();
    if (saved?.phone_e164 === normalizedPhone) {
      const timer = window.setTimeout(() => {
        setCustomerInfo(saved.name, formatWhatsAppInput(saved.phone_e164));
        setCustomerEmail(saved.email ?? "");
        setMarketingOptIn(saved.marketing_opt_in);
        setRememberCheckoutData(true);
        setOrderType(saved.order_type);
        setProfileLookupState("found");
        setProfileNotice("Dados salvos neste dispositivo encontrados.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setProfileLookupState("checking");
        const response = await pdvApi.getPublicCustomerProfile({ customer_phone: normalizedPhone });
        if (cancelled) return;
        if (response.found && response.profile) {
          setCustomerInfo(response.profile.name ?? customerName, formatWhatsAppInput(normalizedPhone));
          setCustomerEmail(response.profile.email ?? "");
          setMarketingOptIn(response.profile.marketing_opt_in === true);
          if (response.profile.order_type === "BALCAO" || response.profile.order_type === "VIAGEM") {
            setOrderType(response.profile.order_type);
          }
          setRememberCheckoutData(true);
          setProfileLookupState("found");
          setProfileNotice("Encontrei seus dados salvos pelo WhatsApp.");
        } else {
          setProfileLookupState("idle");
        }
      } catch {
        if (!cancelled) setProfileLookupState("idle");
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerName, customerPhone, setCustomerInfo, setOrderType]);

  useEffect(() => {
    const recheck = async () => {
      try {
        const config = await pdvApi.getPublicCheckoutConfig();
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
  }, [clearCart]);

  useEffect(() => {
    if (!orderData || step === "PAID") return;

    const interval = window.setInterval(async () => {
      try {
        const status = await pdvApi.getPublicOrderStatus({
          public_token: orderData.public_token,
        });
        if (status.order.payment_status === "PAID") {
          clearCart();
          sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
          setStep("PAID");
        }
      } catch {
        // Polling is best-effort; the Brick and webhook remain the source of truth.
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [clearCart, orderData, step]);

  const menuIndexes = useMemo(() => buildMenuIndexes(menuData), [menuData]);

  const selectedCategory = useMemo(() => {
    return menuData?.categories.find((category) => category.id === selectedCategoryId);
  }, [menuData, selectedCategoryId]);

  const categoryProducts = useMemo(() => {
    if (!menuData || !selectedCategoryId) return [];
    return menuData.products.filter((product) => product.category_id === selectedCategoryId);
  }, [menuData, selectedCategoryId]);

  const categoryFilters = useMemo(() => {
    if (!selectedCategory || !menuIndexes) return [ALL_FILTER];
    const tags = new Set<string>();
    for (const product of categoryProducts) {
      getProductTags(product, selectedCategory.name, menuIndexes).forEach((tag) => tags.add(tag));
    }
    return [ALL_FILTER, ...Array.from(tags)];
  }, [categoryProducts, menuIndexes, selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (selectedFilter === ALL_FILTER || !selectedCategory) return categoryProducts;
    return categoryProducts.filter((product) =>
      getProductTags(product, selectedCategory.name, menuIndexes).includes(selectedFilter),
    );
  }, [categoryProducts, menuIndexes, selectedCategory, selectedFilter]);

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
  const estimatedTotal = estimatedSubtotal + estimatedPackagingFee;
  const selectedAddonCount = useMemo(() => {
    let count = 0;
    selectedAddons.forEach((qty) => {
      count += qty;
    });
    return count;
  }, [selectedAddons]);

  const openCustomization = useCallback((product: Product, existingItem?: CartItem) => {
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
  }, []);

  const closeCustomization = useCallback(() => {
    setSelectedProduct(null);
    setEditingCartItemId(null);
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

    closeCustomization();
  }, [
    addItem,
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

  const handleCreateOrder = async () => {
    if (isSubmittingOrder || orderData) return;
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
      setCheckoutError(err instanceof Error ? err.message : "Nao foi possivel validar o horario de atendimento.");
      return;
    }
    if (items.length === 0) {
      setCheckoutError("Seu carrinho esta vazio.");
      return;
    }
    const normalizedPhone = normalizeBrazilPhone(customerPhone);
    if (!normalizedPhone) {
      setCheckoutError("Informe um WhatsApp valido com DDD.");
      return;
    }
    if (!customerName.trim()) {
      setCheckoutError("Informe seu nome para continuar.");
      return;
    }
    if (customerEmail.trim() && !isValidEmail(customerEmail)) {
      setCheckoutError("Se informar e-mail, use um endereco valido.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const response = await pdvApi.createPublicOrder({
        order_type: orderType,
        customer_name: customerName.trim(),
        customer_phone: normalizedPhone,
        customer_email: customerEmail.trim() || undefined,
        marketing_opt_in: marketingOptIn,
        remember_checkout_data: rememberCheckoutData,
        notes: orderNotes.trim() || undefined,
        payment_method_code: PAYMENT_METHOD_CODE,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          removed_ingredient_ids: item.removed_ingredients,
          addons: item.addons.map((addon) => ({ addon_id: addon.addon_id, quantity: addon.quantity })),
          notes: item.notes,
        })),
      });

      setOrderData(response.order);
      if (rememberCheckoutData) {
        savePublicProfile({
          phone_e164: normalizedPhone,
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          order_type: orderType,
          marketing_opt_in: marketingOptIn,
          saved_at: new Date().toISOString(),
        });
      } else {
        localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
      }
      sessionStorage.setItem(PUBLIC_ORDER_STORAGE_KEY, JSON.stringify({
        order: response.order,
        customerEmail: customerEmail.trim(),
      }));
      setPaymentResult(null);
      setPaymentMode("PIX");
      setStep("PAYMENT");
    } catch (err) {
      if (err instanceof OrderingClosedError) {
        setOnlineOrderingEnabled(false);
        setOrderingClosedReason(err.message);
        clearCart();
      } else {
        setCheckoutError(err instanceof Error ? err.message : "Erro ao criar pedido.");
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F8F9FA] text-zinc-500">
        <RefreshCw className="h-7 w-7 animate-spin text-brand-red" />
        <p className="text-xs font-black uppercase tracking-widest">Carregando cardapio</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F9FA] p-6 text-center">
        <AlertCircle className="h-12 w-12 text-brand-red" />
        <h1 className="text-lg font-black uppercase text-zinc-900">Nao foi possivel abrir o cardapio</h1>
        <p className="text-sm font-medium text-zinc-500">{error}</p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  if (!onlineOrderingEnabled) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FFF7ED] text-zinc-950">
        <header className="border-b border-amber-900/10 bg-[#fffaf2]/95 px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-white shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-zinc-950">Marcos Krep&apos;s</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Pedido online</p>
            </div>
          </div>
        </header>
        <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Clock className="h-10 w-10" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-brand-red">Pedidos pausados</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950">No momento nao estamos recebendo pedidos.</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-zinc-600">
              {orderingClosedReason || `O atendimento online funciona das ${orderingSchedule.start} as ${orderingSchedule.end}.`}
            </p>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-zinc-600">
              Enquanto isso, siga o Marcos Krep&apos;s no Instagram para acompanhar novidades e avisos.
            </p>
          </div>
          <div className="grid w-full max-w-xs gap-3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center rounded-xl bg-brand-red px-4 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-brand-red/20"
            >
              Seguir no Instagram
            </a>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Verificar novamente
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF7ED] pb-32 text-zinc-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.16),transparent_30%),linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.92)_45%,rgba(254,243,199,0.65))]" />
      <header className="sticky top-0 z-40 border-b border-amber-900/10 bg-[#fffaf2]/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-white shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-zinc-950">Marcos Krep&apos;s</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Pedido online</p>
            </div>
          </div>
          {step !== "MENU" && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStep("MENU")}>
              <ChevronLeft className="h-4 w-4" />
              Cardapio
            </Button>
          )}
        </div>
      </header>

      {step === "MENU" && (
        <main className="mx-auto max-w-7xl space-y-5 p-4 xl:px-6">
          <section className="overflow-hidden rounded-2xl border border-amber-900/10 bg-[#2A1612] p-4 text-white shadow-sm md:p-6">
            <div className="flex items-start gap-3 md:items-center md:justify-between">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red">
                <Utensils className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Monte do seu jeito</p>
                <h2 className="mt-1 text-xl font-black leading-tight md:text-3xl">Krep caprichado, pedido sem fila.</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-amber-100/85">
                  Escolha o recheio, ajuste a composicao e finalize com pagamento seguro quando estiver tudo certo.
                </p>
              </div>
              <div className="hidden rounded-2xl bg-white/10 px-4 py-3 text-right md:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Hoje</p>
                <p className="text-lg font-black text-white">{items.length} item(ns)</p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-4">
          <section className="flex gap-2 overflow-x-auto rounded-2xl border border-amber-900/10 bg-white/80 p-2 shadow-sm hide-scrollbar">
            {menuData?.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setSelectedFilter(ALL_FILTER);
                }}
                className={`h-11 shrink-0 rounded-xl px-4 text-xs font-black uppercase tracking-wide transition-all ${
                  selectedCategoryId === category.id
                    ? "bg-brand-charcoal text-white shadow-sm"
                    : "text-zinc-600 hover:bg-amber-50"
                }`}
              >
                {category.name}
              </button>
            ))}
          </section>

          {categoryFilters.length > 1 && (
            <section className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {categoryFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedFilter(filter)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wide transition-all ${
                    selectedFilter === filter
                      ? "bg-zinc-950 text-white"
                      : "border border-amber-900/10 bg-white/85 text-zinc-600"
                  }`}
                >
                  {filter === ALL_FILTER ? <Search className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                  {filter}
                </button>
              ))}
            </section>
          )}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const { code, title } = splitProductName(product.name);
              const tags = getProductTags(product, selectedCategory?.name, menuIndexes);
              const summary = getProductSummary(product, selectedCategory?.name, menuIndexes);
              const categoryKind = getCategoryKind(selectedCategory?.name);

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => openCustomization(product)}
                  className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border border-amber-900/10 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-red/30 hover:shadow-xl hover:shadow-amber-950/10 active:scale-[0.98]"
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-brand-red/85" />
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#FFF1C9] text-brand-red transition-transform duration-300 group-hover:scale-105">
                      {categoryKind === "SAVORY" ? (
                        <Flame className="h-6 w-6" />
                      ) : categoryKind === "SWEET" ? (
                        <Sparkles className="h-6 w-6" />
                      ) : categoryKind === "DRINK" ? (
                        <Package className="h-6 w-6" />
                      ) : (
                        <Utensils className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {code && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-500">
                            {code}
                          </span>
                        )}
                        {tags[0] && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-brand-red">
                            {tags[0] === "Vegetariano" ? <Leaf className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                            {tags[0]}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 line-clamp-2 text-base font-black leading-tight text-zinc-950">{title}</h2>
                      <p className="mt-1 line-clamp-3 text-xs font-semibold leading-relaxed text-zinc-500">{summary}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <p className="text-lg font-black text-brand-red">{currency.format(product.price)}</p>
                    <span className="flex h-9 items-center gap-1 rounded-xl bg-brand-red px-3 text-xs font-black uppercase tracking-wide text-white transition-colors group-hover:bg-brand-charcoal">
                      <Plus className="h-5 w-5" />
                      Montar
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-24 space-y-3 rounded-2xl border border-amber-900/10 bg-white/95 p-4 shadow-xl shadow-amber-950/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Seu pedido</p>
                    <h2 className="text-lg font-black text-zinc-950">Carrinho</h2>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center">
                    <p className="text-sm font-bold text-zinc-500">Escolha um krep para montar seu pedido.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                          <div className="flex items-start gap-2">
                            <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-zinc-600">{item.quantity}x</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-zinc-900">{item.product.name}</p>
                              {item.addons.length > 0 && (
                                <p className="mt-0.5 truncate text-xs font-bold text-emerald-600">
                                  + {item.addons.map((addon) => `${addon.quantity}x ${addon.addon_name}`).join(", ")}
                                </p>
                              )}
                            </div>
                            <button className="rounded-lg bg-white p-2 text-red-500" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-4">
                      <div className="flex items-center justify-between text-sm font-black text-zinc-700">
                        <span>Total estimado</span>
                        <span className="text-xl text-brand-red">{currency.format(estimatedTotal)}</span>
                      </div>
                      <Button className="mt-3 w-full gap-2" onClick={() => setStep("CHECKOUT")}>
                        <CreditCard className="h-4 w-4" />
                        Fechar pedido
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      )}

      {step === "CHECKOUT" && (
        <main className="mx-auto max-w-6xl space-y-4 p-4 xl:px-6">
          <section className="rounded-2xl border border-amber-900/10 bg-[#2A1612] p-4 text-white shadow-sm md:p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Revisao final</p>
            <h2 className="mt-1 text-xl font-black md:text-2xl">Confira seu pedido e continue para o pagamento.</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-amber-100/85">
              Seu pedido so vai para preparo depois que o pagamento for confirmado.
            </p>
          </section>

          <section className="grid grid-cols-4 gap-2 rounded-2xl border border-amber-900/10 bg-white/90 p-2 text-center shadow-sm">
            {["Cardapio", "Revisao", "Pagamento", "Acompanhar"].map((label, index) => (
              <div
                key={label}
                className={`rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-wide ${
                  index <= 1 ? "bg-brand-red text-white" : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {label}
              </div>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <section className="rounded-2xl border border-amber-900/10 bg-white/95 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Seu pedido</p>
                  <h2 className="mt-1 text-xl font-black text-zinc-950">Itens escolhidos</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep("MENU")}>
                  Adicionar mais
                </Button>
              </div>

              <div className="mt-3 divide-y divide-zinc-100">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-3">
                    <span className="rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">{item.quantity}x</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-zinc-900">{item.product.name}</p>
                      {item.addons.length > 0 && (
                        <p className="mt-0.5 text-xs font-bold text-emerald-600">
                          + {item.addons.map((addon) => `${addon.quantity}x ${addon.addon_name}`).join(", ")}
                        </p>
                      )}
                      {item.notes && <p className="mt-0.5 text-xs italic text-zinc-400">{item.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-lg bg-zinc-100 p-2 text-zinc-500 transition-all hover:bg-zinc-200"
                        onClick={() => openCustomization(item.product, item)}
                        aria-label="Editar item"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-red-50 p-2 text-red-500 transition-all hover:bg-red-100"
                        onClick={() => removeItem(item.id)}
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                <div className="flex items-center justify-between text-sm font-black text-zinc-700">
                  <span>Subtotal dos itens</span>
                  <span className="text-xl text-brand-red">{currency.format(estimatedSubtotal)}</span>
                </div>
                {estimatedPackagingFee > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-zinc-500">
                    <span>Embalagem para viagem</span>
                    <span>{currency.format(estimatedPackagingFee)}</span>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Seus dados</p>
                  <h2 className="mt-1 text-xl font-black text-zinc-950">Comece pelo WhatsApp</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-500">
                    Se voce salvou seus dados antes, o restante aparece automaticamente pelo numero.
                  </p>
                </div>
                {profileLookupState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-brand-red" />}
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-400">WhatsApp</span>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerInfo(customerName, formatWhatsAppInput(event.target.value))}
                  onBlur={() => setCustomerInfo(customerName, formatWhatsAppInput(customerPhone))}
                  placeholder="(11) 99999-9999"
                  type="tel"
                  inputMode="tel"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none transition-all focus:border-brand-red focus:bg-white"
                />
              </label>
              {profileNotice && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                  {profileNotice}
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-400">Nome</span>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerInfo(event.target.value, customerPhone)}
                  placeholder="Como podemos chamar voce?"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none transition-all focus:border-brand-red focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-400">E-mail</span>
                <input
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="Opcional, usado no Pix"
                  type="email"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none transition-all focus:border-brand-red focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType("BALCAO")}
                  className={`rounded-2xl border-2 p-3 text-xs font-black uppercase transition-all ${
                    orderType === "BALCAO" ? "border-brand-charcoal bg-brand-charcoal text-white" : "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }`}
                >
                  Comer aqui
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("VIAGEM")}
                  className={`rounded-2xl border-2 p-3 text-xs font-black uppercase transition-all ${
                    orderType === "VIAGEM" ? "border-brand-charcoal bg-brand-charcoal text-white" : "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }`}
                >
                  Para levar
                </button>
              </div>

              <textarea
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                placeholder="Alguma observacao para a equipe?"
                className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-bold outline-none transition-all focus:border-brand-red focus:bg-white"
              />

              <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-600">
                <input
                  type="checkbox"
                  checked={rememberCheckoutData}
                  onChange={(event) => setRememberCheckoutData(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-red"
                />
                <span>Salvar estes dados para preencher automaticamente nos proximos pedidos.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-600">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(event) => setMarketingOptIn(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-red"
                />
                <span>Quero receber novidades e promocoes pelo WhatsApp.</span>
              </label>
              {rememberCheckoutData && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
                    setRememberCheckoutData(false);
                    setProfileNotice("Dados salvos removidos deste dispositivo.");
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-500 transition-all hover:bg-zinc-50"
                >
                  Remover dados salvos deste dispositivo
                </button>
              )}

              <div className="rounded-2xl bg-zinc-950 p-4 text-white">
                <div className="space-y-2 text-sm font-bold text-zinc-200">
                  <div className="flex items-center justify-between">
                    <span>Itens</span>
                    <span>{currency.format(estimatedSubtotal)}</span>
                  </div>
                  {estimatedPackagingFee > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Embalagem</span>
                      <span>{currency.format(estimatedPackagingFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-lg font-black text-white">
                    <span>Total</span>
                    <span className="text-amber-200">{currency.format(estimatedTotal)}</span>
                  </div>
                </div>
              </div>

              {checkoutError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {checkoutError}
                </div>
              )}

              <Button className="h-12 w-full gap-2" loading={isSubmittingOrder} onClick={handleCreateOrder}>
                <CreditCard className="h-4 w-4" />
                Continuar para pagamento
              </Button>
            </section>
          </div>
        </main>
      )}

      {step === "PAYMENT" && orderData && (
        <main className="mx-auto max-w-3xl space-y-4 p-4">
          <section className="rounded-2xl border border-amber-900/10 bg-[#2A1612] p-4 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-amber-200">Pagamento seguro</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-black">#{String(orderData.daily_number).padStart(3, "0")}</h2>
                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-200">
                  <Clock className="h-3.5 w-3.5" />
                  Finalize para enviar
                </p>
              </div>
              <p className="text-2xl font-black text-amber-100">{currency.format(orderData.total_amount)}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/10 p-2">
                <CreditCard className="mx-auto h-4 w-4 text-amber-200" />
                <p className="mt-1 text-[10px] font-black uppercase text-amber-100">Cartao</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2">
                <QrCode className="mx-auto h-4 w-4 text-amber-200" />
                <p className="mt-1 text-[10px] font-black uppercase text-amber-100">Pix</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2">
                <ShieldCheck className="mx-auto h-4 w-4 text-amber-200" />
                <p className="mt-1 text-[10px] font-black uppercase text-amber-100">Seguro</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <button
              type="button"
              onClick={() => setPaymentMode("PIX")}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black uppercase transition-all ${
                paymentMode === "PIX" ? "bg-teal-700 text-white" : "text-zinc-500"
              }`}
            >
              <QrCode className="h-4 w-4" />
              Pix
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("CARD")}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black uppercase transition-all ${
                paymentMode === "CARD" ? "bg-brand-charcoal text-white" : "text-zinc-500"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Cartao
            </button>
          </section>

          <section className="grid grid-cols-4 gap-2 rounded-2xl border border-amber-900/10 bg-white/90 p-2 text-center shadow-sm">
            {["Cardapio", "Revisao", "Pagamento", "Acompanhar"].map((label, index) => (
              <div
                key={label}
                className={`rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-wide ${
                  index <= 2 ? "bg-brand-red text-white" : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {label}
              </div>
            ))}
          </section>

          {paymentMode === "PIX" ? (
            <PixCheckout
              order={orderData}
              payerEmail={customerEmail}
              onPayerEmailChange={(email) => {
                setCustomerEmail(email);
                sessionStorage.setItem(PUBLIC_ORDER_STORAGE_KEY, JSON.stringify({
                  order: orderData,
                  customerEmail: email.trim(),
                }));
              }}
              onPaid={() => {
                clearCart();
                sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
                setStep("PAID");
              }}
            />
          ) : (
            <MercadoPagoBrick
              order={orderData}
              onResult={setPaymentResult}
              onPaid={() => {
                clearCart();
                sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
                setStep("PAID");
              }}
            />
          )}

          {paymentMode === "CARD" && paymentResult && <PixResult payment={paymentResult} />}
        </main>
      )}

      {step === "PAID" && (
        <main className="mx-auto flex max-w-xl flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Pagamento aprovado</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-900">Pedido recebido</h2>
            <p className="mt-2 text-sm font-medium text-zinc-500">A equipe ja recebeu a confirmacao e vai preparar seu pedido.</p>
          </div>
          <div className="grid w-full max-w-sm gap-3">
            {orderData && (
              <Button
                onClick={() => router.push(`/pedido/${encodeURIComponent(orderData.public_token)}`)}
              >
                Acompanhar pedido #{String(orderData.daily_number).padStart(3, "0")}
              </Button>
            )}
            <Button variant="outline" onClick={() => {
              setOrderData(null);
              setPaymentResult(null);
              sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
              setStep("MENU");
            }}>
              Fazer novo pedido
            </Button>
          </div>
        </main>
      )}

      {items.length > 0 && step === "MENU" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-4 shadow-2xl xl:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-charcoal text-white">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">{items.length} item(ns)</p>
              <p className="text-lg font-black text-zinc-900">{currency.format(estimatedTotal)}</p>
            </div>
            <Button onClick={() => setStep("CHECKOUT")}>Ver carrinho</Button>
          </div>
        </div>
      )}

      <BottomSheet
        isOpen={!!selectedProduct}
        onClose={closeCustomization}
        title={editingCartItemId ? "Editar item" : "Personalizar item"}
      >
        {selectedProduct && (
          <div className="space-y-6 p-5 pb-8">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {getProductTags(selectedProduct, selectedProductCategory?.name, menuIndexes).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase text-brand-red"
                  >
                    {tag === "Vegetariano" ? <Leaf className="h-3.5 w-3.5" /> : <Flame className="h-3.5 w-3.5" />}
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-lg font-black uppercase text-zinc-900">{splitProductName(selectedProduct.name).title}</h2>
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-relaxed text-amber-950">
                {getProductSummary(selectedProduct, selectedProductCategory?.name, menuIndexes)}
              </p>
              <p className="mt-1 text-xl font-black text-brand-red">{currency.format(selectedProduct.price)}</p>
            </div>

            {productDefaultIngredients.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Composicao do krep</p>
                {productDefaultIngredients.map((ingredient) => {
                  const isIncluded = !removedIngredientIds.has(ingredient.id);
                  return (
                    <label key={ingredient.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
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
                        className="h-5 w-5 accent-brand-red"
                      />
                      <span className={`font-bold ${isIncluded ? "text-zinc-800" : "text-zinc-300 line-through"}`}>
                        {ingredient.name}
                      </span>
                    </label>
                  );
                })}
              </section>
            )}

            {productAddons.length > 0 && (
              <section className="rounded-2xl border-2 border-dashed border-brand-red/25 bg-amber-50/75 p-3">
                <button
                  type="button"
                  onClick={() => setAddonsExpanded((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-brand-red">Adicionais</p>
                    <h3 className="mt-1 text-base font-black text-zinc-950">Quer deixar ainda melhor?</h3>
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      {selectedAddonCount > 0
                        ? `${selectedAddonCount} adicional(is) selecionado(s)`
                        : `${productAddons.length} opcoes para turbinar seu pedido`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-brand-red px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-sm">
                    {addonsExpanded ? "Fechar" : "Ver adicionais"}
                  </span>
                </button>

                {addonsExpanded && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {productAddons.map((addon) => {
                      const qty = selectedAddons.get(addon.id) || 0;
                      return (
                        <div key={addon.id} className="rounded-2xl border border-amber-900/10 bg-white p-3 shadow-sm">
                          <p className="text-sm font-black text-zinc-900">{addon.name}</p>
                          <p className="mt-1 text-sm font-black text-brand-red">+ {currency.format(addon.price)}</p>
                          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-100 p-1">
                            <button
                              type="button"
                              className="rounded-lg bg-white p-2 text-zinc-500"
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
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="font-black">{qty}</span>
                            <button
                              type="button"
                              className="rounded-lg bg-white p-2 text-brand-red"
                              onClick={() => {
                                setSelectedAddons((current) => {
                                  const next = new Map(current);
                                  next.set(addon.id, qty + 1);
                                  return next;
                                });
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Observacao</p>
              <textarea
                value={itemNotes}
                onChange={(event) => setItemNotes(event.target.value)}
                placeholder="Ex: sem sal, bem passado..."
                className="h-24 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-bold outline-none focus:border-brand-red"
              />
            </section>

            <div className="flex items-center gap-3">
              <div className="flex h-14 items-center gap-3 rounded-xl bg-zinc-100 p-1">
                <button className="rounded-lg bg-white p-3 text-zinc-500" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-lg font-black">{quantity}</span>
                <button className="rounded-lg bg-white p-3 text-brand-red" onClick={() => setQuantity(quantity + 1)}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button className="h-14 flex-1" onClick={handleAddToCart}>
                {editingCartItemId ? "Salvar" : "Adicionar"} - {currency.format(sheetSubtotal)}
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
