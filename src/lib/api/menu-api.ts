import { createClient } from '../supabase/client';
import { Category, Product, Ingredient, ProductIngredient, ProductAddon, Addon } from '@/types/pdv';

export interface MenuData {
  categories: Category[];
  products: Product[];
  ingredients: Ingredient[];
  productIngredients: ProductIngredient[];
  productAddons: ProductAddon[];
  addons: Addon[];
}

export type CreateProductInput = Omit<Product, 'id' | 'created_at'>;
export type CreateAddonInput = Omit<Addon, 'id' | 'created_at'>;
export type CreateCategoryInput = Omit<Category, 'id' | 'created_at' | 'sort_order'> & { sort_order?: number };

export const menuApi = {
  /**
   * Fetches all active menu data needed for the POS interface.
   * Filtra por filial quando `branchId` é fornecido (cardápio separado por filial).
   * Resolves everything in parallel for better performance.
   */
  getMenuData: async (branchId?: string | null): Promise<MenuData> => {
    const supabase = createClient();

    const buildScoped = (table: string) => {
      let q = supabase.from(table).select('*');
      if (branchId) q = q.eq('branch_id', branchId);
      return q;
    };

    const [
      { data: categories, error: catError },
      { data: products, error: prodError },
      { data: ingredients, error: ingError },
      { data: productIngredients, error: prodIngError },
      { data: productAddons, error: prodAddonError },
      { data: addons, error: addonError },
    ] = await Promise.all([
      buildScoped('categories').eq('active', true).order('sort_order', { ascending: true }),
      buildScoped('products').eq('active', true).order('name', { ascending: true }),
      buildScoped('ingredients').eq('active', true),
      supabase.from('product_ingredients').select('*'),
      supabase.from('product_addons').select('*'),
      buildScoped('addons').eq('active', true),
    ]);

    if (catError) throw new Error(`Failed to load categories: ${catError.message}`);
    if (prodError) throw new Error(`Failed to load products: ${prodError.message}`);
    if (ingError) throw new Error(`Failed to load ingredients: ${ingError.message}`);
    if (prodIngError) throw new Error(`Failed to load product ingredients: ${prodIngError.message}`);
    if (prodAddonError) throw new Error(`Failed to load product addons: ${prodAddonError.message}`);
    if (addonError) throw new Error(`Failed to load addons: ${addonError.message}`);

    return {
      categories: categories as Category[],
      products: products as Product[],
      ingredients: ingredients as Ingredient[],
      productIngredients: productIngredients as ProductIngredient[],
      productAddons: productAddons as ProductAddon[],
      addons: addons as Addon[],
    };
  },

  /**
   * Fetches the entire menu (active and inactive) for the management screen.
   * Filtra por filial quando `branchId` é fornecido.
   */
  getFullMenuData: async (branchId?: string | null): Promise<MenuData> => {
    const supabase = createClient();
    const scoped = (table: string) => {
      const q = supabase.from(table).select('*');
      return branchId ? q.eq('branch_id', branchId) : q;
    };

    const [
      { data: categories, error: catError },
      { data: products, error: prodError },
      { data: ingredients, error: ingError },
      { data: productIngredients, error: prodIngError },
      { data: productAddons, error: prodAddonError },
      { data: addons, error: addonError },
    ] = await Promise.all([
      scoped('categories').order('sort_order', { ascending: true }),
      scoped('products').order('name', { ascending: true }),
      scoped('ingredients').order('name', { ascending: true }),
      supabase.from('product_ingredients').select('*'),
      supabase.from('product_addons').select('*'),
      scoped('addons').order('name', { ascending: true }),
    ]);

    if (catError) throw new Error(`Failed to load categories: ${catError.message}`);
    if (prodError) throw new Error(`Failed to load products: ${prodError.message}`);
    if (ingError) throw new Error(`Failed to load ingredients: ${ingError.message}`);
    if (prodIngError) throw new Error(`Failed to load product ingredients: ${prodIngError.message}`);
    if (prodAddonError) throw new Error(`Failed to load product addons: ${prodAddonError.message}`);
    if (addonError) throw new Error(`Failed to load addons: ${addonError.message}`);

    return {
      categories: categories as Category[],
      products: products as Product[],
      ingredients: ingredients as Ingredient[],
      productIngredients: productIngredients as ProductIngredient[],
      productAddons: productAddons as ProductAddon[],
      addons: addons as Addon[],
    };
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id);
      
    if (error) throw new Error(`Erro ao atualizar produto: ${error.message}`);
  },

  updateAddon: async (id: string, updates: Partial<Addon>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('addons')
      .update(updates)
      .eq('id', id);
      
    if (error) throw new Error(`Erro ao atualizar adicional: ${error.message}`);
  },

  createProduct: async (product: CreateProductInput, branchId?: string | null) => {
    const supabase = createClient();
    const payload = branchId ? { ...product, branch_id: branchId } : product;
    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar produto: ${error.message}`);
    return data as Product;
  },

  createAddon: async (addon: CreateAddonInput, branchId?: string | null) => {
    const supabase = createClient();
    const payload = branchId ? { ...addon, branch_id: branchId } : addon;
    const { data, error } = await supabase
      .from('addons')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar adicional: ${error.message}`);
    return data as Addon;
  },

  createCategory: async (category: CreateCategoryInput, branchId?: string | null) => {
    const supabase = createClient();
    const payload = branchId ? { ...category, branch_id: branchId } : category;
    const { data, error } = await supabase
      .from('categories')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar categoria: ${error.message}`);
    return data as Category;
  },

  updateCategory: async (id: string, updates: Partial<Category>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id);
      
    if (error) throw new Error(`Erro ao atualizar categoria: ${error.message}`);
  },

  setProductAddons: async (productId: string, addonIds: string[]) => {
    const supabase = createClient();
    
    // First, delete existing
    const { error: delError } = await supabase
      .from('product_addons')
      .delete()
      .eq('product_id', productId);
      
    if (delError) throw new Error(`Erro ao limpar adicionais do produto: ${delError.message}`);

    if (addonIds.length === 0) return;

    // Then, insert new ones
    const inserts = addonIds.map(addonId => ({
      product_id: productId,
      addon_id: addonId
    }));

    const { error: insError } = await supabase
      .from('product_addons')
      .insert(inserts);
      
    if (insError) throw new Error(`Erro ao vincular adicionais ao produto: ${insError.message}`);
  },

  setProductIngredients: async (productId: string, ingredientIds: string[]) => {
    const supabase = createClient();
    
    // First, delete existing
    const { error: delError } = await supabase
      .from('product_ingredients')
      .delete()
      .eq('product_id', productId);
      
    if (delError) throw new Error(`Erro ao limpar ingredientes do produto: ${delError.message}`);

    if (ingredientIds.length === 0) return;

    // Then, insert new ones
    const inserts = ingredientIds.map(ingId => ({
      product_id: productId,
      ingredient_id: ingId
    }));

    const { error: insError } = await supabase
      .from('product_ingredients')
      .insert(inserts);
      
    if (insError) throw new Error(`Erro ao vincular ingredientes ao produto: ${insError.message}`);
  },

  getIngredients: async (branchId?: string | null): Promise<Ingredient[]> => {
    const supabase = createClient();
    let query = supabase.from('ingredients').select('*').order('name', { ascending: true });
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query;

    if (error) throw new Error(`Erro ao buscar ingredientes: ${error.message}`);
    return data as Ingredient[];
  },

  createIngredient: async (name: string, branchId?: string | null) => {
    const supabase = createClient();
    const payload: Record<string, unknown> = { name };
    if (branchId) payload.branch_id = branchId;
    const { data, error } = await supabase
      .from('ingredients')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar ingrediente: ${error.message}`);
    return data as Ingredient;
  }
};
