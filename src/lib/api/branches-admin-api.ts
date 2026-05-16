// CRUD de filiais e vínculos de atendentes — apenas ADMIN.
import { createClient } from '../supabase/client';
import { Branch, BranchType } from '@/types/pdv';

export interface BranchInput {
  code: string;
  slug: string;
  name: string;
  type: BranchType;
  active?: boolean;
  address?: string;
  phone?: string;
  packing_fee?: number;
  ordering_enabled?: boolean;
  ordering_start_time?: string;
  ordering_end_time?: string;
  whatsapp_enabled?: boolean;
  whatsapp_templates?: Record<string, { template_name?: string; language?: string; enabled?: boolean }>;
  printer_config?: Record<string, unknown>;
}

export const branchesAdminApi = {
  listAll: async (): Promise<Branch[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Branch[];
  },

  create: async (input: BranchInput): Promise<Branch> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('branches')
      .insert([input])
      .select()
      .single();
    if (error) throw new Error(`Erro ao criar filial: ${error.message}`);
    return data as Branch;
  },

  update: async (id: string, patch: Partial<BranchInput>): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('branches').update(patch).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar filial: ${error.message}`);
  },

  listProfileBranches: async (profileId: string): Promise<string[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profile_branches')
      .select('branch_id')
      .eq('profile_id', profileId);
    if (error) throw error;
    return (data ?? []).map((r: { branch_id: string }) => r.branch_id);
  },

  setProfileBranches: async (profileId: string, branchIds: string[]): Promise<void> => {
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from('profile_branches')
      .delete()
      .eq('profile_id', profileId);
    if (delErr) throw new Error(`Erro ao limpar vínculos: ${delErr.message}`);
    if (branchIds.length === 0) return;
    const rows = branchIds.map((branch_id) => ({ profile_id: profileId, branch_id }));
    const { error: insErr } = await supabase.from('profile_branches').insert(rows);
    if (insErr) throw new Error(`Erro ao vincular filiais: ${insErr.message}`);
  },

  /**
   * Duplica um produto de uma filial para outra.
   * - Copia campos básicos (nome, descrição, preço, setor, active).
   * - Cria uma categoria-irmã na filial-alvo se não existir (mesmo nome).
   * - NÃO copia vínculos de product_ingredients/product_addons (ingredients e
   *   addons são por filial; a duplicação completa exigiria mapear os ids).
   * Retorna o id do produto novo na filial-alvo.
   */
  cloneProductToBranch: async (productId: string, targetBranchId: string): Promise<string> => {
    const supabase = createClient();
    const { data: src, error: srcErr } = await supabase
      .from('products')
      .select('name, description, price, sector, active, branch_id, category:categories(name)')
      .eq('id', productId)
      .single();
    if (srcErr || !src) throw new Error(`Produto de origem não encontrado: ${srcErr?.message ?? 'sem dados'}`);
    if (src.branch_id === targetBranchId) throw new Error('Filial de origem e destino são iguais.');

    // Resolve a categoria-alvo: procura uma categoria com mesmo nome na filial-alvo
    // (criada anteriormente, ou cria agora). Se a origem não tem categoria, falha.
    const categoryName: string | undefined = (src as { category?: { name?: string } | null }).category?.name;
    if (!categoryName) throw new Error('Produto de origem sem categoria.');

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('branch_id', targetBranchId)
      .eq('name', categoryName)
      .maybeSingle();

    let targetCategoryId: string;
    if (existing) {
      targetCategoryId = (existing as { id: string }).id;
    } else {
      const { data: newCat, error: newCatErr } = await supabase
        .from('categories')
        .insert([{ name: categoryName, branch_id: targetBranchId, active: true }])
        .select('id')
        .single();
      if (newCatErr || !newCat) throw new Error(`Erro ao criar categoria espelhada: ${newCatErr?.message}`);
      targetCategoryId = (newCat as { id: string }).id;
    }

    const { data: cloned, error: cloneErr } = await supabase
      .from('products')
      .insert([{
        branch_id: targetBranchId,
        category_id: targetCategoryId,
        name: src.name,
        description: src.description,
        price: src.price,
        sector: src.sector,
        active: src.active,
      }])
      .select('id')
      .single();
    if (cloneErr || !cloned) throw new Error(`Erro ao duplicar produto: ${cloneErr?.message}`);
    return (cloned as { id: string }).id;
  },
};
