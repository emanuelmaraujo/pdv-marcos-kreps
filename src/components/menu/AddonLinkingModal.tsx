"use client";

import { useState } from "react";
import { Product, Addon } from "@/types/pdv";
import { Loader2, X, Save, Check } from "lucide-react";

interface AddonLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product_id: string, addon_ids: string[]) => Promise<void>;
  product: Product | null;
  allAddons: Addon[];
  initialSelectedIds: string[];
}

export function AddonLinkingModal({
  isOpen,
  onClose,
  onSave,
  product,
  allAddons,
  initialSelectedIds,
}: AddonLinkingModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  if (!isOpen || !product) return null;

  const toggleAddon = (id: string) => {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-brand-charcoal">
              Vincular Adicionais
            </h2>
            <p className="text-sm text-zinc-500 font-medium">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-2 pr-2">
          {allAddons.map((addon) => {
            const isSelected = selectedIds.includes(addon.id);
            return (
              <button
                key={addon.id}
                onClick={() => toggleAddon(addon.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? "bg-brand-red/5 border-brand-red/30 shadow-sm"
                    : "bg-zinc-50 border-zinc-100 hover:border-zinc-200"
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className={`font-bold text-sm ${isSelected ? "text-brand-red" : "text-brand-charcoal"}`}>
                    {addon.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    + R$ {addon.price.toFixed(2)}
                  </span>
                </div>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? "bg-brand-red border-brand-red text-white" : "bg-white border-zinc-200"
                }`}>
                  {isSelected && <Check className="w-4 h-4" />}
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
              Salvar Vínculos
            </>
          )}
        </button>
      </div>
    </div>
  );
}
