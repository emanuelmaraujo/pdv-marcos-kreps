'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, MapPin } from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';

const TYPE_LABEL: Record<string, string> = {
  STORE: 'Loja',
  POPUP: 'Pop-up',
  FAIR:  'Feira',
};

export function BranchSelector({ compact = false }: { compact?: boolean }) {
  const { branches, currentBranch, isLoading, setCurrentBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (isLoading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg bg-zinc-700/40 px-3 text-xs text-zinc-400">
        <Building2 className="h-3.5 w-3.5 animate-pulse" />
        <span>Carregando filiais...</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return null; // nenhuma filial vinculada — não mostra o seletor
  }

  // Filial única: mostra como label estático.
  if (branches.length === 1) {
    const b = branches[0];
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg bg-zinc-700/40 px-3 text-xs font-bold text-white">
        <span className="rounded-md bg-brand-red px-1.5 py-0.5 text-[10px] font-black">{b.code}</span>
        {!compact && <span className="truncate max-w-[140px]">{b.name}</span>}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-lg bg-zinc-700/40 px-3 text-xs font-bold text-white transition-all hover:bg-zinc-700/70"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="rounded-md bg-brand-red px-1.5 py-0.5 text-[10px] font-black">
          {currentBranch?.code ?? '–'}
        </span>
        {!compact && (
          <span className="hidden truncate sm:inline max-w-[140px]">
            {currentBranch?.name ?? 'Filial'}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg ring-1 ring-black/5"
          role="listbox"
        >
          <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Trocar de filial
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {branches.map((b) => {
              const selected = b.id === currentBranch?.id;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => { setCurrentBranch(b.id); setOpen(false); }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-all hover:bg-zinc-50 ${
                      selected ? 'bg-red-50' : ''
                    }`}
                    role="option"
                    aria-selected={selected}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-md bg-brand-red px-1.5 py-0.5 text-[10px] font-black text-white">
                        {b.code}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-zinc-800">{b.name}</p>
                        <p className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <MapPin className="h-2.5 w-2.5" />
                          {TYPE_LABEL[b.type] ?? b.type}
                          {!b.active && <span className="ml-1 text-red-500">· inativa</span>}
                        </p>
                      </div>
                    </div>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-red" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
