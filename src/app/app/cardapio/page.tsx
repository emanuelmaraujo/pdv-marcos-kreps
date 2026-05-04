"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { menuApi, MenuData } from "@/lib/api/menu-api";
import { Product, Addon } from "@/types/pdv";
import {
  Loader2,
  AlertCircle,
  PackageX,
  CheckCircle2,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ToastContainer, useToast } from "@/components/ui/Toast";

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
      } else {
        setError("Erro ao carregar cardápio");
      }
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          setIsAdmin(profile?.role === "ADMIN");
        }

        const data = await menuApi.getFullMenuData();
        if (!cancelled) {
          setMenuData(data);
          if (data.categories.length > 0) {
            setActiveCategory(data.categories[0].id);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (err instanceof Error) {
            setError(err.message || "Erro ao carregar cardápio");
          } else {
            setError("Erro ao carregar cardápio");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="flex flex-col h-full bg-slate-50">
        <PageHeader title="Cardápio" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <PageHeader title="Cardápio" />
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={loadMenu}
            className="mt-4 w-full py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-transform"
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
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
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

      {/* Category Tabs */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto hide-scrollbar">
        <div className="flex p-3 gap-2 min-w-max">
          {menuData.categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === category.id
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95"
              }`}
            >
              {category.name}
            </button>
          ))}
          <button
            onClick={() => setActiveCategory("addons")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeCategory === "addons"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95"
            }`}
          >
            Adicionais
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeCategory !== "addons" ? (
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
          />
        ) : (
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
          />
        )}
      </div>
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
}: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="text-center text-slate-400 py-16">
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
                : "border-slate-200 hover:border-slate-300"
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
                      className={`font-bold text-lg leading-snug ${
                        isInactive
                          ? "text-slate-400 line-through decoration-slate-300"
                          : "text-slate-800"
                      }`}
                    >
                      {product.name}
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={() =>
                          onStartEdit(product.id, "name", product.name)
                        }
                        className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
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
                        className="p-1 rounded-md text-slate-300 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Editar preço"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Sector + Status badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-medium">
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

              {/* Toggle button */}
              {isAdmin && (
                <button
                  onClick={() => onToggle(product)}
                  disabled={isSaving}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                    isSaving ? "opacity-50 cursor-not-allowed" : ""
                  } ${
                    product.active
                      ? "bg-white border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200"
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
              )}
            </div>

            {/* Ingredients */}
            {myIngredientNames.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                  Ingredientes
                </p>
                <p className="text-sm text-slate-500 leading-snug">
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
}: AddonListProps) {
  if (addons.length === 0) {
    return (
      <div className="text-center text-slate-400 py-16">
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
                : "border-slate-200 hover:border-slate-300"
            } ${isSaving ? "opacity-70 pointer-events-none" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <h3
                className={`font-bold ${
                  isInactive
                    ? "text-slate-400 line-through decoration-slate-300"
                    : "text-slate-800"
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
                      className="p-1 rounded-md text-slate-300 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-all"
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

            {/* Toggle */}
            {isAdmin && (
              <button
                onClick={() => onToggle(addon)}
                disabled={isSaving}
                className={`p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                  isSaving ? "opacity-50 cursor-not-allowed" : ""
                } ${
                  addon.active
                    ? "bg-white border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                }`}
                title={
                  addon.active
                    ? "Marcar como indisponível"
                    : "Marcar como disponível"
                }
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : addon.active ? (
                  <PackageX className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </button>
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
        <span className="text-sm font-medium text-slate-500">{prefix}</span>
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
