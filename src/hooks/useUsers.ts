import { useCallback, useEffect, useState } from "react";
import { usersApi, UserProfile, CreateUserData } from "@/lib/api/users-api";

// Carrega e mantém a lista de usuários em sincronia após cada mutação.
// Erros são relançados para o caller decidir como exibir (toast) — este hook
// só é dono do estado da lista, não de feedback de UI.
export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await usersApi.listUsers();
    setUsers(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount é o padrão já usado no resto do projeto (ex: usuarios/page.tsx original)
    reload()
      .catch(() => { /* o caller decide como reportar; aqui só evita crash no mount */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const createUser = useCallback(async (data: CreateUserData) => {
    const result = await usersApi.createUser(data);
    await reload();
    return result;
  }, [reload]);

  const updateUser = useCallback(async (data: {
    id: string;
    name: string;
    role: string;
    branch_ids?: string[];
    home_branch_id?: string | null;
  }) => {
    await usersApi.updateUser(data);
    await reload();
  }, [reload]);

  const toggleStatus = useCallback(async (id: string, active: boolean) => {
    await usersApi.toggleStatus(id, active);
    await reload();
  }, [reload]);

  const deleteUser = useCallback(async (id: string) => {
    await usersApi.deleteUser(id);
    await reload();
  }, [reload]);

  const resetPassword = useCallback(async (id: string, password: string) => {
    await usersApi.resetPassword(id, password);
  }, []);

  return { users, loading, reload, createUser, updateUser, toggleStatus, deleteUser, resetPassword };
}
