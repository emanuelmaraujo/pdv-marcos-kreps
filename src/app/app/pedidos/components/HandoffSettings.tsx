'use client';
import { useEffect, useState } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { useUser } from '@/contexts/UserContext';
import { createClient } from '@/lib/supabase/client';
import { handoffApi } from '@/lib/api/handoff-api';

type Config = { sector: string; mode: string; enabled: boolean; version: number };
export function HandoffSettings({ onChanged }: { onChanged: () => void }) {
  const { currentBranchId } = useBranch();
  const { isAdmin } = useUser();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loadedBranch, setLoadedBranch] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let disposed = false;
    if (!currentBranchId) return;
    void createClient().from('production_handoff_config').select('sector,mode,enabled,version').eq('branch_id',currentBranchId).then(({ data, error }) => {
      if (disposed) return;
      setLoadedBranch(error ? null : currentBranchId); setConfigs(data ?? []);
      setMessage(error ? 'Configuração indisponível. Atualize após conferir a migration.' : '');
    });
    return () => { disposed = true; };
  }, [currentBranchId, reload]);
  if (!isAdmin || !currentBranchId) return null;
  const configure = async (sector: string, mode: string, enabled: boolean) => {
    setBusy(true); setMessage('');
    const version = configs.find((c) => c.sector === sector)?.version ?? null;
    try {
      await handoffApi.configure(currentBranchId, sector, mode, enabled, version);
      const { data, error } = await createClient().from('production_handoff_config').select('sector,mode,enabled,version').eq('branch_id',currentBranchId);
      if (error) throw error;
      setConfigs(data ?? []); setMessage('Configuração registrada com auditoria.'); onChanged();
    } catch { setMessage('Não foi possível confirmar a configuração. Atualize o quadro antes de tentar novamente.'); setLoadedBranch(null); }
    finally { setBusy(false); }
  };
  return <details className="mx-0 mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]">
    <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Repasse por setor · configurar filial atual</summary>
    <p className="mb-3 text-xs text-[var(--text-secondary)]">Confirme a operação da filial antes de ativar. Este ajuste não liga/desliga impressoras e não libera pedidos que aguardam pagamento. No modo impressora, jobs sem cobertura ficam desconhecidos.</p>
    {loadedBranch !== currentBranchId && <button type="button" className="mb-2 min-h-11 rounded-lg border border-[var(--border)] px-3" onClick={() => setReload((v) => v + 1)}>Recarregar configuração</button>}
    {['KITCHEN','JUICE_POTATO'].map((sector) => {
      const cfg = configs.find((c) => c.sector === sector);
      return <fieldset key={sector} disabled={busy || loadedBranch !== currentBranchId} className="mb-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-2"><legend className="font-semibold">{sector === 'KITCHEN' ? 'Kreps' : 'Cozinha / sucos'} · {cfg?.enabled ? (cfg.mode === 'MANUAL' ? 'Manual ativo' : 'Impressora ativa') : 'Não ativo'}</legend>
        <button type="button" className="min-h-11 rounded-lg border border-[var(--border)] px-3 disabled:opacity-50" onClick={() => void configure(sector,'MANUAL',true)}>Ativar anotação manual</button>
        <button type="button" className="min-h-11 rounded-lg border border-[var(--border)] px-3 disabled:opacity-50" onClick={() => void configure(sector,'PRINTER',true)}>Usar evidência de impressão</button>
        {cfg?.enabled && <button type="button" className="min-h-11 rounded-lg border border-[var(--border)] px-3 disabled:opacity-50" onClick={() => void configure(sector,cfg.mode,false)}>Desativar repasse</button>}
      </fieldset>;
    })}<p role="status" className="pb-2 text-xs">{message || (loadedBranch !== currentBranchId ? 'Carregando configuração…' : '')}</p>
  </details>;
}
