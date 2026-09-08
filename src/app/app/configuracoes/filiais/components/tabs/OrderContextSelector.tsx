import { OrderSource, OrderType } from "@/types/pdv";
import { ORDER_SOURCE_OPTIONS, ORDER_TYPE_OPTIONS } from "../../utils";

function SelectionGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (value: T) => {
    if (selected.includes(value)) {
      if (selected.length === 1) return;
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-[var(--text-secondary)]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.value)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                active
                  ? 'border-brand-red bg-brand-red/10 text-brand-red'
                  : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OrderContextSelector({
  orderTypes,
  orderSources,
  onOrderTypesChange,
  onOrderSourcesChange,
}: {
  orderTypes: OrderType[];
  orderSources: OrderSource[];
  onOrderTypesChange: (next: OrderType[]) => void;
  onOrderSourcesChange: (next: OrderSource[]) => void;
}) {
  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3">
      <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
        A regra só será aplicada aos contextos selecionados. Mantenha ao menos uma opção em cada grupo.
      </p>
      <SelectionGroup label="Tipos de pedido" options={ORDER_TYPE_OPTIONS} selected={orderTypes} onChange={onOrderTypesChange} />
      <SelectionGroup label="Origem do pedido" options={ORDER_SOURCE_OPTIONS} selected={orderSources} onChange={onOrderSourcesChange} />
    </div>
  );
}
