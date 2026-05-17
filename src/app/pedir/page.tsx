"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
const SITE_BASE = "https://marcoskreps.com.br";
const PIX_WAIT_MINUTES = 5;
const PUBLIC_ORDER_STORAGE_KEY = "pdv-public-order";
const PUBLIC_CUSTOMER_PROFILE_KEY = "pdv-public-customer-profile";
const PENDING_ORDER_RESTORE_MS = 20 * 60 * 1000;

type SavedPublicCustomerProfile = {
  phone_e164: string;
  name: string;
  email?: string;
  order_type: "BALCAO" | "VIAGEM";
  marketing_opt_in: boolean;
  saved_at: string;
};

type SavedPublicOrderSession = {
  order?: CreatePublicOrderResponse["order"];
  customerEmail?: string;
  saved_at?: string;
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
    if (normalizedName.includes("refrigerante")) return ["Refrigerante", "Geladas"];
    if (normalizedName.includes("h2o")) return ["H2O", "Geladas"];
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

function clearSavedPublicOrderSession() {
  sessionStorage.removeItem(PUBLIC_ORDER_STORAGE_KEY);
}

function savePublicOrderSession(order: CreatePublicOrderResponse["order"], customerEmail: string) {
  sessionStorage.setItem(PUBLIC_ORDER_STORAGE_KEY, JSON.stringify({
    order,
    customerEmail: customerEmail.trim(),
    saved_at: new Date().toISOString(),
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

// ── UI helpers do /pedir ──────────────────────────────────────────────────

/** Progress indicator no topo das telas pós-cardápio.
 * 5 steps: Cardápio (0), Itens (1), Dados (2), Pagamento (3), Pronto (4). */
function ProgressSteps({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  const steps = ["Cardápio", "Itens", "Dados", "Pagamento", "Pronto"];
  return (
    <nav aria-label="Progresso do pedido" className="flex items-center gap-2">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isDone
                    ? "bg-brand-red text-white"
                    : isCurrent
                      ? "bg-brand-red text-white shadow-[var(--shadow-sm)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> : i + 1}
              </span>
              <span
                className={`text-xs truncate ${
                  isCurrent
                    ? "font-semibold text-[var(--text-primary)]"
                    : isDone
                      ? "font-medium text-[var(--text-secondary)]"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`h-px flex-1 ${i < current ? "bg-brand-red" : "bg-[var(--border)]"}`} aria-hidden />
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Input com floating label estilo Material 3 — label sobe quando há valor ou foco. */
function FloatingInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  help?: string;
}) {
  const filled = value.length > 0;
  return (
    <label className="block">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={filled ? placeholder : ""}
          type={type}
          inputMode={inputMode}
          className="peer w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 pt-6 pb-2 text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
          style={{ height: 56 }}
        />
        <span
          className={`pointer-events-none absolute left-4 text-[var(--text-secondary)] transition-all ${
            filled
              ? "top-2 text-[11px] font-medium"
              : "top-4 text-sm peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-medium"
          }`}
        >
          {label}
        </span>
      </div>
      {help && (
        <span className="mt-1 block text-[11px] leading-relaxed text-[var(--text-muted)]">
          {help}
        </span>
      )}
    </label>
  );
}

/** Item de timeline vertical na tela de acompanhamento. */
function TimelineStep({
  label,
  done,
  active,
  isLast,
}: { label: string; done?: boolean; active?: boolean; isLast?: boolean }) {
  return (
    <li className="relative flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            done
              ? ""
              : active
                ? "bg-brand-red text-white"
                : "border-2 border-[var(--border-strong)]"
          }`}
          style={done ? { backgroundColor: "var(--status-success)", color: "white" } : undefined}
        >
          {done && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />}
          {active && <span className="h-2 w-2 rounded-full bg-white animate-pulse" />}
        </span>
        {!isLast && (
          <span
            className={`mt-1 h-6 w-px ${done ? "bg-[var(--status-success)]" : "bg-[var(--border)]"}`}
            aria-hidden
          />
        )}
      </div>
      <span
        className={`text-sm pt-0.5 ${
          done
            ? "text-[var(--text-primary)] font-medium"
            : active
              ? "font-semibold text-[var(--text-primary)]"
              : "text-[var(--text-muted)]"
        }`}
      >
        {label}
      </span>
    </li>
  );
}

export default function PedirPublicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _rawBranch = searchParams.get("branch");
  // Guarda contra a string literal "undefined" que pode aparecer quando
  // encodeURIComponent(undefined) é chamado no redirect de /pedir/[slug].
  const branchSlug = (_rawBranch && _rawBranch !== "undefined") ? _rawBranch : undefined;
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
  } = useCart();

  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
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
  const lastAutofilledPhoneRef = useRef<string | null>(null);
  // Latest customerName captured for use inside the debounced profile lookup;
  // keeps the autofill effect from re-running on every keystroke in the name field.
  const customerNameRef = useRef(customerName);
  useEffect(() => {
    customerNameRef.current = customerName;
  }, [customerName]);

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
        if (!config.success) throw new Error(config.error || "Erro ao carregar configuracoes de pedido.");
        const resolvedBranchId = config.branch?.id ?? null;
        setBranchId(resolvedBranchId);
        setBranchName(config.branch?.name ?? null);
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
        setError(err instanceof Error ? err.message : "Erro ao carregar cardapio.");
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCart, branchSlug]);

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
  }, [clearCart]);

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
        setOrderType(saved.order_type);
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
          if (response.profile.order_type === "BALCAO" || response.profile.order_type === "VIAGEM") {
            setOrderType(response.profile.order_type);
          }
          setRememberCheckoutData(true);
          lastAutofilledPhoneRef.current = normalizedPhone;
          setProfileLookupState("found");
          setProfileNotice("Encontrei seus dados salvos pelo WhatsApp.");
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
          clearSavedPublicOrderSession();
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
  const estimatedTotal = estimatedSubtotal + estimatedPackagingFee;
  const checkoutPhone = useMemo(() => normalizeBrazilPhone(customerPhone), [customerPhone]);
  const shouldShowCheckoutDetails = !!checkoutPhone && profileLookupState !== "checking";
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
        branch_slug: branchSlug,
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
      savePublicOrderSession(response.order, customerEmail);
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
      <div className="flex min-h-screen flex-col bg-[#FFF7ED] text-brand-charcoal">
        <header className="border-b border-amber-900/10 bg-[#fffaf2]/95 px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <Image
              src="/logo.png"
              alt="Marcos Krep's"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-xl"
              priority
            />
            <div>
              <h1 className="text-base font-black text-brand-charcoal">Marcos Krep&apos;s</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">
                {branchName ?? "Pedido online"}
              </p>
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
    <div className="min-h-screen pb-32 text-[var(--text-primary)]" style={{ backgroundColor: "var(--bg-base)" }}>
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)] px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur"
        style={{ backgroundColor: "rgba(255, 251, 246, 0.92)" }}
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
                onClick={() => router.push(`/pedido/${encodeURIComponent(orderData.public_token)}`)}
                className="flex items-center gap-1.5 rounded-full bg-[var(--status-success-bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--status-success)] hover:opacity-90 animate-pulse"
              >
                <Package className="h-3.5 w-3.5" strokeWidth={1.75} />
                Pedido #{String(orderData.daily_number).padStart(3, "0")} em andamento
              </button>
            )}
            {step !== "MENU" && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStep("MENU")}>
                <ChevronLeft className="h-4 w-4" />
                Cardapio
              </Button>
            )}
          </div>
        </div>
      </header>

      {step === "MENU" && (
        <main className="mx-auto max-w-7xl space-y-5 p-4 xl:px-6">
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
                {/* Social proof — só mostra se houver dado */}
                {publicStats.ordersToday > 0 && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)]">
                    🔥 {publicStats.ordersToday} {publicStats.ordersToday === 1 ? "pedido feito" : "pedidos feitos"} hoje
                  </p>
                )}
              </div>

              {/* Carrinho compacto no canto direito (desktop) */}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("REVIEW")}
                  className="hidden md:flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left hover:bg-white/15"
                >
                  <ShoppingCart className="h-5 w-5 text-white" strokeWidth={1.75} />
                  <div className="leading-tight">
                    <p className="text-[11px] text-white/70">Seu pedido</p>
                    <p className="text-sm font-semibold text-white tabular-nums">{items.length} {items.length === 1 ? "item" : "itens"} · {currency.format(estimatedTotal)}</p>
                  </div>
                </button>
              )}
            </div>
          </section>

          {/* Tabs sticky — colado abaixo do header (h-14).
             Mobile: fundo em superfície branca (contraste com bege da página)
             + sombra sutil para destacar a elevação durante scroll.
             Pílulas mais compactas pra caber mais categorias no viewport. */}
          <div
            className="sticky top-14 z-30 -mx-4 px-3 py-2 border-b border-[var(--border)] shadow-[var(--shadow-sm)]"
            style={{ backgroundColor: "var(--bg-surface)" }}
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
                            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                              🔥 Mais pedido
                            </span>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-brand-red">
                              {categoryKind === "SAVORY" ? <Flame className="h-6 w-6" strokeWidth={1.75} />
                              : categoryKind === "SWEET" ? <Sparkles className="h-6 w-6" strokeWidth={1.75} />
                              : categoryKind === "DRINK" ? <Package className="h-6 w-6" strokeWidth={1.75} />
                              : <Utensils className="h-6 w-6" strokeWidth={1.75} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {code && (
                                  <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums">#{code}</span>
                                )}
                                {tags[0] && tags[0] !== "Outros" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-semibold text-brand-red">
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

                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-5 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">Escolha um krep para montar seu pedido.</p>
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
                              className="rounded-lg bg-[var(--bg-surface)] p-1.5 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
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
          {items.length > 0 && (
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
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-brand-red ring-2 ring-[var(--bg-inverse)]">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 text-left leading-tight">
                  <p className="text-[11px] text-white/60">{items.length === 1 ? "1 item no pedido" : `${items.length} itens no pedido`}</p>
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
                      className="rounded-lg bg-[var(--bg-subtle)] p-2 text-[var(--text-secondary)] hover:bg-[var(--border)] ml-2"
                      onClick={() => openCustomization(item.product, item)}
                      aria-label="Editar item"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--status-danger-bg)] p-2 text-[var(--status-danger)] hover:opacity-80"
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
          </section>

          <button
            type="button"
            onClick={() => setStep("INFO")}
            disabled={items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-45"
            style={{ height: 52 }}
          >
            Continuar
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
        </main>
      )}

      {/* ── Tela 4: INFO — dados do cliente + modalidade ───────────────── */}
      {step === "INFO" && (
        <main className="mx-auto max-w-2xl space-y-4 p-4">
          <ProgressSteps current={2} />

          <button
            type="button"
            onClick={() => setStep("REVIEW")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar para itens
          </button>

          <section className="rounded-2xl px-5 py-4 text-white shadow-[var(--shadow-sm)]" style={{ backgroundColor: "var(--bg-inverse)" }}>
            <h2 className="text-lg font-semibold tracking-tight md:text-xl">Seus dados</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              Identifique-se pelo WhatsApp. Já pediu antes? Preenchemos automaticamente.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
            <FloatingInput
              label="Seu WhatsApp com DDD"
              value={customerPhone}
              onChange={(v) => setCustomerInfo(customerName, formatWhatsAppInput(v))}
              onBlur={() => setCustomerInfo(customerName, formatWhatsAppInput(customerPhone))}
              placeholder="(11) 99999-9999"
              type="tel"
              inputMode="tel"
              help="Avisamos você por aqui quando o pedido for confirmado e quando ficar pronto. Para sair, responda PARAR."
            />

            {!checkoutPhone && (
              <div className="rounded-xl bg-[var(--brand-light)] border border-brand-red/15 p-3 text-sm leading-relaxed text-[var(--text-primary)]">
                Digite seu WhatsApp com DDD. Se seus dados estiverem salvos, a gente preenche o resto.
              </div>
            )}

            {checkoutPhone && profileLookupState === "checking" && (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-subtle)] p-3 text-sm text-[var(--text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin text-brand-red" />
                Procurando dados salvos para esse WhatsApp...
              </div>
            )}

            {shouldShowCheckoutDetails && (
              <>
                {profileNotice && (
                  <div className="rounded-xl bg-[var(--status-success-bg)] px-3 py-2 text-xs font-medium text-[var(--status-success)]">
                    {profileNotice}
                  </div>
                )}
                {profileLookupState === "not_found" && (
                  <div className="rounded-xl bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--status-warning)]">
                    Não encontrei dados salvos. Complete rapidinho abaixo.
                  </div>
                )}

                <FloatingInput
                  label="Nome completo"
                  value={customerName}
                  onChange={(v) => setCustomerInfo(v, customerPhone)}
                  placeholder="Como podemos chamar você?"
                />

                <FloatingInput
                  label="E-mail (opcional)"
                  value={customerEmail}
                  onChange={setCustomerEmail}
                  placeholder="usado no PIX"
                  type="email"
                />

                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">Modalidade</p>
                  <div className="flex rounded-xl bg-[var(--bg-subtle)] p-1">
                    {([{ v: "BALCAO", label: "Comer aqui" }, { v: "VIAGEM", label: "Para levar" }] as const).map((opt) => {
                      const isActive = orderType === opt.v;
                      return (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setOrderType(opt.v)}
                          className={`flex-1 h-10 rounded-lg text-sm font-semibold ${
                            isActive ? "text-white shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          }`}
                          style={isActive ? { backgroundColor: "var(--bg-inverse)" } : undefined}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  placeholder="Alguma observação para a equipe?"
                  className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
                />

                <label className="flex items-start gap-3 cursor-pointer text-sm text-[var(--text-secondary)] py-1">
                  <input
                    type="checkbox"
                    checked={rememberCheckoutData}
                    onChange={(event) => setRememberCheckoutData(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-red"
                  />
                  <span>Salvar meus dados para os próximos pedidos</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer text-sm text-[var(--text-secondary)] py-1">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(event) => setMarketingOptIn(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-red"
                  />
                  <span>Receber promoções e novidades pelo WhatsApp</span>
                </label>
                {rememberCheckoutData && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(PUBLIC_CUSTOMER_PROFILE_KEY);
                      setRememberCheckoutData(false);
                      setProfileNotice("Dados salvos removidos deste dispositivo.");
                    }}
                    className="text-xs text-[var(--text-muted)] underline hover:text-[var(--text-secondary)] self-start"
                  >
                    Remover dados salvos neste dispositivo
                  </button>
                )}
              </>
            )}
          </section>

          {/* Resumo escuro com total */}
          <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: "var(--bg-inverse)" }}>
            <div className="space-y-1.5 text-sm text-white/75">
              <div className="flex items-center justify-between">
                <span>{items.length} {items.length === 1 ? "item" : "itens"}</span>
                <span className="tabular-nums">{currency.format(estimatedSubtotal)}</span>
              </div>
              {estimatedPackagingFee > 0 && (
                <div className="flex items-center justify-between">
                  <span>Embalagem</span>
                  <span className="tabular-nums">{currency.format(estimatedPackagingFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-1 text-base font-semibold text-white">
                <span>Total</span>
                <span className="text-xl tabular-nums" style={{ color: "var(--accent)" }}>{currency.format(estimatedTotal)}</span>
              </div>
            </div>
          </div>

          {checkoutError && (
            <div className="rounded-2xl bg-[var(--status-danger-bg)] p-3 text-sm font-medium text-[var(--status-danger)]">
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={isSubmittingOrder || !shouldShowCheckoutDetails || !customerName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ height: 52 }}
          >
            {isSubmittingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" strokeWidth={1.75} />}
            Continuar para pagamento
          </button>
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
                <p className="text-[11px] font-medium text-white/60">Pedido</p>
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
            onClick={() => {
              setOrderData(null);
              setPaymentResult(null);
              clearSavedPublicOrderSession();
              setStep("MENU");
            }}
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
                savePublicOrderSession(orderData, email);
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
        const waText = trackingUrl
          ? encodeURIComponent(`Acompanhe meu pedido #${orderNum} no Marcos Krep's:\n${trackingUrl}`)
          : null;

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
                <TimelineStep done label="Pedido recebido" />
                <TimelineStep active label="Em preparo" />
                <TimelineStep label={orderType === "VIAGEM" ? "Pronto para retirada" : "Pronto para servir"} />
                <TimelineStep label={orderType === "VIAGEM" ? "Entregue" : "Servido"} isLast />
              </ol>
            </section>

            {/* Notificação WhatsApp */}
            <div className="rounded-xl px-3 py-2.5 text-sm" style={{ backgroundColor: "var(--status-success-bg)", color: "var(--status-success)" }}>
              Você receberá uma mensagem no WhatsApp quando seu pedido estiver pronto.
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
                    className="shrink-0 rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    title="Copiar link"
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
                  onClick={() => router.push(`/pedido/${encodeURIComponent(orderData!.public_token)}`)}
                  className="flex items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
                  style={{ height: 52 }}
                >
                  <Package className="h-5 w-5" strokeWidth={1.75} />
                  Acompanhar pedido em tempo real
                </button>
              )}
              {waText && (
                <a
                  href={`https://wa.me/?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366] bg-[#25D366]/10 text-sm font-semibold text-[#128C7E] hover:bg-[#25D366]/20 active:scale-[0.98]"
                  style={{ height: 48 }}
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.75} />
                  Compartilhar link no WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setOrderData(null);
                  setPaymentResult(null);
                  clearSavedPublicOrderSession();
                  setStep("MENU");
                }}
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

      <BottomSheet
        isOpen={!!selectedProduct}
        onClose={closeCustomization}
        title={editingCartItemId ? "Editar item" : "Personalizar item"}
      >
        {selectedProduct && (
          <div className="p-5 pb-32">
            {/* Header do produto */}
            <div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {getProductTags(selectedProduct, selectedProductCategory?.name, menuIndexes)
                  .filter((t) => t !== "Outros")
                  .map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[11px] font-semibold text-brand-red"
                    >
                      {tag === "Vegetariano" ? <Leaf className="h-3 w-3" strokeWidth={1.75} /> : <Flame className="h-3 w-3" strokeWidth={1.75} />}
                      {tag}
                    </span>
                  ))}
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{splitProductName(selectedProduct.name).title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {getProductSummary(selectedProduct, selectedProductCategory?.name, menuIndexes)}
              </p>
              <p className="mt-2 text-xl font-bold text-brand-red tabular-nums">
                <span className="text-sm mr-0.5 font-medium opacity-70">R$</span>
                {selectedProduct.price.toFixed(2).replace(".", ",")}
              </p>
            </div>

            {/* Ingredientes */}
            {productDefaultIngredients.length > 0 && (
              <section className="mt-6 space-y-2">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Ingredientes</p>
                <div className="rounded-xl bg-[var(--bg-subtle)] divide-y divide-[var(--border)]">
                  {productDefaultIngredients.map((ingredient) => {
                    const isIncluded = !removedIngredientIds.has(ingredient.id);
                    return (
                      <label
                        key={ingredient.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--border)]/30"
                      >
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
                        <span className={`text-sm font-medium ${isIncluded ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] line-through"}`}>
                          {ingredient.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Adicionais — card destacado, "Quer deixar ainda melhor?" */}
            {productAddons.length > 0 && (
              <section
                className="mt-6 rounded-2xl border-2 border-dashed p-3"
                style={{ borderColor: "rgba(231, 51, 53, 0.25)", backgroundColor: "var(--brand-light)" }}
              >
                <button
                  type="button"
                  onClick={() => setAddonsExpanded((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-brand-red">Adicionais</p>
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
                              className="rounded-md bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] disabled:opacity-40"
                              disabled={qty === 0}
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
                              className="rounded-md bg-[var(--bg-surface)] p-1.5 text-brand-red"
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
            <section className="mt-6">
              <FloatingInput
                label="Observação"
                value={itemNotes}
                onChange={setItemNotes}
                placeholder="Ex: sem sal, bem passado..."
              />
            </section>

            {/* Footer sticky com quantidade + CTA */}
            <div
              className="sticky bottom-0 left-0 right-0 -mx-5 mt-6 px-5 py-3 border-t border-[var(--border)]"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-subtle)] p-1 h-12">
                  <button
                    className="rounded-lg bg-[var(--bg-surface)] p-2 text-[var(--text-secondary)] disabled:opacity-40"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Diminuir"
                  >
                    <Minus className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <span className="w-6 text-center text-base font-semibold text-[var(--text-primary)] tabular-nums">{quantity}</span>
                  <button
                    className="rounded-lg bg-[var(--bg-surface)] p-2 text-brand-red"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-[0.98]"
                  style={{ height: 52 }}
                >
                  <span>{editingCartItemId ? "Salvar" : "Adicionar"}</span>
                  <span className="tabular-nums">· {currency.format(sheetSubtotal)}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
