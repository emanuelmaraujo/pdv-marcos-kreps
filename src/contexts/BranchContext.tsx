'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Branch } from '@/types/pdv';
import { branchesApi } from '@/lib/api/branches-api';

interface BranchContextValue {
  branches: Branch[];
  currentBranch: Branch | null;
  isLoading: boolean;
  setCurrentBranch: (branchId: string, persist?: boolean) => void;
  refresh: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | null>(null);

const STORAGE_KEY = 'pdv:current_branch_id';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, homeBranch] = await Promise.all([
        branchesApi.listMyBranches(),
        branchesApi.getHomeBranch(),
      ]);
      setBranches(list);

      // Preferência de filial: localStorage > home_branch_id > primeira disponível.
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      const candidate = [stored, homeBranch, list[0]?.id].find((id) => id && list.some((b) => b.id === id));
      setCurrentBranchId(candidate ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const setCurrentBranch = useCallback((branchId: string, persist = true) => {
    setCurrentBranchId(branchId);
    if (persist && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, branchId);
      // Best-effort: também grava como home_branch_id pra que o atendente abra na mesma filial no próximo login.
      branchesApi.setHomeBranch(branchId).catch(() => {});
    }
  }, []);

  const currentBranch = useMemo(
    () => branches.find((b) => b.id === currentBranchId) ?? null,
    [branches, currentBranchId],
  );

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    currentBranch,
    isLoading,
    setCurrentBranch,
    refresh,
  }), [branches, currentBranch, isLoading, setCurrentBranch, refresh]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch deve ser usado dentro de <BranchProvider>.');
  return ctx;
}

// Helper para uso em chamadas de API: garante que existe filial selecionada.
export function useCurrentBranchId(): string | null {
  const { currentBranch } = useBranch();
  return currentBranch?.id ?? null;
}
