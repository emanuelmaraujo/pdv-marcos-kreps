"use client";

import { useState } from "react";
import { Product, Category } from "@/types/pdv";
import { Loader2, X, Save } from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  categories: Category[];
  product?: Product | null;
}

export function ProductModal({
  isOpen,
  onClose,
  onSave,
  categories,
  product,
}: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>(
    product || {
      name: "",
      price: 0,
      category_id: categories[0]?.id || "",
      sector: "KITCHEN",
      active: true,
    }
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-brand-charcoal">
            {product ? "Editar Produto" : "Novo Produto"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 ml-1">
              Nome do Produto
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              placeholder="Ex: Krep Especial"
            />
          </div>

          <div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 ml-1">
                Preço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 ml-1">
              Categoria
            </label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all appearance-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 ml-1">
              Setor de Produção
            </label>
            <div className="flex gap-2">
              {(["KITCHEN", "JUICE_POTATO", "NONE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormData({ ...formData, sector: s })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                    formData.sector === s
                      ? "bg-brand-charcoal text-white border-brand-charcoal shadow-md"
                      : "bg-white text-zinc-500 border-zinc-200"
                  }`}
                >
                  {s === "KITCHEN" ? "Cozinha" : s === "JUICE_POTATO" ? "Sucos/Batata" : "Nenhum"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-red/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {product ? "Salvar Alterações" : "Criar Produto"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
