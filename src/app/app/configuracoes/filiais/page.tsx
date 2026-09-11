'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Branch } from '@/types/pdv';
import { branchesAdminApi } from '@/lib/api/branches-admin-api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { Building2, Plus, Search } from 'lucide-react';
import { BranchListItem } from './components/BranchListItem';
import { getFriendlyErrorMessage } from '@/lib/errors/messages';
import { useUser } from '@/contexts/UserContext';
import { SettingsBadge, SettingsPageHeader } from '../components/SettingsPageHeader';

export default function FiliaisPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { currentBranchId, refresh: refreshCtx } = useBranch();
  const { toasts, addToast, removeToast } = useToast();
  const { isGlobalAdmin } = useUser();
  const activeCount = branches.filter((branch) => branch.active).length;
  const deliveryCount = branches.filter((branch) => branch.delivery_enabled).length;
  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return branches.filter((branch) => {
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? branch.active : !branch.active);
      const matchesQuery = !normalizedQuery || [branch.name, branch.code, branch.slug, branch.address]
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [branches, query, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBranches(await branchesAdminApi.listAll());
    } catch (e: unknown) {
      addToast('error', getFriendlyErrorMessage(e, 'Não conseguimos carregar as filiais. Tente novamente.'));
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
      addToast('error', getFriendlyErrorMessage(e, 'Não conseguimos alterar o status da filial.'));
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SettingsPageHeader
        eyebrow="Estrutura da operação"
        title="Filiais"
        description="Encontre uma unidade e configure somente o que precisa: operação, entrega, impressão, comunicação ou taxas."
        icon={Building2}
        meta={
          <>
            <SettingsBadge tone="success">{activeCount} ativa{activeCount === 1 ? '' : 's'}</SettingsBadge>
            <SettingsBadge tone="info">{deliveryCount} com entrega</SettingsBadge>
            <SettingsBadge>{branches.length} no total</SettingsBadge>
          </>
        }
        action={isGlobalAdmin ? (
          <Link href="/app/configuracoes/filiais/novo" className="block">
            <Button className="min-h-11 w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" strokeWidth={2} /> Nova filial
            </Button>
          </Link>
        ) : undefined}
      />

      {!loading && branches.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--elevation-1)]" aria-label="Filtrar filiais">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar filial</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, código, URL ou endereço"
                className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand-red/50 focus:outline-none focus:ring-2 focus:ring-brand-red/15"
              />
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-subtle)] p-1" role="group" aria-label="Filtrar por status">
              {([
                ['all', 'Todas'],
                ['active', 'Ativas'],
                ['inactive', 'Inativas'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={statusFilter === value}
                  className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${statusFilter === value ? 'bg-[var(--bg-surface)] text-brand-red shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 px-1 text-[11px] text-[var(--text-muted)]" aria-live="polite">
            {filteredBranches.length} {filteredBranches.length === 1 ? 'filial encontrada' : 'filiais encontradas'}
          </p>
        </section>
      ) : null}

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2" aria-label="Carregando filiais">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]" />)}
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-10 text-center">
          <p className="font-bold text-[var(--text-primary)]">Nenhuma filial cadastrada</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Crie a primeira unidade para começar a configurar a operação.</p>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="font-bold text-[var(--text-primary)]">Nenhuma filial corresponde aos filtros</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Ajuste a busca ou selecione outro status.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setStatusFilter('all'); }}
            className="mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-brand-red hover:bg-brand-red/10"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <section aria-label="Filiais cadastradas" className="grid gap-3 lg:grid-cols-2">
          {filteredBranches.map((b) => (
            <BranchListItem
              key={b.id}
              branch={b}
              isCurrent={b.id === currentBranchId}
              onToggleActive={() => toggleActive(b)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
