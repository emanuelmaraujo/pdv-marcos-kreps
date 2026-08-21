'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Branch } from '@/types/pdv';
import { branchesAdminApi } from '@/lib/api/branches-admin-api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { Loader2, Plus } from 'lucide-react';
import { BranchListItem } from './components/BranchListItem';

export default function FiliaisPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentBranchId, refresh: refreshCtx } = useBranch();
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBranches(await branchesAdminApi.listAll());
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao carregar filiais.');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleActive(b: Branch) {
    try {
      await branchesAdminApi.update(b.id, { active: !b.active });
      addToast('success', b.active ? 'Filial desativada.' : 'Filial reativada!');
      await Promise.all([load(), refreshCtx()]);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao alterar status.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 md:px-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Filiais</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Cada filial tem cardápio, impressoras e numeração próprios.
            Senha exibida como <strong className="text-[var(--text-primary)]">P-042-1</strong>.
          </p>
        </div>
        <Link href="/app/configuracoes/filiais/novo">
          <Button className="gap-2">
            <Plus className="h-4 w-4" strokeWidth={2} /> Nova filial
          </Button>
        </Link>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando filiais...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-secondary)]">
          Nenhuma filial cadastrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <BranchListItem
              key={b.id}
              branch={b}
              isCurrent={b.id === currentBranchId}
              onToggleActive={() => toggleActive(b)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
