"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";

import { useCart, CartItem } from "@/features/cart/useCart";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { pdvApi } from "@/lib/api/pdv-api";
import { useCurrentBranchId } from "@/contexts/BranchContext";
import { Product, Ingredient, Order, Addon } from "@/types/pdv";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { OrderSummarySheet } from "@/components/checkout/OrderSummarySheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Minus, Plus, Utensils, ShoppingCart, AlertCircle, Sandwich, Cake, GlassWater, Coffee, Flame, Star, IceCream, Beef, Hamburger, ChevronRight, BookOpen, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface MenuIndexes {
  ingredientsById: Map<string, Ingredient>;
  addonsById: Map<string, Addon>;
  ingredientIdsByProduct: Map<string, string[]>;
  addonIdsByProduct: Map<string, string[]>;
}

/* ── Tags por produto (proteína em salgados, base em doces, etc) ──
   Mesma lógica do /pedir para manter o filtro consistente entre
   atendente e cliente. */
const ALL_FILTER = "Todos";
const SAVORY_PROTEINS = ["presunto", "calabresa", "frango", "atum", "peito de peru", "carne de sol"];
const SWEET_BASES = ["banana", "morango", "nutella", "chocolate", "doce de leite", "goiabada"];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => (part.length <= 2 ? part : `${part[0]?.toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function getCategoryKind(categoryName?: string) {
  const n = normalizeText(categoryName ?? "");
  if (n.includes("salgado")) return "SAVORY";
  if (n.includes("doce")) return "SWEET";
  if (n.includes("bebida") || n.includes("combustive")) return "DRINK";
  if (n.includes("batata")) return "POTATO";
  return "OTHER";
}

function getProductIngredients(product: Product, indexes: MenuIndexes | null) {
  if (!indexes) return [];
  const ids = indexes.ingredientIdsByProduct.get(product.id) ?? [];
  return ids.map((id) => indexes.ingredientsById.get(id)).filter(Boolean) as Ingredient[];
}

function getProductTags(product: Product, categoryName: string | undefined, indexes: MenuIndexes | null): string[] {
  const kind = getCategoryKind(categoryName);
  const ingredients = getProductIngredients(product, indexes).map((i) => normalizeText(i.name));
  const normalizedName = normalizeText(product.name);

  if (kind === "SAVORY") {
    if (normalizedName.includes("maverick")) return ["Especial"];
    const protein = SAVORY_PROTEINS.find((p) => ingredients.includes(normalizeText(p)));
    if (protein) return [titleCase(protein)];
    if (ingredients.includes("ovo") || ingredients.includes("queijo")) return ["Vegetariano"];
    return ["Outros"];
  }
  if (kind === "SWEET") {
    const bases = SWEET_BASES.filter((b) => ingredients.includes(normalizeText(b)));
    return bases.length > 0 ? bases.map(titleCase) : ["Doces"];
  }
  return [];
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

export default function NovoPedidoPage() {
  const searchParams = useSearchParams();
  const addToId = searchParams.get("add_to");
  const currentBranchId = useCurrentBranchId();
  
  const {
    items,
    getEstimatedSubtotal,
    addItem,
    updateItem,
    setTargetOrderId,
    targetOrderId,
    clearCart
  } = useCart();
  
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [targetOrder, setTargetOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Categoria visualmente ativa — atualizada via scroll-spy ou clique nas tabs. */
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  /** Filtro por proteína/base por categoria. Default "Todos". */
  const [filterByCategory, setFilterByCategory] = useState<Record<string, string>>({});
  /** Refs para cada section, usadas pelo IntersectionObserver e pelo scroll programático. */
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  /** Refs para cada botão de tab — usados para auto-centralizar o ativo. */
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Quando clicamos numa tab, queremos ignorar o scroll-spy por uns ms para não brigar com o smooth-scroll. */
  const suppressSpyRef = useRef(false);
  
  // Customization Sheet State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [removedIngredientIds, setRemovedIngredientIds] = useState<Set<string>>(new Set());
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [itemIsTakeout, setItemIsTakeout] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        const data = await menuApi.getMenuData(currentBranchId);
        setMenuData(data);
        if (data.categories.length > 0) {
          setSelectedCategoryId(data.categories[0].id);
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Erro ao carregar cardápio");
        }
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, [currentBranchId]);

  useEffect(() => {
    if (addToId) {
      clearCart();
      setTargetOrderId(addToId);
      
      pdvApi.getOrder(addToId)
        .then(order => {
          const isAllowed = ['NA_FILA', 'AGUARDANDO_PAGAMENTO'].includes(order.status) && order.payment_status === 'PENDING';
          if (!isAllowed) {
            setError("Este pedido não está aberto para adições.");
          } else {
            setTargetOrder(order);
          }
        })
        .catch(() => setError("Erro ao carregar dados do pedido alvo."));
    }

    return () => {
      setTargetOrderId(null);
    };
  }, [addToId, clearCart, setTargetOrderId]);

  const menuIndexes = useMemo(() => buildMenuIndexes(menuData), [menuData]);

  /** Produtos agrupados por categoria, na ordem das categorias. */
  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    if (!menuData) return map;
    for (const c of menuData.categories) {
      map[c.id] = menuData.products.filter((p) => p.category_id === c.id);
    }
    return map;
  }, [menuData]);

  /** Filtros disponíveis por categoria (derivados das tags dos produtos). */
  const filtersByCategory = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!menuData) return map;
    for (const c of menuData.categories) {
      const tags = new Set<string>();
      for (const p of (productsByCategory[c.id] ?? [])) {
        getProductTags(p, c.name, menuIndexes).forEach((t) => tags.add(t));
      }
      // só faz sentido mostrar filtros se houver 2+ tags
      map[c.id] = tags.size >= 2 ? [ALL_FILTER, ...Array.from(tags)] : [];
    }
    return map;
  }, [menuData, productsByCategory, menuIndexes]);

  /* Scroll-spy: atualiza a categoria ativa conforme o usuário rola.
     Usamos scroll listener no window (não IntersectionObserver) porque:
     - É mais previsível com layouts contendo elementos fixed/sticky
     - Funciona igual independente de onde o scroll real acontece (doc ou container) */
  useEffect(() => {
    if (!menuData) return;
    let raf = 0;
    // Linha de detecção: ~30% abaixo do topo da viewport (depois do TopBar + tabs sticky)
    const TRIGGER_OFFSET = 160;

    function pickActiveSection() {
      raf = 0;
      if (suppressSpyRef.current) return;
      let bestId: string | null = null;
      let bestTop = -Infinity;
      for (const [id, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // Pega a section cujo topo está mais próximo (e acima) da linha de gatilho
        if (top <= TRIGGER_OFFSET && top > bestTop) {
          bestTop = top;
          bestId = id;
        }
      }
      if (bestId) setSelectedCategoryId(bestId);
    }

    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(pickActiveSection);
    }

    // Roda uma vez para definir a categoria inicial baseada no scroll atual
    pickActiveSection();
    // Usa capture phase porque scroll events de containers nested (ex: <main>
    // com overflow-y-auto) não bubbleam para window. Capture pega todos.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [menuData]);

  /* Centraliza horizontalmente a tab ativa no seu scroll container.
     `inline: "center"` faz o navegador rolar o scroller para alinhar
     o botão no centro. `block: "nearest"` evita scroll vertical na página. */
  useEffect(() => {
    if (!selectedCategoryId) return;
    const el = tabRefs.current[selectedCategoryId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedCategoryId]);

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = sectionRefs.current[categoryId];
    if (!el) return;
    suppressSpyRef.current = true;
    setSelectedCategoryId(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => { suppressSpyRef.current = false; }, 700);
  }, []);

  const setCategoryFilter = useCallback((categoryId: string, filter: string) => {
    setFilterByCategory((prev) => ({ ...prev, [categoryId]: filter }));
  }, []);

  const openCustomization = useCallback((product: Product, existingItem?: CartItem) => {
    setSelectedProduct(product);
    if (existingItem) {
      setEditingCartItemId(existingItem.id);
      setRemovedIngredientIds(new Set(existingItem.removed_ingredients));
      const addonsMap = new Map();
      existingItem.addons.forEach((a: { addon_id: string; quantity: number }) => addonsMap.set(a.addon_id, a.quantity));
      setSelectedAddons(addonsMap);
      setQuantity(existingItem.quantity);
      setNotes(existingItem.notes || "");
      setItemIsTakeout(existingItem.is_takeout ?? false);
    } else {
      setEditingCartItemId(null);
      setRemovedIngredientIds(new Set());
      setSelectedAddons(new Map());
      setQuantity(1);
      setNotes("");
      setItemIsTakeout(false);
    }
  }, []);

  const closeCustomization = useCallback(() => {
    setSelectedProduct(null);
    setEditingCartItemId(null);
  }, []);

  const toggleIngredient = useCallback((ingredientId: string) => {
    setRemovedIngredientIds(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }, []);

  const updateAddonQty = useCallback((addonId: string, delta: number) => {
    setSelectedAddons(prev => {
      const next = new Map(prev);
      const current = next.get(addonId) || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) next.delete(addonId);
      else next.set(addonId, newQty);
      return next;
    });
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return;

    const addonsArray = Array.from(selectedAddons.entries()).map(([addonId, qty]) => {
      const addonData = menuIndexes?.addonsById.get(addonId);
      return { addon_id: addonId, addon_name: addonData?.name, quantity: qty, price: addonData?.price || 0 };
    });

    const itemData = {
      product: selectedProduct,
      quantity,
      removed_ingredients: Array.from(removedIngredientIds),
      addons: addonsArray,
      notes: notes.trim() ? notes : undefined,
      is_takeout: itemIsTakeout,
    };

    if (editingCartItemId) {
      updateItem(editingCartItemId, itemData);
    } else {
      addItem(itemData);
    }

    closeCustomization();
  }, [
    addItem,
    closeCustomization,
    editingCartItemId,
    itemIsTakeout,
    menuIndexes,
    notes,
    quantity,
    removedIngredientIds,
    selectedAddons,
    selectedProduct,
    updateItem,
  ]);

  // Derived state for the customization sheet
  const productDefaultIngredients = useMemo(() => {
    if (!selectedProduct || !menuIndexes) return [];
    const ingredientIds = menuIndexes.ingredientIdsByProduct.get(selectedProduct.id) ?? [];
    return ingredientIds
      .map((ingredientId) => menuIndexes.ingredientsById.get(ingredientId))
      .filter(Boolean) as Ingredient[];
  }, [selectedProduct, menuIndexes]);

  const productAddons = useMemo(() => {
    if (!selectedProduct || !menuIndexes) return [];
    const addonIds = menuIndexes.addonIdsByProduct.get(selectedProduct.id) ?? [];
    return addonIds
      .map((addonId) => menuIndexes.addonsById.get(addonId))
      .filter(Boolean) as Addon[];
  }, [selectedProduct, menuIndexes]);

  const sheetSubtotal = useMemo(() => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    selectedAddons.forEach((qty, addonId) => {
      const addon = menuIndexes?.addonsById.get(addonId);
      if (addon) total += (addon.price * qty);
    });
    return total * quantity;
  }, [selectedProduct, selectedAddons, quantity, menuIndexes]);

  if (loading) {
    return (
      <div className="flex-1 bg-[var(--bg-base)] p-4 space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[var(--bg-base)] p-6 text-center">
        <AlertCircle className="text-[var(--status-danger)] w-12 h-12 mb-4" strokeWidth={1.75} />
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Algo deu errado</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} className="h-12 px-8 rounded-xl">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-base)]">
        <OrderSummarySheet
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onEditItem={(item: CartItem) => {
            setIsCheckoutOpen(false);
            openCustomization(item.product, item);
          }}
        />

      {/* ── Mobile/tablet: tabs fixed colado abaixo do TopBar (lg-) ──
         Usamos position: fixed (não sticky) pelo mesmo motivo da sidebar
         desktop — garante que fica sempre visível mesmo em layouts com
         scroll em container aninhado. O conteúdo recebe pt para compensar. */}
      {!isCheckoutOpen && !selectedProduct && (
        <div
          style={{ backgroundColor: "var(--bg-surface)" }}
          className="lg:hidden fixed top-14 left-0 right-0 z-30 border-b border-[var(--border)] isolate"
        >
          {targetOrder && (
            <div className="px-4 pt-2 pb-1 flex items-center gap-2">
              <span className="rounded-full bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-info)]">
                Adicionando
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                #{String(targetOrder.daily_number).padStart(3, "0")}
              </span>
            </div>
          )}
          <div className="px-2">
            <div className="flex gap-1 overflow-x-auto hide-scrollbar">
              {menuData?.categories.map((category) => (
                <CategoryUnderlineTab
                  key={category.id}
                  category={category}
                  isSelected={selectedCategoryId === category.id}
                  onClick={() => scrollToCategory(category.id)}
                  buttonRef={(el) => { tabRefs.current[category.id] = el; }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer pra compensar a altura do header fixed em mobile.
         Aproxima 48px (tabs row) + 28px extra se houver banner. */}
      {!isCheckoutOpen && !selectedProduct && (
        <div className={`lg:hidden ${targetOrder ? "h-[80px]" : "h-[52px]"}`} aria-hidden />
      )}

      {/* ── Sidebar fixa de categorias (lg+) ──
         position: fixed garante que ela permanece sempre visível durante
         o scroll, independente de container scrollável ancestral.
         left-60 = depois do menu global do app (lg:ml-60 no <main>).
         O conteúdo recebe lg:pl-56 para compensar a sidebar. */}
      {!isCheckoutOpen && !selectedProduct && (
        <aside className="hidden lg:flex lg:flex-col fixed top-14 left-60 w-56 h-[calc(100vh-3.5rem)] overflow-y-auto z-20 py-6 pl-4 pr-2 bg-[var(--bg-base)]">
          {targetOrder && (
            <div className="mb-4 mx-1 rounded-xl bg-[var(--status-info-bg)] px-3 py-2">
              <p className="text-[10px] font-semibold text-[var(--status-info)] uppercase tracking-wide">Adicionando ao pedido</p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                #{String(targetOrder.daily_number).padStart(3, "0")}
              </p>
            </div>
          )}
          <nav className="flex flex-col gap-0.5">
            {menuData?.categories.map((category) => {
              const isSelected = selectedCategoryId === category.id;
              const { icon: CatIcon } = getCategoryMeta(category.name);
              const count = (productsByCategory[category.id] ?? []).length;
              return (
                <button
                  key={category.id}
                  ref={(el) => {
                    // Compartilha o ref entre mobile e desktop — só um existe
                    // por categoria por vez (lg:hidden vs hidden lg:block).
                    if (el) tabRefs.current[category.id] = el as unknown as HTMLButtonElement;
                  }}
                  onClick={() => scrollToCategory(category.id)}
                  className={`relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-r-xl text-sm text-left transition-all duration-200 ${
                    isSelected
                      ? "bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-primary)] font-medium"
                  }`}
                >
                  {/* Barra lateral indicadora — brand-red em ativo */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-200 ${
                      isSelected ? "bg-brand-red" : "bg-transparent"
                    }`}
                  />
                  <CatIcon
                    className={`w-4 h-4 shrink-0 ${isSelected ? "text-brand-red" : "text-[var(--text-muted)]"}`}
                    strokeWidth={isSelected ? 2 : 1.75}
                  />
                  <span className="flex-1 truncate">{category.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-medium tabular-nums ${isSelected ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Conteúdo — recebe pl-56 no desktop para não ficar atrás da sidebar fixa */}
      <div className="lg:pl-56">
        <div className="min-w-0 pb-64">
          {menuData?.categories.length === 0 ? (
            <div className="p-4 py-12">
              <EmptyState
                icon={BookOpen}
                title="Sem produtos no cardápio"
                description="Cadastre produtos em Cardápio para começar a vender."
              />
            </div>
          ) : (
            menuData?.categories.map((category) => {
              const products = productsByCategory[category.id] ?? [];
              if (products.length === 0) return null;
              const filters = filtersByCategory[category.id] ?? [];
              const activeFilter = filterByCategory[category.id] ?? ALL_FILTER;
              const visibleProducts = filters.length === 0 || activeFilter === ALL_FILTER
                ? products
                : products.filter((p) => getProductTags(p, category.name, menuIndexes).includes(activeFilter));

              return (
                <section
                  key={category.id}
                  ref={(el) => { sectionRefs.current[category.id] = el; }}
                  data-category-id={category.id}
                  className="px-4 pt-5 scroll-mt-32 lg:scroll-mt-24"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">{category.name}</h2>
                    <span className="text-xs text-[var(--text-muted)]">{visibleProducts.length} {visibleProducts.length === 1 ? "item" : "itens"}</span>
                  </div>

                  {/* Filtros por tag — só aparecem em categorias com 2+ tags (ex: Kreps Salgados → proteínas) */}
                  {filters.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-3">
                      {filters.map((f) => {
                        const isActive = activeFilter === f;
                        return (
                          <button
                            key={f}
                            onClick={() => setCategoryFilter(category.id, f)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${
                              isActive
                                ? "bg-brand-red text-white shadow-[var(--shadow-sm)]"
                                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Grid de produtos */}
                  {visibleProducts.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] py-4">Nenhum item para esse filtro.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {visibleProducts.map((product) => {
                        const available = product.active !== false;
                        return (
                          <div
                            key={product.id}
                            onClick={() => available && openCustomization(product)}
                            className={`relative flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)] [contain-intrinsic-size:96px] [content-visibility:auto] group ${
                              available ? "cursor-pointer hover:shadow-[var(--shadow-md)] active:scale-[0.98]" : "opacity-60"
                            }`}
                          >
                            <div className="w-14 h-14 bg-[var(--bg-subtle)] rounded-xl flex items-center justify-center shrink-0 text-[var(--text-muted)]">
                              <Utensils className="w-6 h-6" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="text-[var(--text-primary)] font-semibold text-sm leading-tight">{product.name}</h3>
                                <p className="text-[var(--text-primary)] font-semibold text-base leading-none tabular-nums shrink-0">
                                  <span className="text-[11px] mr-0.5 text-[var(--text-secondary)] font-medium">R$</span>
                                  {product.price.toFixed(2).replace('.', ',')}
                                </p>
                              </div>
                              {product.description && (
                                <p className="text-[var(--text-muted)] text-xs mt-1 line-clamp-1">{product.description}</p>
                              )}
                              {!available && (
                                <span className="inline-block mt-2 bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  Indisponível
                                </span>
                              )}
                            </div>
                            {available && (
                              <button
                                type="button"
                                aria-label="Adicionar"
                                className="shrink-0 bg-brand-red text-white p-2 rounded-full shadow-[var(--shadow-sm)] hover:bg-brand-red-dark active:scale-90"
                              >
                                <Plus size={18} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Cart — rodapé fixo */}
      {items.length > 0 && !isCheckoutOpen && !selectedProduct && (
        <div className="fixed bottom-20 md:bottom-6 left-3 right-3 lg:left-[calc(240px+1rem)] z-[60] animate-in slide-in-from-bottom-8 lg:max-w-md">
          <button
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full bg-[var(--bg-inverse)] text-white rounded-2xl pl-2 pr-4 py-2 shadow-[var(--shadow-lg)] flex items-center gap-3 active:scale-[0.98] hover:shadow-[var(--shadow-lg)] group"
          >
            <div className="relative bg-brand-red p-3 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingCart size={20} className="text-white" strokeWidth={1.75} />
              <span className="absolute -top-1.5 -right-1.5 bg-white text-brand-red text-[10px] font-semibold h-5 min-w-5 px-1 rounded-full flex items-center justify-center ring-2 ring-[var(--bg-inverse)]">
                {items.length}
              </span>
            </div>
            <div className="flex-1 text-left leading-tight">
              <p className="text-[11px] text-zinc-400">
                {items.length === 1 ? "1 item no pedido" : `${items.length} itens no pedido`}
              </p>
              <p className="font-semibold text-base tabular-nums">
                <span className="text-xs text-zinc-300 mr-0.5 font-medium">R$</span>
                {getEstimatedSubtotal().toFixed(2).replace('.', ',')}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-zinc-300 shrink-0">
              Ver pedido
              <ChevronRight size={14} strokeWidth={2} />
            </div>
          </button>
        </div>
      )}


      {/* Product Customization Bottom Sheet */}
      <BottomSheet
        isOpen={!!selectedProduct}
        onClose={closeCustomization}
        title={editingCartItemId ? "Editar item" : "Personalizar item"}
      >
        {selectedProduct && (
          <div className="p-5 pt-2 flex flex-col space-y-6 pb-10">

            {/* Header / Basic Info */}
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{selectedProduct.name}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-[11px] font-medium px-2 py-0.5 rounded-full">Base</span>
                  <p className="text-xl font-semibold text-[var(--text-primary)] tabular-nums">
                    <span className="text-sm text-[var(--text-secondary)] mr-0.5 font-medium">R$</span>
                    {selectedProduct.price.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
              {editingCartItemId && (
                <span className="bg-brand-charcoal text-white text-[11px] font-semibold px-3 py-1 rounded-full shrink-0">
                  Editando
                </span>
              )}
            </div>

            {/* Ingredients Selection */}
            {productDefaultIngredients.length > 0 && (
              <div className="space-y-3">
                <SheetSectionTitle>Ingredientes padrão</SheetSectionTitle>
                <div className="grid grid-cols-1 gap-2">
                  {productDefaultIngredients.map(ing => {
                    const removed = removedIngredientIds.has(ing.id);
                    return (
                      <label key={ing.id} className="flex items-center gap-3 p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-subtle)]/50 select-none">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-[var(--border-strong)] accent-brand-red"
                          checked={!removed}
                          onChange={() => toggleIngredient(ing.id)}
                        />
                        <span className={`text-sm font-medium ${removed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                          {ing.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Addons Selection */}
            {productAddons.length > 0 && (
              <div className="space-y-3">
                <SheetSectionTitle>Adicionais</SheetSectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {productAddons.map(addon => {
                    const qty = selectedAddons.get(addon.id) || 0;
                    const isSelected = qty > 0;
                    return (
                      <div
                        key={addon.id}
                        className={`relative rounded-2xl border p-3 cursor-pointer active:scale-[0.97] select-none ${
                          isSelected
                            ? 'bg-[var(--status-success-bg)] border-[var(--status-success)]/30'
                            : 'bg-[var(--bg-surface)] border-[var(--border)]'
                        }`}
                        onClick={() => updateAddonQty(addon.id, 1)}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--status-success)] text-white rounded-full flex items-center justify-center text-[11px] font-semibold">
                            {qty}
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/60' : 'bg-[var(--bg-subtle)]'}`}>
                            <Plus size={14} className={isSelected ? 'text-[var(--status-success)]' : 'text-[var(--text-muted)]'} strokeWidth={2} />
                          </div>
                          <span className={`text-xs font-semibold leading-tight ${isSelected ? 'text-[var(--status-success)]' : 'text-[var(--text-primary)]'}`}>
                            {addon.name}
                          </span>
                          <span className={`text-[11px] font-semibold tabular-nums ${isSelected ? 'text-[var(--status-success)]' : 'text-brand-red'}`}>
                            +R$ {addon.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        {isSelected && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateAddonQty(addon.id, -1); }}
                            className="absolute bottom-2 right-2 w-7 h-7 bg-[var(--bg-surface)] rounded-lg shadow-[var(--shadow-sm)] flex items-center justify-center border border-[var(--border)] active:scale-90"
                          >
                            <Minus size={12} className="text-[var(--status-success)]" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-3">
              <SheetSectionTitle>Observações</SheetSectionTitle>
              <textarea
                className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/40 focus:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-brand-red/10 resize-none h-20"
                placeholder="Ex: sem sal, carne bem passada..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Destino do Item */}
            <div className="space-y-3">
              <SheetSectionTitle>Destino do item</SheetSectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setItemIsTakeout(false)}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold active:scale-[0.97] ${
                    !itemIsTakeout
                      ? "border-brand-charcoal bg-brand-charcoal text-white"
                      : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  <Utensils size={16} strokeWidth={1.75} />
                  Comer aqui
                </button>
                <button
                  type="button"
                  onClick={() => setItemIsTakeout(true)}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold active:scale-[0.97] ${
                    itemIsTakeout
                      ? "border-brand-charcoal bg-brand-charcoal text-white"
                      : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  <ShoppingCart size={16} strokeWidth={1.75} />
                  Para levar
                </button>
              </div>
            </div>

            {/* Quantity & Add to Cart - Sticky at Bottom */}
            <div className="sticky bottom-0 left-0 right-0 pt-3 pb-4 bg-[var(--bg-surface)] border-t border-[var(--border)] flex items-center gap-3 mt-auto z-10">
              <div className="flex items-center gap-2 bg-[var(--bg-subtle)] rounded-xl p-1 h-12">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 rounded-lg text-[var(--text-secondary)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] disabled:opacity-30 active:scale-90"
                  disabled={quantity <= 1}
                  aria-label="Diminuir quantidade"
                >
                  <Minus size={16} strokeWidth={2} />
                </button>
                <span className="w-6 text-center font-semibold text-base text-[var(--text-primary)] tabular-nums">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 rounded-lg text-brand-red bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] active:scale-90"
                  aria-label="Aumentar quantidade"
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                className={`flex-1 h-12 text-sm font-semibold rounded-xl active:scale-[0.98] ${editingCartItemId ? 'bg-brand-charcoal hover:bg-brand-black' : ''}`}
              >
                <span className="flex items-center gap-2">
                  {editingCartItemId ? 'Salvar' : 'Adicionar'}
                  <span className="opacity-80 tabular-nums">· R$ {sheetSubtotal.toFixed(2).replace('.', ',')}</span>
                </span>
              </Button>
            </div>

          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function CategoryUnderlineTab({
  category,
  isSelected,
  onClick,
  buttonRef,
}: {
  category: { id: string; name: string };
  isSelected: boolean;
  onClick: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  const { icon: CatIcon } = getCategoryMeta(category.name);
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`relative whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 pt-3 pb-2.5 text-xs transition-colors duration-200 ${
        isSelected
          ? "text-[var(--text-primary)] font-semibold"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
      }`}
    >
      <CatIcon
        className={`w-3.5 h-3.5 ${isSelected ? "text-brand-red" : "text-[var(--text-muted)]"}`}
        strokeWidth={isSelected ? 2 : 1.75}
      />
      <span>{category.name}</span>
      {/* Underline brand-red — anima largura/posição via layout shift */}
      <span
        aria-hidden
        className={`absolute left-2 right-2 bottom-0 h-[2px] rounded-full transition-all duration-200 ${
          isSelected ? "bg-brand-red opacity-100" : "bg-brand-red opacity-0"
        }`}
      />
    </button>
  );
}

function SheetSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-[var(--text-muted)] px-1">
      {children}
    </h4>
  );
}

/* Ícones de categoria — mapeamento per brief:
   Kreps Salgados → sandwich · Kreps Doces → cake · Batata → flame
   Bebidas → glass-water · Cremes/Açaí → ice-cream */
function getCategoryMeta(name: string): {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
} {
  const n = name.toLowerCase();
  if (n.includes('açaí') || n.includes('acai') || n.includes('creme') || n.includes('sorvete'))
    return { icon: IceCream, iconBg: 'bg-[var(--status-info-bg)]', iconColor: 'text-[var(--status-info)]' };
  if (n.includes('salgado') || n.includes('savory') || n.includes('tradicional'))
    return { icon: Sandwich, iconBg: 'bg-[var(--status-warning-bg)]', iconColor: 'text-[var(--status-warning)]' };
  if (n.includes('doce') || n.includes('sweet') || n.includes('sobremesa'))
    return { icon: Cake, iconBg: 'bg-[var(--status-danger-bg)]', iconColor: 'text-brand-red' };
  if (n.includes('suco') || n.includes('juice') || n.includes('vitamina') || n.includes('água') || n.includes('bebida') || n.includes('drink') || n.includes('refri'))
    return { icon: GlassWater, iconBg: 'bg-[var(--status-info-bg)]', iconColor: 'text-[var(--status-info)]' };
  if (n.includes('café') || n.includes('coffee') || n.includes('quente') || n.includes('chá'))
    return { icon: Coffee, iconBg: 'bg-[var(--status-warning-bg)]', iconColor: 'text-[var(--status-warning)]' };
  if (n.includes('batata') || n.includes('frit') || n.includes('porcao') || n.includes('porção'))
    return { icon: Flame, iconBg: 'bg-[var(--status-warning-bg)]', iconColor: 'text-[var(--status-warning)]' };
  if (n.includes('especial') || n.includes('premium') || n.includes('gourmet'))
    return { icon: Star, iconBg: 'bg-[var(--bg-subtle)]', iconColor: 'text-[var(--text-secondary)]' };
  if (n.includes('carne') || n.includes('beef'))
    return { icon: Beef, iconBg: 'bg-[var(--status-danger-bg)]', iconColor: 'text-brand-red' };
  if (n.includes('lanche') || n.includes('hamburguer') || n.includes('burger'))
    return { icon: Hamburger, iconBg: 'bg-[var(--status-warning-bg)]', iconColor: 'text-[var(--status-warning)]' };
  return { icon: Utensils, iconBg: 'bg-[var(--bg-subtle)]', iconColor: 'text-[var(--text-secondary)]' };
}

