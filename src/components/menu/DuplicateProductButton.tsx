'use client';

import { useState } from 'react';
import { Copy, Loader2, X, Check } from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import { branchesAdminApi } from '@/lib/api/branches-admin-api';

/**
 * Botão "Duplicar para outra filial" — pluga em qualquer lugar onde
 * você tem um productId e quer espelhá-lo numa filial diferente.
 *
 * Comportamento:
 *   - Abre um pop-over listando filiais (exceto a corrente).
 *   - Ao escolher, cria o produto-espelho lá (categoria irmã criada se faltar).
 *   - `onCloned` é chamado com o novo id após sucesso.
 */
export function DuplicateProductButton({
  productId,
  onCloned,
  compact = false,
}: {
  productId: string;
  onCloned?: (newProductId: string, branchId: string) => void;
  compact?: boolean;
}) {
  const { branches, currentBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBranchId, setSuccessBranchId] = useState<string | null>(null);

  const targets = branches.filter((b) => b.id !== currentBranch?.id && b.active);

  const handleClone = async (targetBranchId: string) => {
    setBusy(targetBranchId);
    setError(null);
    setSuccessBranchId(null);
    try {
      const newId = await branchesAdminApi.cloneProductToBranch(productId, targetBranchId);
      setSuccessBranchId(targetBranchId);
      onCloned?.(newId, targetBranchId);
      setTimeout(() => setOpen(false), 800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao duplicar.');
    } finally {
      setBusy(null);
    }
  };

  if (targets.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-600 hover:bg-zinc-50 ${
          compact ? '' : 'shadow-sm'
        }`}
      >
        <Copy className="h-3 w-3" />
        {compact ? '' : 'Duplicar p/ filial'}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Duplicar para
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded p-0.5 hover:bg-zinc-200">
              <X className="h-3 w-3" />
            </button>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {targets.map((b) => {
              const isBusy = busy === b.id;
              const isDone = successBranchId === b.id;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => handleClone(b.id)}
                    disabled={isBusy}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded-md bg-brand-charcoal px-1.5 py-0.5 text-[10px] font-black text-white">{b.code}</span>
                      {b.name}
                    </span>
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                      : isDone ? <Check className="h-3 w-3 text-emerald-600" />
                      : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
