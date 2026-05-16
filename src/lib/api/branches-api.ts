import { createClient } from '../supabase/client';
import { Branch } from '@/types/pdv';

// Branches a que o usuário corrente tem acesso (filtrado pela função get_my_branches via RLS).
export const branchesApi = {
  listMyBranches: async (): Promise<Branch[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Branch[];
  },

  getHomeBranch: async (): Promise<string | null> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('home_branch_id')
      .eq('id', user.id)
      .single();
    if (error || !data) return null;
    return (data as { home_branch_id?: string }).home_branch_id ?? null;
  },

  setHomeBranch: async (branchId: string): Promise<void> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado.');
    const { error } = await supabase
      .from('profiles')
      .update({ home_branch_id: branchId })
      .eq('id', user.id);
    if (error) throw error;
  },
};
