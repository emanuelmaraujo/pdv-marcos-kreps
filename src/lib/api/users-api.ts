import { createClient } from "../supabase/client";

const supabase = createClient();

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ATTENDANT';
  active: boolean;
  last_sign_in_at?: string;
  created_at: string;
};

export interface CreateUserData {
  email: string;
  name: string;
  role: 'ADMIN' | 'ATTENDANT';
  password?: string;
  active?: boolean;
}

export const usersApi = {
  async listUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'list_users' }
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao listar usuários');
    return data.data;
  },

  async createUser(userData: CreateUserData) {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'create_user', data: userData }
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao criar usuário');
    return data.data;
  },

  async updateUser(userData: { id: string; name: string; role: string }) {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'update_user', data: userData }
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao atualizar usuário');
    return data.data;
  },

  async toggleStatus(id: string, active: boolean) {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'toggle_user_status', data: { id, active } }
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao alterar status do usuário');
    return data.data;
  }
};
