"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { pdvApi, CreatePublicOrderResponse, MercadoPagoPaymentResponse } from "@/lib/api/pdv-api";
import { settingsApi } from "@/lib/api/settings-api";
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
const ALL_FILTER = "Todos";
const DEFAULT_ORDERING_START = "17:00";
const DEFAULT_ORDERING_END = "23:30";
const ORDERING_TIME_ZONE = "America/Sao_Paulo";
const INSTAGRAM_URL = "https://www.instagram.com/marcos_kreps/";

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

function parseTimeToMinutes(value: string | undefined) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getSaoPauloMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: ORDERING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hours * 60 + minutes;
}

function isWithinOrderingWindow(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime) ?? parseTimeToMinutes(DEFAULT_ORDERING_START)!;
  const end = parseTimeToMinutes(endTime) ?? parseTimeToMinutes(DEFAULT_ORDERING_END)!;
  const now = getSaoPauloMinutes();
  if (start === end) return true;
  if (start < end) return now >= start && now <= end;
  return now >= start || now <= end;
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
              bankTransfer: "all",
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
              console.error("[MercadoPagoBrick] error", err);
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
          Cartao, Pix e outros meios aparecem conforme disponibilidade da sua conta Mercado Pago.
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

function PixResult({ payment }: { payment: MercadoPagoPaymentResponse }) {
  const transaction = payment.transaction;
  const qrBase64 = transaction?.qr_code_base64;
  const qrCode = transaction?.qr_code;
  const ticketUrl = transaction?.ticket_url;

  if (!qrBase64 && !qrCode && !ticketUrl) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-teal-100 bg-teal-50 p-4">
      <div className="flex items-center gap-2 text-teal-800">
        <QrCode className="h-4 w-4" />
        <p className="text-xs font-black uppercase tracking-widest">Pix gerado</p>
      </div>
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
          onClick={() => navigator.clipboard.writeText(qrCode)}
        >
          <Copy className="h-4 w-4" />
          Copiar codigo Pix
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

export default function PedirPublicPage() {
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
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderData, setOrderData] = useState<CreatePublicOrderResponse["order"] | null>(null);
  const [paymentResult, setPaymentResult] = useState<MercadoPagoPaymentResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const [data, settings] = await Promise.all([
          menuApi.getMenuData(),
          settingsApi.getSettings(),
        ]);
        const start = settings.public_ordering_start_time ?? DEFAULT_ORDERING_START;
        const end = settings.public_ordering_end_time ?? DEFAULT_ORDERING_END;
        const isEnabledByAdmin = settings.public_ordering_enabled !== "false";
        const isOpenBySchedule = isWithinOrderingWindow(start, end);
        const isEnabled = isEnabledByAdmin && isOpenBySchedule;
        const fee = Number(String(settings.packaging_fee ?? "0").replace(",", ".")) || 0;

        setOrderingSchedule({ start, end });
        setPackagingFee(fee);
        setApplyPackagingFeeForTakeout(settings.apply_packaging_fee_for_takeout === "true");
        setOnlineOrderingEnabled(isEnabled);
        setOrderingClosedReason(
          !isEnabledByAdmin
            ? "Os pedidos online foram pausados pelo administrador."
            : !isOpenBySchedule
              ? `No momento nao estamos recebendo pedidos. Atendimento online das ${start} as ${end}.`
              : "",
        );
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
    if (!orderData || step === "PAID") return;

    const interval = window.setInterval(async () => {
      try {
        const status = await pdvApi.getPublicOrderStatus({
          daily_number: orderData.daily_number,
          public_token: orderData.public_token,
        });
        if (status.order.payment_status === "PAID") {
          clearCart();
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

  const openCustomization = useCallback((product: Product, existingItem?: CartItem) => {
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
    setCheckoutError("");
    if (!onlineOrderingEnabled) {
      setCheckoutError(orderingClosedReason || "No momento nao estamos recebendo pedidos.");
      return;
    }
    if (items.length === 0) {
      setCheckoutError("Seu carrinho esta vazio.");
      return;
    }
    if (!customerEmail.trim()) {
      setCheckoutError("Informe um e-mail valido para o pagamento.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const response = await pdvApi.createPublicOrder({
        order_type: orderType,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim(),
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
      setStep("PAYMENT");
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erro ao criar pedido.");
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
        <div className="mx-auto flex max-w-3xl items-center justify-between">
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
        <main className="mx-auto max-w-3xl space-y-5 p-4">
          <section className="overflow-hidden rounded-2xl border border-amber-900/10 bg-[#2A1612] p-4 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red">
                <Utensils className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Escolha pelo recheio</p>
                <h2 className="mt-1 text-xl font-black leading-tight">Krep quentinho, pedido sem fila.</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-amber-100/85">
                  Veja a composicao de cada krep, filtre pela proteina ou base e finalize com pagamento seguro.
                </p>
              </div>
            </div>
          </section>

          <section className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {menuData?.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setSelectedFilter(ALL_FILTER);
                }}
                className={`h-11 shrink-0 rounded-xl px-4 text-xs font-black uppercase tracking-wide transition-all ${
                  selectedCategoryId === category.id
                    ? "bg-brand-red text-white shadow-sm"
                    : "border border-amber-900/10 bg-white/90 text-zinc-700"
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

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  className="flex min-h-36 flex-col rounded-2xl border border-amber-900/10 bg-white/95 p-4 text-left shadow-sm transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-brand-red">
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
                      <h2 className="mt-2 line-clamp-2 text-base font-black uppercase leading-tight text-zinc-950">{title}</h2>
                      <p className="mt-1 line-clamp-3 text-xs font-semibold leading-relaxed text-zinc-500">{summary}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <p className="text-lg font-black text-brand-red">{currency.format(product.price)}</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red text-white">
                      <Plus className="h-5 w-5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        </main>
      )}

      {step === "CHECKOUT" && (
        <main className="mx-auto max-w-xl space-y-4 p-4">
          <section className="rounded-2xl border border-amber-900/10 bg-[#2A1612] p-4 text-white shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Quase la</p>
            <h2 className="mt-1 text-xl font-black">Confira seu pedido antes do pagamento.</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-amber-100/85">
              Depois de confirmar, o pedido fica pendente no painel ate o Mercado Pago aprovar.
            </p>
          </section>

          <section className="rounded-2xl border border-amber-900/10 bg-white/95 p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Resumo do pedido</h2>
            <div className="mt-3 divide-y divide-zinc-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  <span className="font-black text-zinc-500">{item.quantity}x</span>
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
                      className="rounded-lg bg-zinc-100 p-2 text-zinc-500"
                      onClick={() => openCustomization(item.product, item)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded-lg bg-red-50 p-2 text-red-500" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
              <span className="text-sm font-black text-zinc-600">Subtotal dos itens</span>
              <span className="text-xl font-black text-brand-red">{currency.format(estimatedSubtotal)}</span>
            </div>
            {estimatedPackagingFee > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-zinc-500">
                <span>Inclui taxa para viagem</span>
                <span>{currency.format(estimatedPackagingFee)}</span>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Seus dados</h2>
            <input
              value={customerName}
              onChange={(event) => setCustomerInfo(event.target.value, customerPhone)}
              placeholder="Nome ou apelido"
              className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none focus:border-brand-red"
            />
            <input
              value={customerPhone}
              onChange={(event) => setCustomerInfo(customerName, event.target.value)}
              placeholder="WhatsApp opcional"
              type="tel"
              className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none focus:border-brand-red"
            />
            <input
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="E-mail para pagamento"
              type="email"
              className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-bold outline-none focus:border-brand-red"
            />
            <textarea
              value={orderNotes}
              onChange={(event) => setOrderNotes(event.target.value)}
              placeholder="Observacao opcional"
              className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-bold outline-none focus:border-brand-red"
            />
          </section>

          <section className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOrderType("BALCAO")}
              className={`rounded-2xl border-2 p-4 text-sm font-black uppercase transition-all ${
                orderType === "BALCAO" ? "border-brand-charcoal bg-brand-charcoal text-white" : "border-zinc-200 bg-white text-zinc-500"
              }`}
            >
              Comer aqui
            </button>
            <button
              type="button"
              onClick={() => setOrderType("VIAGEM")}
              className={`rounded-2xl border-2 p-4 text-sm font-black uppercase transition-all ${
                orderType === "VIAGEM" ? "border-brand-charcoal bg-brand-charcoal text-white" : "border-zinc-200 bg-white text-zinc-500"
              }`}
            >
              Para levar
            </button>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="space-y-2 text-sm font-bold text-zinc-600">
              <div className="flex items-center justify-between">
                <span>Itens</span>
                <span>{currency.format(estimatedSubtotal)}</span>
              </div>
              {estimatedPackagingFee > 0 && (
                <div className="flex items-center justify-between">
                  <span>Taxa para viagem</span>
                  <span>{currency.format(estimatedPackagingFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-lg font-black text-zinc-950">
                <span>Total estimado</span>
                <span className="text-brand-red">{currency.format(estimatedTotal)}</span>
              </div>
            </div>
          </section>

          {checkoutError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {checkoutError}
            </div>
          )}

          <Button className="w-full gap-2" loading={isSubmittingOrder} onClick={handleCreateOrder}>
            <CreditCard className="h-4 w-4" />
            Ir para pagamento seguro
          </Button>
        </main>
      )}

      {step === "PAYMENT" && orderData && (
        <main className="mx-auto max-w-xl space-y-4 p-4">
          <section className="rounded-2xl border border-amber-900/10 bg-[#2A1612] p-4 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-amber-200">Pagamento seguro</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-black">#{String(orderData.daily_number).padStart(3, "0")}</h2>
                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-200">
                  <Clock className="h-3.5 w-3.5" />
                  Aguardando pagamento
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

          <MercadoPagoBrick
            order={orderData}
            onResult={setPaymentResult}
            onPaid={() => {
              clearCart();
              setStep("PAID");
            }}
          />

          {paymentResult && <PixResult payment={paymentResult} />}
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
            <p className="mt-2 text-sm font-medium text-zinc-500">A equipe vai acompanhar seu pedido pelo painel.</p>
          </div>
          <Button onClick={() => {
            setOrderData(null);
            setPaymentResult(null);
            setStep("MENU");
          }}>
            Fazer novo pedido
          </Button>
        </main>
      )}

      {items.length > 0 && step === "MENU" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-4 shadow-2xl">
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
              <section className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Adicionais</p>
                <div className="grid grid-cols-2 gap-3">
                  {productAddons.map((addon) => {
                    const qty = selectedAddons.get(addon.id) || 0;
                    return (
                      <div key={addon.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <p className="text-sm font-black text-zinc-900">{addon.name}</p>
                        <p className="mt-1 text-sm font-black text-brand-red">+ {currency.format(addon.price)}</p>
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-100 p-1">
                          <button
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
