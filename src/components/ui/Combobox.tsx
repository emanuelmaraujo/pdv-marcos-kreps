"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

/**
 * Dropdown com busca, estilizado igual ao resto do app — substitui um
 * <select> nativo em listas longas. Nunca use <select> nativo pra listas
 * com mais de ~8 itens: o navegador desenha o próprio popup do SO por cima
 * (preto/sem estilo no Windows), destoando completamente do resto da UI.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyLabel = "Nada encontrado.",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDown);
      // Foco no campo de busca só depois do popup montar, senão o clique que abriu rouba o foco.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-left text-sm transition-colors hover:border-[var(--border-strong)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate ${value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
          {value || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[var(--elevation-3)]"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{emptyLabel}</li>
            ) : (
              filtered.map((opt) => {
                const selected = opt === value;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)] ${
                        selected ? "font-bold text-brand-red" : "text-[var(--text-primary)]"
                      }`}
                      role="option"
                      aria-selected={selected}
                    >
                      <span className="truncate">{opt}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
