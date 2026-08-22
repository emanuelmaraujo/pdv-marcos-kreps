import { Addon, Ingredient, Product } from "@/types/pdv";
import type { MenuData } from "@/lib/api/menu-api";

/**
 * Lógica de tags/categoria do cardápio — compartilhada entre `/pedir`
 * (catálogo público) e `/app/novo-pedido` (catálogo interno do atendente).
 *
 * Antes vivia duplicada por copy-paste nos dois arquivos; a versão de
 * `/pedir` era um superset (tags de bebida, resumo de produto) que
 * `/novo-pedido` não tinha. Extraído para um módulo único, ver
 * docs/plano-acao-ux-ui.md, Fase 0 — "um catálogo, uma linguagem visual".
 */

export const ALL_FILTER = "Todos";

const SAVORY_PROTEINS = ["presunto", "calabresa", "frango", "atum", "peito de peru", "carne de sol"];
const SWEET_BASES = ["banana", "morango", "nutella", "chocolate", "doce de leite", "goiabada"];

export interface MenuIndexes {
  ingredientsById: Map<string, Ingredient>;
  addonsById: Map<string, Addon>;
  ingredientIdsByProduct: Map<string, string[]>;
  addonIdsByProduct: Map<string, string[]>;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => (part.length <= 2 ? part : `${part[0]?.toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

export function splitProductName(name: string) {
  const match = name.match(/^(\d+)\s*-\s*(.+)$/);
  return {
    code: match?.[1] ?? "",
    title: match?.[2] ?? name,
  };
}

export function getCategoryKind(categoryName?: string) {
  const normalized = normalizeText(categoryName ?? "");
  if (normalized.includes("salgado")) return "SAVORY";
  if (normalized.includes("doce")) return "SWEET";
  if (normalized.includes("bebida") || normalized.includes("combustive")) return "DRINK";
  if (normalized.includes("batata")) return "POTATO";
  return "OTHER";
}

export function getProductIngredients(product: Product, indexes: MenuIndexes | null) {
  if (!indexes) return [];
  const ingredientIds = indexes.ingredientIdsByProduct.get(product.id) ?? [];
  return ingredientIds.map((id) => indexes.ingredientsById.get(id)).filter(Boolean) as Ingredient[];
}

export function getProductTags(product: Product, categoryName: string | undefined, indexes: MenuIndexes | null): string[] {
  const kind = getCategoryKind(categoryName);
  const ingredients = getProductIngredients(product, indexes);
  const ingredientNames = ingredients.map((ingredient) => ingredient.name);
  const normalizedIngredients = ingredientNames.map(normalizeText);
  const normalizedName = normalizeText(product.name);

  if (kind === "SAVORY") {
    if (normalizedName.includes("maverick")) return ["Especial"];
    const protein = SAVORY_PROTEINS.find((item) => normalizedIngredients.includes(normalizeText(item)));
    if (protein) return [titleCase(protein)];
    if (normalizedIngredients.includes("ovo") || normalizedIngredients.includes("queijo")) return ["Vegetariano"];
    return ["Outros"];
  }

  if (kind === "SWEET") {
    const bases = SWEET_BASES.filter((item) => normalizedIngredients.includes(normalizeText(item)));
    return bases.length > 0 ? bases.map(titleCase) : ["Doces"];
  }

  if (kind === "DRINK") {
    if (normalizedName.includes("refrigerante")) return ["Refrigerante", "Geladas"];
    if (normalizedName.includes("h2o")) return ["H2O", "Geladas"];
    if (normalizedName.includes("polpa")) return ["Polpas"];
    if (normalizedName.includes("acai") || normalizedName.includes("creme")) return ["Cremes"];
    if (normalizedName.includes("soda")) return ["Soda"];
    if (normalizedName.includes("suco") || normalizedName.includes("laranja")) return ["Sucos"];
    return ["Bebidas"];
  }

  return [];
}

export function getProductSummary(product: Product, categoryName: string | undefined, indexes: MenuIndexes | null) {
  const ingredients = getProductIngredients(product, indexes);
  if (product.description) return product.description;
  if (ingredients.length > 0) {
    return ingredients.map((ingredient) => ingredient.name).join(", ");
  }
  if (getCategoryKind(categoryName) === "DRINK") return "Bebida preparada para acompanhar seu pedido.";
  if (getCategoryKind(categoryName) === "POTATO") return "Porcao para dividir ou acompanhar seu krep.";
  return "Item do cardapio Marcos Krep's.";
}

export function buildMenuIndexes(menuData: MenuData | null): MenuIndexes | null {
  if (!menuData) return null;
  const ingredientsById = new Map(menuData.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const addonsById = new Map(menuData.addons.map((addon) => [addon.id, addon]));
  const ingredientIdsByProduct = new Map<string, string[]>();
  const addonIdsByProduct = new Map<string, string[]>();

  for (const relation of menuData.productIngredients) {
    const current = ingredientIdsByProduct.get(relation.product_id);
    if (current) current.push(relation.ingredient_id);
    else ingredientIdsByProduct.set(relation.product_id, [relation.ingredient_id]);
  }

  for (const relation of menuData.productAddons) {
    const current = addonIdsByProduct.get(relation.product_id);
    if (current) current.push(relation.addon_id);
    else addonIdsByProduct.set(relation.product_id, [relation.addon_id]);
  }

  return { ingredientsById, addonsById, ingredientIdsByProduct, addonIdsByProduct };
}
