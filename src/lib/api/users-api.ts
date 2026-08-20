import { createClient } from "../supabase/client";

const supabase = createClient();

type EdgeFunctionError = {
  message?: string;
  context?: Response | Record<string, unknown>;
};

type ManageUsersResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ATTENDANT' | 'COURIER';
  active: boolean;
  last_sign_in_at?: string;
  created_at: string;
};

export interface CreateUserData {
  email: string;
  name: string;
  role: 'ADMIN' | 'ATTENDANT' | 'COURIER';
  password?: string;
  active?: boolean;
  branch_ids?: string[];
  home_branch_id?: string | null;
  /** Só usado quando role === 'COURIER' — vira couriers.phone. */
  phone?: string;
}

async function extractFunctionError(error: EdgeFunctionError, fallback: string) {
  const ctx = error.context;

  if (ctx && ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      const message = body?.error || body?.message || body?.details;
      if (message) return new Error(String(message));
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return new Error(text);
      } catch {
        // Fall through to the generic message below.
      }
    }
  }

  if (ctx && typeof ctx === "object" && !(ctx instanceof Response)) {
    const body = ctx as Record<string, unknown>;
    const message = body.error || body.message || body.details;
    if (message) return new Error(String(message));
  }

  return new Error(error.message || fallback);
}

async function invokeManageUsers<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ManageUsersResponse<T>>('manage-users', { body });
  if (error) throw await extractFunctionError(error, fallback);
  if (!data?.success) throw new Error(data?.error || fallback);
  return data.data as T;
}

export const usersApi = {
  async listUsers(): Promise<UserProfile[]> {
    return invokeManageUsers<UserProfile[]>({ action: 'list_users' }, 'Falha ao listar usuários');
  },

  async createUser(userData: CreateUserData) {
    return invokeManageUsers<{ id: string }>({ action: 'create_user', data: userData }, 'Falha ao criar usuário');
  },

  async updateUser(userData: {
    id: string;
    name: string;
    role: string;
    branch_ids?: string[];
    home_branch_id?: string | null;
  }) {
    return invokeManageUsers<unknown>({ action: 'update_user', data: userData }, 'Falha ao atualizar usuário');
  },

  async resetPassword(id: string, password: string) {
    return invokeManageUsers<unknown>({ action: 'reset_password', data: { id, password } }, 'Falha ao redefinir senha');
  },

  async toggleStatus(id: string, active: boolean) {
    return invokeManageUsers<unknown>({ action: 'toggle_user_status', data: { id, active } }, 'Falha ao alterar status do usuário');
  },

  async deleteUser(id: string) {
    return invokeManageUsers<unknown>({ action: 'delete_user', data: { id } }, 'Falha ao excluir usuário');
  }
};
