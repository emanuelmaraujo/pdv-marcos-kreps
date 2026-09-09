'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Branch } from '@/types/pdv';
import { branchesAdminApi } from '@/lib/api/branches-admin-api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { Building2, Plus } from 'lucide-react';
import { BranchListItem } from './components/BranchListItem';
import { getFriendlyErrorMessage } from '@/lib/errors/messages';
import { useUser } from '@/contexts/UserContext';
import { SettingsBadge, SettingsPageHeader } from '../components/SettingsPageHeader';

export default function FiliaisPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentBranchId, refresh: refreshCtx } = useBranch();
  const { toasts, addToast, removeToast } = useToast();
  const { isGlobalAdmin } = useUser();
  const activeCount = branches.filter((branch) => branch.active).length;
  const deliveryCount = branches.filter((branch) => branch.delivery_enabled).length;

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
        description="Gerencie identidade, horários, entrega, impressão e comunicação de cada unidade em um único fluxo."
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

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2" aria-label="Carregando filiais">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]" />)}
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-10 text-center">
          <p className="font-bold text-[var(--text-primary)]">Nenhuma filial cadastrada</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Crie a primeira unidade para começar a configurar a operação.</p>
        </div>
      ) : (
        <section aria-label="Filiais cadastradas" className="grid gap-3 lg:grid-cols-2">
          {branches.map((b) => (
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
