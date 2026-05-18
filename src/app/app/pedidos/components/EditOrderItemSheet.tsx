"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { OrderItem } from "@/types/pdv";
import { createClient } from "@/lib/supabase/client";
import { pdvApi } from "@/lib/api/pdv-api";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Minus, Plus, Loader2, ShoppingBag, Utensils } from "lucide-react";

interface AvailableAddon {
  id: string;
  name: string;
  price: number;
  active: boolean;
}

interface ProductAddonRow {
  addons: AvailableAddon | AvailableAddon[] | null;
}

interface Props {
  item: OrderItem;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function EditOrderItemSheet({ item, isOpen, onClose, onSaved }: Props) {
  const [availableAddons, setAvailableAddons] = useState<AvailableAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());
  const [isTakeout, setIsTakeout] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAddons, setIsFetchingAddons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Estado inicial do item
    const takeout = item.is_takeout ?? item.observation?.startsWith("[VIAGEM]") ?? false;
    setIsTakeout(takeout);
    setError(null);

    const addonMap = new Map<string, number>();
    (item.addons ?? []).forEach((a) => {
      if (a.addon_id) addonMap.set(a.addon_id, a.quantity);
    });
    setSelectedAddons(addonMap);

    // Busca adicionais disponíveis para o produto
    setIsFetchingAddons(true);
    const supabase = createClient();
    supabase
      .from("product_addons")
      .select("addons(id, name, price, active)")
      .eq("product_id", item.product_id)
      .then(({ data }) => {
        const addons = ((data ?? []) as ProductAddonRow[])
          .flatMap((row) => Array.isArray(row.addons) ? row.addons : row.addons ? [row.addons] : [])
          .filter((addon) => addon.active);
        setAvailableAddons(addons);
        setIsFetchingAddons(false);
      }, () => {
        setIsFetchingAddons(false);
      });
  }, [isOpen, item]);

  const updateAddonQty = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const newQty = Math.max(0, (next.get(addonId) ?? 0) + delta);
      if (newQty === 0) next.delete(addonId);
      else next.set(addonId, newQty);
      return next;
    });
  };

  const addonsTotal = (() => {
    let total = 0;
    for (const [addonId, qty] of selectedAddons) {
      const addon = availableAddons.find((a) => a.id === addonId);
      if (addon) total += addon.price * qty * item.quantity;
    }
    return total;
  })();

  const estimatedTotal = Number(item.product_price_snapshot) * item.quantity + addonsTotal;

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await pdvApi.editOrderItem({
        orderItemId: item.id,
        addons: Array.from(selectedAddons.entries()).map(([addon_id, quantity]) => ({
          addon_id,
          quantity,
        })),
        is_takeout: isTakeout,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar alterações.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Editar item">
      <div className="p-5 space-y-5 pb-10">

        {/* Cabeçalho do item */}
        <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Editando</p>
          <p className="text-base font-black text-zinc-900 mt-0.5">
            {item.quantity}× {item.product_name_snapshot}
          </p>
          <p className="text-sm font-semibold text-zinc-500 mt-0.5">
            Base: {currency.format(Number(item.product_price_snapshot) * item.quantity)}
          </p>
        </div>

        {/* Adicionais */}
        {isFetchingAddons ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : availableAddons.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">
              Adicionais
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availableAddons.map((addon) => {
                const qty = selectedAddons.get(addon.id) ?? 0;
                const isSelected = qty > 0;
                return (
                  <div
                    key={addon.id}
                    className={`rounded-2xl border p-3 space-y-2 transition-colors ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold leading-tight ${isSelected ? "text-emerald-800" : "text-zinc-800"}`}>
                        {addon.name}
                      </p>
                      <p className={`text-[11px] font-bold mt-0.5 ${isSelected ? "text-emerald-600" : "text-brand-red"}`}>
                        +{currency.format(addon.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateAddonQty(addon.id, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-lg border border-zinc-200 bg-white flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform"
                      >
                        <Minus size={12} strokeWidth={2.5} />
                      </button>
                      <span className="w-5 text-center text-sm font-black tabular-nums text-zinc-900">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateAddonQty(addon.id, 1)}
                        className="w-7 h-7 rounded-lg border border-zinc-200 bg-white flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Plus size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Destino do item */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">
            Destino
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsTakeout(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition-all active:scale-[0.97] ${
                !isTakeout
                  ? "border-brand-charcoal bg-brand-charcoal text-white"
                  : "border-zinc-200 bg-white text-zinc-500"
              }`}
            >
              <Utensils size={15} strokeWidth={1.75} />
              Comer aqui
            </button>
            <button
              type="button"
              onClick={() => setIsTakeout(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition-all active:scale-[0.97] ${
                isTakeout
                  ? "border-brand-charcoal bg-brand-charcoal text-white"
                  : "border-zinc-200 bg-white text-zinc-500"
              }`}
            >
              <ShoppingBag size={15} strokeWidth={1.75} />
              Para levar
            </button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Rodapé fixo */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-100 pt-4 pb-2 space-y-3 -mx-5 px-5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Total do item
            </span>
            <span className="text-xl font-black text-brand-red">
              {currency.format(estimatedTotal)}
            </span>
          </div>
          <Button
            className="w-full h-13 font-black text-base"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
              </span>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
