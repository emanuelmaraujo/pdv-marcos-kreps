"use client";

import { useState } from "react";
import { Product, Ingredient } from "@/types/pdv";
import { Loader2, X, Save, Check, Plus } from "lucide-react";
import { menuApi } from "@/lib/api/menu-api";

interface IngredientLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product_id: string, ingredient_ids: string[]) => Promise<void>;
  product: Product | null;
  allIngredients: Ingredient[];
  initialSelectedIds: string[];
  onIngredientCreated: (ing: Ingredient) => void;
}

export function IngredientLinkingModal({
  isOpen,
  onClose,
  onSave,
  product,
  allIngredients,
  initialSelectedIds,
  onIngredientCreated,
}: IngredientLinkingModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [newIngName, setNewIngName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen || !product) return null;

  const toggleIngredient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await onSave(product.id, selectedIds);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIngredient = async () => {
    if (!newIngName.trim()) return;
    try {
      setIsCreating(true);
      const newIng = await menuApi.createIngredient(newIngName.trim());
      onIngredientCreated(newIng);
      setSelectedIds(prev => [...prev, newIng.id]);
      setNewIngName("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Gerenciar Ingredientes
            </h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Create new ingredient */}
        <div className="mb-4 flex gap-2 flex-shrink-0">
          <input
            type="text"
            value={newIngName}
            onChange={(e) => setNewIngName(e.target.value)}
            placeholder="Novo ingrediente..."
            className="flex-1 px-4 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-brand-red transition-all"
          />
          <button
            onClick={handleCreateIngredient}
            disabled={isCreating || !newIngName.trim()}
            className="p-2 bg-brand-red text-white rounded-xl disabled:opacity-50 active:scale-95 transition-all"
          >
            {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-2 pr-2">
          {allIngredients.map((ing) => {
            const isSelected = selectedIds.includes(ing.id);
            return (
              <button
                key={ing.id}
                onClick={() => toggleIngredient(ing.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? "bg-[var(--bg-subtle)] border-[var(--border-strong)]"
                    : "bg-[var(--bg-subtle)] border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className={`font-bold text-sm ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                  {ing.name}
                </span>
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                  isSelected ? "bg-[var(--bg-inverse)] border-[var(--bg-inverse)] text-white" : "bg-[var(--bg-surface)] border-[var(--border)]"
                }`}>
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
              </button>
            );
          })}
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
              Salvar Ingredientes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
