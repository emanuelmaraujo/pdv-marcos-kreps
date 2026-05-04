import { createClient } from '../supabase/client';
import { Category, Product, Ingredient, ProductIngredient, Addon } from '@/types/pdv';

export interface MenuData {
  categories: Category[];
  products: Product[];
  ingredients: Ingredient[];
  productIngredients: ProductIngredient[];
  addons: Addon[];
}

export const menuApi = {
  /**
   * Fetches all active menu data needed for the POS interface.
   * Resolves everything in parallel for better performance.
   */
  getMenuData: async (): Promise<MenuData> => {
    const supabase = createClient();

    const [
      { data: categories, error: catError },
      { data: products, error: prodError },
      { data: ingredients, error: ingError },
      { data: productIngredients, error: prodIngError },
      { data: addons, error: addonError },
    ] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true }),

      supabase
        .from('products')
        .select('*')
        .eq('active', true)
        // Since is_sold_out doesn't exist, we rely solely on active=true. 
        // If we want sorting we can sort by name or category.
        .order('name', { ascending: true }),

      supabase
        .from('ingredients')
        .select('*')
        .eq('active', true),

      supabase
        .from('product_ingredients')
        .select('*'),

      supabase
        .from('addons')
        .select('*')
        .eq('active', true),
    ]);

    if (catError) throw new Error(`Failed to load categories: ${catError.message}`);
    if (prodError) throw new Error(`Failed to load products: ${prodError.message}`);
    if (ingError) throw new Error(`Failed to load ingredients: ${ingError.message}`);
    if (prodIngError) throw new Error(`Failed to load product ingredients: ${prodIngError.message}`);
    if (addonError) throw new Error(`Failed to load addons: ${addonError.message}`);

    return {
      categories: categories as Category[],
      products: products as Product[],
      ingredients: ingredients as Ingredient[],
      productIngredients: productIngredients as ProductIngredient[],
      addons: addons as Addon[],
    };
  },

  /**
   * Fetches the entire menu (active and inactive) for the management screen.
   */
  getFullMenuData: async (): Promise<MenuData> => {
    const supabase = createClient();

    const [
      { data: categories, error: catError },
      { data: products, error: prodError },
      { data: ingredients, error: ingError },
      { data: productIngredients, error: prodIngError },
      { data: addons, error: addonError },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('products').select('*').order('name', { ascending: true }),
      supabase.from('ingredients').select('*').order('name', { ascending: true }),
      supabase.from('product_ingredients').select('*'),
      supabase.from('addons').select('*').order('name', { ascending: true }),
    ]);

    if (catError) throw new Error(`Failed to load categories: ${catError.message}`);
    if (prodError) throw new Error(`Failed to load products: ${prodError.message}`);
    if (ingError) throw new Error(`Failed to load ingredients: ${ingError.message}`);
    if (prodIngError) throw new Error(`Failed to load product ingredients: ${prodIngError.message}`);
    if (addonError) throw new Error(`Failed to load addons: ${addonError.message}`);

    return {
      categories: categories as Category[],
      products: products as Product[],
      ingredients: ingredients as Ingredient[],
      productIngredients: productIngredients as ProductIngredient[],
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
  }
};
