"use client";

import { useState } from "react";
import { Category } from "@/types/pdv";
import { Loader2, X, Save } from "lucide-react";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Category>) => Promise<void>;
  category?: Category | null;
}

export function CategoryModal({
  isOpen,
  onClose,
  onSave,
  category,
}: CategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Category>>(
    category || {
      name: "",
      sort_order: 0,
      active: true,
      counts_for_loyalty: false,
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
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {category ? "Editar Categoria" : "Nova Categoria"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
              Nome da Categoria
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 transition-all"
              placeholder="Ex: Bebidas"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
              Ordem de Exibição
            </label>
            <input
              type="number"
              required
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 transition-all"
            />
          </div>

          <label className="flex items-start gap-3 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={!!formData.counts_for_loyalty}
              onChange={(e) => setFormData({ ...formData, counts_for_loyalty: e.target.checked })}
              className="mt-0.5 w-5 h-5 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-400/20"
            />
            <span>
              <span className="block text-sm font-semibold text-brand-charcoal">
                Conta para o selo de fidelidade
              </span>
              <span className="block text-xs text-zinc-500 mt-0.5">
                Cada unidade paga de um item desta categoria dá 1 selo no cartão fidelidade do cliente.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--bg-inverse)] text-white py-4 rounded-2xl font-bold shadow-lg shadow-black/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {category ? "Salvar Alterações" : "Criar Categoria"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
