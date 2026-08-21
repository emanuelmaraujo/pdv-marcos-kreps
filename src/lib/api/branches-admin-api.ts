// CRUD de filiais, zonas de entrega, entregadores e vínculos de atendentes — apenas ADMIN.
import { createClient } from '../supabase/client';
import { Branch, BranchType, Courier, DeliveryZone } from '@/types/pdv';
import { normalizeNeighborhood } from '../utils/delivery';

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
  delivery_enabled?: boolean;
  default_delivery_fee?: number;
  monthly_revenue_goal?: number | null;
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

export interface DeliveryZoneInput {
  neighborhood: string;
  fee: number;
  active?: boolean;
}

// CRUD de zonas de entrega por filial — apenas ADMIN (RLS: "Admin controla
// delivery_zones"). A taxa aqui é só o que o ADMIN cadastra; o cálculo
// autoritativo por pedido sempre roda no servidor (Edge Functions).
export const deliveryZonesApi = {
  listByBranch: async (branchId: string): Promise<DeliveryZone[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('branch_id', branchId)
      .order('neighborhood');
    if (error) throw new Error(`Erro ao listar zonas de entrega: ${error.message}`);
    return (data ?? []) as DeliveryZone[];
  },

  create: async (branchId: string, input: DeliveryZoneInput): Promise<DeliveryZone> => {
    const supabase = createClient();
    const neighborhood = input.neighborhood.trim();
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert([{
        branch_id: branchId,
        neighborhood,
        neighborhood_normalized: normalizeNeighborhood(neighborhood),
        fee: input.fee,
        active: input.active ?? true,
      }])
      .select()
      .single();
    if (error) throw new Error(`Erro ao criar zona de entrega: ${error.message}`);
    return data as DeliveryZone;
  },

  update: async (id: string, patch: Partial<DeliveryZoneInput>): Promise<void> => {
    const supabase = createClient();
    const payload: Record<string, unknown> = { ...patch };
    if (patch.neighborhood) {
      payload.neighborhood = patch.neighborhood.trim();
      payload.neighborhood_normalized = normalizeNeighborhood(patch.neighborhood);
    }
    const { error } = await supabase.from('delivery_zones').update(payload).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar zona de entrega: ${error.message}`);
  },

  remove: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) throw new Error(`Erro ao remover zona de entrega: ${error.message}`);
  },
};

export interface CourierInput {
  name: string;
  phone?: string;
  active?: boolean;
}

// CRUD de entregadores cadastrados por filial — apenas ADMIN, mesmo padrão de
// deliveryZonesApi. Entregador avulso (sem cadastro) continua funcionando no
// despacho digitando nome/telefone livremente.
export const couriersApi = {
  listByBranch: async (branchId: string): Promise<Courier[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .eq('branch_id', branchId)
      .order('name');
    if (error) throw new Error(`Erro ao listar entregadores: ${error.message}`);
    return (data ?? []) as Courier[];
  },

  create: async (branchId: string, input: CourierInput): Promise<Courier> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('couriers')
      .insert([{
        branch_id: branchId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        active: input.active ?? true,
      }])
      .select()
      .single();
    if (error) throw new Error(`Erro ao criar entregador: ${error.message}`);
    return data as Courier;
  },

  update: async (id: string, patch: Partial<CourierInput>): Promise<void> => {
    const supabase = createClient();
    const payload: Record<string, unknown> = { ...patch };
    if (typeof patch.name === 'string') payload.name = patch.name.trim();
    if (typeof patch.phone === 'string') payload.phone = patch.phone.trim() || null;
    const { error } = await supabase.from('couriers').update(payload).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar entregador: ${error.message}`);
  },

  remove: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('couriers').delete().eq('id', id);
    if (error) throw new Error(`Erro ao remover entregador: ${error.message}`);
  },
};
