"use client";

import { useMemo, useState } from "react";
import { Addon, Category, Product } from "@/types/pdv";
import { Loader2, X, Save, Check } from "lucide-react";

interface ProductLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (addonId: string, productIds: string[]) => Promise<void>;
  addon: Addon | null;
  allProducts: Product[];
  categories: Category[];
  initialSelectedIds: string[];
}

export function ProductLinkingModal({
  isOpen,
  onClose,
  onSave,
  addon,
  allProducts,
  categories,
  initialSelectedIds,
}: ProductLinkingModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const p of allProducts) {
      const list = byCategory.get(p.category_id) ?? [];
      list.push(p);
      byCategory.set(p.category_id, list);
    }
    return categories
      .map((c) => ({ category: c, products: byCategory.get(c.id) ?? [] }))
      .filter((g) => g.products.length > 0);
  }, [allProducts, categories]);

  if (!isOpen || !addon) return null;

  const toggleProduct = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const toggleCategory = (productIds: string[]) => {
    const allSelected = productIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => !productIds.includes(id));
      return allSelected ? filtered : [...filtered, ...productIds];
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await onSave(addon.id, selectedIds);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Vincular Produtos</h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium truncate">
              {addon.name} — em quais itens este adicional aparece?
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-subtle)] rounded-full transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-6 h-6 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2 pr-1">
          {grouped.map(({ category, products }) => {
            const selectedCount = products.filter((p) => selectedIds.includes(p.id)).length;
            const allSelected = selectedCount === products.length;
            return (
              <div key={category.id}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {category.name}{" "}
                    <span className="text-[var(--text-muted)] font-bold normal-case">
                      ({selectedCount}/{products.length})
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      toggleCategory(products.map((p) => p.id))
                    }
                    className="text-[10px] font-bold uppercase tracking-wider text-brand-red hover:underline"
                  >
                    {allSelected ? "Limpar" : "Selecionar todos"}
                  </button>
                </div>
                <div className="space-y-2">
                  {products.map((product) => {
                    const isSelected = selectedIds.includes(product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isSelected
                            ? "bg-brand-red/5 border-brand-red/30 shadow-sm"
                            : "bg-[var(--bg-subtle)] border-[var(--border)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <div className="flex flex-col items-start min-w-0">
                          <span
                            className={`font-bold text-sm truncate ${
                              isSelected ? "text-brand-red" : "text-[var(--text-primary)]"
                            }`}
                          >
                            {product.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            R$ {product.price.toFixed(2)}
                            {!product.active && " · inativo"}
                          </span>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected
                              ? "bg-brand-red border-brand-red text-white"
                              : "bg-[var(--bg-surface)] border-[var(--border)]"
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {grouped.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-10">
              Nenhum produto cadastrado nesta filial ainda.
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-brand-charcoal text-white py-4 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Salvar Vínculos
            </>
          )}
        </button>
      </div>
    </div>
  );
}
