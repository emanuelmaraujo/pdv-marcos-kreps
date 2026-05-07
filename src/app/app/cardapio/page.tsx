"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { menuApi, MenuData, CreateProductInput, CreateAddonInput, CreateCategoryInput } from "@/lib/api/menu-api";
import {
  Loader2,
  AlertCircle,
  PackageX,
  Pencil,
  Plus,
  Settings2,
  CheckCircle2,
  PlusCircle,
  ChevronRight,
} from "lucide-react";
import { Product, Addon, Category } from "@/types/pdv";
import { createClient } from "@/lib/supabase/client";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { ProductModal } from "@/components/menu/ProductModal";
import { AddonModal } from "@/components/menu/AddonModal";
import { CategoryModal } from "@/components/menu/CategoryModal";
import { AddonLinkingModal } from "@/components/menu/AddonLinkingModal";
import { IngredientLinkingModal } from "@/components/menu/IngredientLinkingModal";

// ─── Types ──────────────────────────────────────────────
type EditingState = {
  id: string;
  field: "name" | "price";
  value: string;
} | null;

// ─── Main Component ─────────────────────────────────────
export default function CardapioPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>(null);
  const [editingAddon, setEditingAddon] = useState<EditingState>(null);
  
  // New management state
  const [mainTab, setMainTab] = useState<"products" | "addons" | "categories">("products");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const { toasts, addToast, removeToast } = useToast();

  const loadMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin(profile?.role === "ADMIN");
      }

      const data = await menuApi.getFullMenuData();
      setMenuData(data);
      if (data.categories.length > 0 && !activeCategory) {
        setActiveCategory(data.categories[0].id);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Erro ao carregar cardápio");
      }
      addToast("error", "Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMenu();
  }, [loadMenu]);

  // ─── Product Actions ─────────────────────────────────
  const handleToggleProduct = async (product: Product) => {
    if (!isAdmin) return;
    try {
      setSavingId(product.id);
      await menuApi.updateProduct(product.id, { active: !product.active });
      setMenuData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === product.id ? { ...p, active: !p.active } : p
          ),
        };
      });
      addToast(
        "success",
        product.active
          ? `"${product.name}" marcado como indisponível`
          : `"${product.name}" disponível novamente`
      );
    } catch (err: unknown) {
      addToast(
        "error",
        err instanceof Error ? err.message : "Erro ao atualizar produto"
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveProductField = async (
    product: Product,
    field: "name" | "price",
    rawValue: string
  ) => {
    if (!isAdmin) return;

    if (field === "name") {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        addToast("error", "O nome não pode ser vazio");
        return;
      }
      if (trimmed === product.name) {
        setEditing(null);
        return;
      }
      try {
        setSavingId(product.id);
        await menuApi.updateProduct(product.id, { name: trimmed });
        setMenuData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            products: prev.products.map((p) =>
              p.id === product.id ? { ...p, name: trimmed } : p
            ),
          };
        });
        addToast("success", `Nome alterado para "${trimmed}"`);
      } catch (err: unknown) {
        addToast(
          "error",
          err instanceof Error ? err.message : "Erro ao salvar nome"
        );
      } finally {
        setSavingId(null);
        setEditing(null);
      }
    }

    if (field === "price") {
      const cleaned = rawValue.replace(",", ".");
      const numericPrice = parseFloat(cleaned);
      if (isNaN(numericPrice) || numericPrice < 0) {
        addToast("error", "Preço inválido");
        return;
      }
      if (numericPrice === product.price) {
        setEditing(null);
        return;
      }
      try {
        setSavingId(product.id);
        await menuApi.updateProduct(product.id, { price: numericPrice });
        setMenuData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            products: prev.products.map((p) =>
              p.id === product.id ? { ...p, price: numericPrice } : p
            ),
          };
        });
        addToast(
          "success",
          `Preço de "${product.name}" atualizado para R$ ${numericPrice.toFixed(2)}`
        );
      } catch (err: unknown) {
        addToast(
          "error",
          err instanceof Error ? err.message : "Erro ao salvar preço"
        );
      } finally {
        setSavingId(null);
        setEditing(null);
      }
    }
  };

  // ─── Addon Actions ─────────────────────────────────
  const handleToggleAddon = async (addon: Addon) => {
    if (!isAdmin) return;
    try {
      setSavingId(addon.id);
      await menuApi.updateAddon(addon.id, { active: !addon.active });
      setMenuData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          addons: prev.addons.map((a) =>
            a.id === addon.id ? { ...a, active: !a.active } : a
          ),
        };
      });
      addToast(
        "success",
        addon.active
          ? `"${addon.name}" marcado como indisponível`
          : `"${addon.name}" disponível novamente`
      );
    } catch (err: unknown) {
      addToast(
        "error",
        err instanceof Error ? err.message : "Erro ao atualizar adicional"
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAddonPrice = async (addon: Addon, rawValue: string) => {
    if (!isAdmin) return;
    const cleaned = rawValue.replace(",", ".");
    const numericPrice = parseFloat(cleaned);
    if (isNaN(numericPrice) || numericPrice < 0) {
      addToast("error", "Preço inválido");
      return;
    }
    if (numericPrice === addon.price) {
      setEditingAddon(null);
      return;
    }
    try {
      setSavingId(addon.id);
      await menuApi.updateAddon(addon.id, { price: numericPrice });
      setMenuData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          addons: prev.addons.map((a) =>
            a.id === addon.id ? { ...a, price: numericPrice } : a
          ),
        };
      });
      addToast(
        "success",
        `Preço de "${addon.name}" atualizado para R$ ${numericPrice.toFixed(2)}`
      );
    } catch (err: unknown) {
      addToast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar preço"
      );
    } finally {
      setSavingId(null);
      setEditingAddon(null);
    }
  };

  // ─── Loading ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <PageHeader title="Cardápio" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <PageHeader title="Cardápio" />
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={loadMenu}
            className="mt-4 w-full py-3 bg-white border border-zinc-200 rounded-xl font-medium text-zinc-700 hover:bg-zinc-50 active:scale-[0.97] transition-transform"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!menuData) return null;

  const currentProducts = menuData.products.filter(
    (p) => p.category_id === activeCategory
  );

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <PageHeader title="Gestão do Cardápio" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Role Banner */}
      {!isAdmin && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Seu perfil permite visualizar apenas itens disponíveis. Alterações no
            cardápio são restritas ao administrador.
          </span>
        </div>
      )}

      {/* ADMIN Action Buttons */}
      {isAdmin && (
        <div className="px-4 py-3 bg-white border-b border-zinc-100 flex gap-2 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => {
              setSelectedProduct(null);
              setIsProductModalOpen(true);
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Produto
          </button>
          <button
            onClick={() => {
              setSelectedAddon(null);
              setIsAddonModalOpen(true);
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-brand-charcoal text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Adicional
          </button>
          <button
            onClick={() => {
              setSelectedCategory(null);
              setIsCategoryModalOpen(true);
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-zinc-100 text-zinc-700 rounded-lg text-xs font-bold border border-zinc-200 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Categoria
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="bg-white border-b border-zinc-200">
        <div className="flex p-1 m-3 bg-zinc-100 rounded-xl">
          <button
            onClick={() => setMainTab("products")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mainTab === "products"
                ? "bg-white text-brand-charcoal shadow-sm"
                : "text-zinc-500"
            }`}
          >
            Produtos
          </button>
          <button
            onClick={() => setMainTab("addons")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mainTab === "addons"
                ? "bg-white text-brand-charcoal shadow-sm"
                : "text-zinc-500"
            }`}
          >
            Adicionais
          </button>
          <button
            onClick={() => setMainTab("categories")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mainTab === "categories"
                ? "bg-white text-brand-charcoal shadow-sm"
                : "text-zinc-500"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      {/* Sub-Tabs (only for products) */}
      {mainTab === "products" && (
        <div className="bg-white border-b border-zinc-200 overflow-x-auto hide-scrollbar">
          <div className="flex px-4 py-3 gap-2 min-w-max">
            {menuData.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                  activeCategory === category.id
                    ? "bg-brand-charcoal text-white border-brand-charcoal shadow-sm"
                    : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {mainTab === "products" && (
          <ProductList
            products={currentProducts}
            menuData={menuData}
            isAdmin={isAdmin}
            savingId={savingId}
            editing={editing}
            onToggle={handleToggleProduct}
            onStartEdit={(id, field, value) =>
              setEditing({ id, field, value })
            }
            onEditChange={(value) =>
              setEditing((prev) => (prev ? { ...prev, value } : null))
            }
            onSaveField={handleSaveProductField}
            onCancelEdit={() => setEditing(null)}
            onEditProduct={(p) => {
              setSelectedProduct(p);
              setIsProductModalOpen(true);
            }}
            onConfigureAddons={(p) => {
              setSelectedProduct(p);
              setIsLinkingModalOpen(true);
            }}
            onConfigureIngredients={(p) => {
              setSelectedProduct(p);
              setIsIngredientModalOpen(true);
            }}
          />
        )}
        {mainTab === "addons" && (
          <AddonList
            addons={menuData.addons}
            isAdmin={isAdmin}
            savingId={savingId}
            editingAddon={editingAddon}
            onToggle={handleToggleAddon}
            onStartEdit={(id, value) =>
              setEditingAddon({ id, field: "price", value })
            }
            onEditChange={(value) =>
              setEditingAddon((prev) => (prev ? { ...prev, value } : null))
            }
            onSavePrice={handleSaveAddonPrice}
            onCancelEdit={() => setEditingAddon(null)}
            onEditAddon={(a) => {
              setSelectedAddon(a);
              setIsAddonModalOpen(true);
            }}
          />
        )}
        {mainTab === "categories" && (
          <CategoryList
            categories={menuData.categories}
            isAdmin={isAdmin}
            savingId={savingId}
            onToggle={async (cat) => {
              try {
                setSavingId(cat.id);
                await menuApi.updateCategory(cat.id, { active: !cat.active });
                setMenuData(prev => prev ? {
                  ...prev,
                  categories: prev.categories.map(c => c.id === cat.id ? { ...c, active: !c.active } : c)
                } : prev);
              } finally {
                setSavingId(null);
              }
            }}
            onEditCategory={(cat) => {
              setSelectedCategory(cat);
              setIsCategoryModalOpen(true);
            }}
          />
        )}
      </div>

      {/* Modals */}
      <ProductModal
        key={isProductModalOpen ? `prod-${selectedProduct?.id || 'new'}` : 'prod-closed'}
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        categories={menuData.categories}
        product={selectedProduct}
        onSave={async (data) => {
          try {
            if (selectedProduct) {
              await menuApi.updateProduct(selectedProduct.id, data);
              addToast("success", "Produto atualizado!");
            } else {
              await menuApi.createProduct(data as CreateProductInput);
              addToast("success", "Produto criado!");
            }
            loadMenu();
          } catch {
            addToast("error", "Erro ao salvar produto");
          }
        }}
      />

      <AddonModal
        key={isAddonModalOpen ? `addon-${selectedAddon?.id || 'new'}` : 'addon-closed'}
        isOpen={isAddonModalOpen}
        onClose={() => setIsAddonModalOpen(false)}
        addon={selectedAddon}
        onSave={async (data) => {
          try {
            if (selectedAddon) {
              await menuApi.updateAddon(selectedAddon.id, data);
              addToast("success", "Adicional atualizado!");
            } else {
              await menuApi.createAddon(data as CreateAddonInput);
              addToast("success", "Adicional criado!");
            }
            loadMenu();
          } catch {
            addToast("error", "Erro ao salvar adicional");
          }
        }}
      />

      <CategoryModal
        key={isCategoryModalOpen ? `cat-${selectedCategory?.id || 'new'}` : 'cat-closed'}
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        category={selectedCategory}
        onSave={async (data) => {
          try {
            if (selectedCategory) {
              await menuApi.updateCategory(selectedCategory.id, data);
              addToast("success", "Categoria atualizada!");
            } else {
              await menuApi.createCategory(data as CreateCategoryInput);
              addToast("success", "Categoria criada!");
            }
            loadMenu();
          } catch {
            addToast("error", "Erro ao salvar categoria");
          }
        }}
      />

      <AddonLinkingModal
        key={isLinkingModalOpen ? `link-${selectedProduct?.id || 'none'}` : 'link-closed'}
        isOpen={isLinkingModalOpen}
        onClose={() => setIsLinkingModalOpen(false)}
        product={selectedProduct}
        allAddons={menuData.addons}
        initialSelectedIds={
          selectedProduct
            ? menuData.productAddons
                .filter((pa) => pa.product_id === selectedProduct.id)
                .map((pa) => pa.addon_id)
            : []
        }
        onSave={async (prodId, addonIds) => {
          try {
            await menuApi.setProductAddons(prodId, addonIds);
            addToast("success", "Vínculos atualizados!");
            loadMenu();
          } catch {
            addToast("error", "Erro ao vincular adicionais");
          }
        }}
      />

      <IngredientLinkingModal
        key={isIngredientModalOpen ? `ing-${selectedProduct?.id || 'none'}` : 'ing-closed'}
        isOpen={isIngredientModalOpen}
        onClose={() => setIsIngredientModalOpen(false)}
        product={selectedProduct}
        allIngredients={menuData.ingredients}
        initialSelectedIds={
          selectedProduct
            ? menuData.productIngredients
                .filter((pi) => pi.product_id === selectedProduct.id)
                .map((pi) => pi.ingredient_id)
            : []
        }
        onIngredientCreated={(ing) => {
          setMenuData(prev => prev ? {
            ...prev,
            ingredients: [...prev.ingredients, ing]
          } : prev);
        }}
        onSave={async (prodId, ingredientIds) => {
          try {
            await menuApi.setProductIngredients(prodId, ingredientIds);
            addToast("success", "Ingredientes atualizados!");
            loadMenu();
          } catch {
            addToast("error", "Erro ao salvar ingredientes");
          }
        }}
      />
    </div>
  );
}

// ─── Product List ───────────────────────────────────────
interface ProductListProps {
  products: Product[];
  menuData: MenuData;
  isAdmin: boolean;
  savingId: string | null;
  editing: EditingState;
  onToggle: (p: Product) => void;
  onStartEdit: (id: string, field: "name" | "price", value: string) => void;
  onEditChange: (value: string) => void;
  onSaveField: (p: Product, field: "name" | "price", value: string) => void;
  onCancelEdit: () => void;
  onEditProduct: (p: Product) => void;
  onConfigureAddons: (p: Product) => void;
  onConfigureIngredients: (p: Product) => void;
}

function ProductList({
  products,
  menuData,
  isAdmin,
  savingId,
  editing,
  onToggle,
  onStartEdit,
  onEditChange,
  onSaveField,
  onCancelEdit,
  onEditProduct,
  onConfigureAddons,
  onConfigureIngredients,
}: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="text-center text-zinc-400 py-16">
        <PackageX className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Nenhum produto nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {products.map((product) => {
        const isSaving = savingId === product.id;
        const isInactive = !product.active;

        const myIngredientIds = menuData.productIngredients
          .filter((pi) => pi.product_id === product.id)
          .map((pi) => pi.ingredient_id);

        const myIngredientNames = menuData.ingredients
          .filter((ing) => myIngredientIds.includes(ing.id))
          .map((ing) => ing.name);

        const isEditingName =
          editing?.id === product.id && editing?.field === "name";
        const isEditingPrice =
          editing?.id === product.id && editing?.field === "price";

        return (
          <div
            key={product.id}
            className={`bg-white border rounded-2xl p-4 transition-all ${
              isInactive
                ? "border-red-200 bg-red-50/60"
                : "border-zinc-200 hover:border-zinc-300"
            } ${isSaving ? "opacity-70 pointer-events-none" : ""}`}
          >
            {/* Top row */}
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Name */}
                {isEditingName ? (
                  <InlineInput
                    value={editing!.value}
                    onChange={onEditChange}
                    onSave={() =>
                      onSaveField(product, "name", editing!.value)
                    }
                    onCancel={onCancelEdit}
                    className="text-lg font-bold"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <h3
                      className={`font-bold text-sm leading-snug ${
                        isInactive
                          ? "text-zinc-400 line-through decoration-zinc-300"
                          : "text-brand-charcoal"
                      }`}
                    >
                      {product.name}
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={() =>
                          onStartEdit(product.id, "name", product.name)
                        }
                        className="p-1 rounded-md text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 opacity-0 group-hover:opacity-100 transition-all"
                        title="Editar nome"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Price */}
                {isEditingPrice ? (
                  <div className="mt-1">
                    <InlineInput
                      value={editing!.value}
                      onChange={onEditChange}
                      onSave={() =>
                        onSaveField(product, "price", editing!.value)
                      }
                      onCancel={onCancelEdit}
                      prefix="R$"
                      inputMode="decimal"
                      className="text-base font-semibold text-amber-600"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1 group">
                    <p className="text-amber-600 font-semibold">
                      R$ {product.price.toFixed(2)}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() =>
                          onStartEdit(
                            product.id,
                            "price",
                            product.price.toFixed(2)
                          )
                        }
                        className="p-1 rounded-md text-zinc-300 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Editar preço"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Sector + Status badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-md font-medium">
                    {sectorLabel(product.sector)}
                  </span>
                  {isInactive && (
                    <span className="text-[11px] px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-bold flex items-center gap-1">
                      <PackageX className="w-3 h-3" />
                      Indisponível
                    </span>
                  )}
                </div>
              </div>

              {/* Management buttons */}
              {isAdmin && (
                <div className="flex gap-2">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onEditProduct(product)}
                      className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-90 transition-all"
                      title="Editar detalhes"
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onToggle(product)}
                      disabled={isSaving}
                      className={`p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                        isSaving ? "opacity-50 cursor-not-allowed" : ""
                      } ${
                        product.active
                          ? "bg-white border-zinc-200 text-red-500 hover:bg-red-50 hover:border-red-200"
                          : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      }`}
                      title={
                        product.active
                          ? "Marcar como indisponível"
                          : "Marcar como disponível"
                      }
                    >
                      {isSaving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : product.active ? (
                        <PackageX className="w-5 h-5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom configuration row */}
            {isAdmin && (
              <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
                <button
                  onClick={() => onConfigureAddons(product)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold border border-zinc-200 hover:bg-zinc-200 transition-all"
                >
                  <PlusCircle className="w-3 h-3" />
                  Vincular Adicionais
                </button>
                <button
                  onClick={() => onConfigureIngredients(product)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold border border-zinc-200 hover:bg-zinc-200 transition-all"
                >
                  <PlusCircle className="w-3 h-3" />
                  Gerenciar Ingredientes
                </button>
              </div>
            )}

            {/* Ingredients */}
            {myIngredientNames.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">
                  Ingredientes
                </p>
                <p className="text-sm text-zinc-500 leading-snug">
                  {myIngredientNames.join(", ")}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Addon List ─────────────────────────────────────────
interface AddonListProps {
  addons: Addon[];
  isAdmin: boolean;
  savingId: string | null;
  editingAddon: EditingState;
  onToggle: (a: Addon) => void;
  onStartEdit: (id: string, value: string) => void;
  onEditChange: (value: string) => void;
  onSavePrice: (a: Addon, value: string) => void;
  onCancelEdit: () => void;
  onEditAddon: (a: Addon) => void;
}

function AddonList({
  addons,
  isAdmin,
  savingId,
  editingAddon,
  onToggle,
  onStartEdit,
  onEditChange,
  onSavePrice,
  onCancelEdit,
  onEditAddon,
}: AddonListProps) {
  if (addons.length === 0) {
    return (
      <div className="text-center text-zinc-400 py-16">
        <PackageX className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Nenhum adicional cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {addons.map((addon) => {
        const isSaving = savingId === addon.id;
        const isInactive = !addon.active;
        const isEditingPrice =
          editingAddon?.id === addon.id && editingAddon?.field === "price";

        return (
          <div
            key={addon.id}
            className={`bg-white border rounded-2xl p-4 flex items-center justify-between gap-3 transition-all ${
              isInactive
                ? "border-red-200 bg-red-50/60"
                : "border-zinc-200 hover:border-zinc-300"
            } ${isSaving ? "opacity-70 pointer-events-none" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <h3
                className={`font-bold text-sm ${
                  isInactive
                    ? "text-zinc-400 line-through decoration-zinc-300"
                    : "text-brand-charcoal"
                }`}
              >
                {addon.name}
              </h3>

              {/* Price */}
              {isEditingPrice ? (
                <div className="mt-1">
                  <InlineInput
                    value={editingAddon!.value}
                    onChange={onEditChange}
                    onSave={() => onSavePrice(addon, editingAddon!.value)}
                    onCancel={onCancelEdit}
                    prefix="+ R$"
                    inputMode="decimal"
                    className="text-base font-semibold text-amber-600"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1 group">
                  <p className="text-amber-600 font-semibold">
                    + R$ {addon.price.toFixed(2)}
                  </p>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        onStartEdit(addon.id, addon.price.toFixed(2))
                      }
                      className="p-1 rounded-md text-zinc-300 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Editar preço"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {isInactive && (
                <span className="text-[11px] mt-2 inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-bold items-center gap-1">
                  <PackageX className="w-3 h-3" />
                  Indisponível
                </span>
              )}
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onEditAddon(addon)}
                    className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-90 transition-all"
                    title="Editar detalhes"
                  >
                    <Settings2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onToggle(addon)}
                    disabled={isSaving}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                      isSaving ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      addon.active
                        ? "bg-white border-zinc-200 text-red-500 hover:bg-red-50 hover:border-red-200"
                        : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : addon.active ? (
                      <PackageX className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline Edit Input ──────────────────────────────────
interface InlineInputProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  prefix?: string;
  inputMode?: "text" | "decimal";
  className?: string;
}

function InlineInput({
  value,
  onChange,
  onSave,
  onCancel,
  prefix,
  inputMode = "text",
  className = "",
}: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay to ensure the element is rendered
    const timeout = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {prefix && (
        <span className="text-sm font-medium text-zinc-500">{prefix}</span>
      )}
      <input
        ref={ref}
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onSave}
        className={`w-full border-b-2 border-amber-400 bg-transparent outline-none py-0.5 ${className}`}
      />
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="p-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 active:scale-90 transition-all"
        title="Salvar"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────
function sectorLabel(sector: string): string {
  switch (sector) {
    case "KITCHEN":
      return "🍳 Cozinha";
    case "JUICE_POTATO":
      return "🥤 Sucos/Batata";
    case "NONE":
      return "—";
    default:
      return sector;
  }
}
function CategoryList({
  categories,
  isAdmin,
  savingId,
  onToggle,
  onEditCategory,
}: {
  categories: Category[];
  isAdmin: boolean;
  savingId: string | null;
  onToggle: (cat: Category) => Promise<void>;
  onEditCategory: (cat: Category) => void;
}) {
  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div
          key={cat.id}
          className={`bg-white p-4 rounded-2xl border transition-all ${
            cat.active ? "border-zinc-100" : "border-zinc-200 bg-zinc-50/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                  cat.active ? "bg-brand-red/10 text-brand-red" : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {cat.name.charAt(0)}
              </div>
              <div>
                <h3 className={`font-bold ${cat.active ? "text-brand-charcoal" : "text-zinc-400"}`}>
                  {cat.name}
                </h3>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  Ordem: {cat.sort_order}
                </span>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditCategory(cat)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onToggle(cat)}
                  disabled={savingId === cat.id}
                  className={`p-2 rounded-full transition-colors ${
                    cat.active
                      ? "text-green-500 hover:bg-green-50"
                      : "text-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  {savingId === cat.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className={`w-5 h-5 ${!cat.active && "opacity-30"}`} />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
