/**
 * Regras de apresentação do cardápio público (/pedir) aprovadas na #235.
 * Puras e sem React para ficarem testáveis; preço e validação continuam no
 * servidor (create-public-order).
 */
import type { CartItem } from "@/features/cart/useCart";
import type { ProductAddon } from "@/types/pdv";
import { getCategoryKind } from "./productTags";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Ilustração usada quando o produto não tem foto cadastrada. Só desenhos da
 * própria marca (public/cardapio); nunca uma foto que finja ser o produto.
 */
export function getFallbackArt(categoryName: string | undefined, productName: string): string | null {
  const kind = getCategoryKind(categoryName);
  if (kind === "SAVORY") return "/cardapio/fallback/krep-salgado.svg";
  if (kind === "SWEET") return "/cardapio/fallback/krep-doce.svg";
  if (kind === "POTATO") return "/cardapio/fallback/batata.svg";
  if (kind === "DRINK" && normalize(productName).includes("suco")) return "/cardapio/bebidas/suco-natural.svg";
  return null;
}

/** Produtos com adicional obrigatório sempre abrem a personalização no "+". */
export function getProductsRequiringChoice(productAddons: Pick<ProductAddon, "product_id" | "is_required">[]): Set<string> {
  const ids = new Set<string>();
  for (const relation of productAddons) if (relation.is_required) ids.add(relation.product_id);
  return ids;
}

/** Item "puro" do produto (sem adicional, remoção nem observação) para o "+" somar nele. */
export function findPlainCartItem(items: CartItem[], productId: string): CartItem | undefined {
  return items.find((item) =>
    item.product.id === productId
    && item.addons.length === 0
    && item.removed_ingredients.length === 0
    && !item.notes);
}

/** Quantas unidades do produto já estão na sacola, somando todas as versões. */
export function countProductInCart(items: CartItem[], productId: string): number {
  return items.reduce((total, item) => total + (item.product.id === productId ? item.quantity : 0), 0);
}

/** Total da linha: (preço + adicionais) × quantidade. O servidor recalcula ao enviar. */
export function getCartItemTotal(item: CartItem): number {
  const addons = item.addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
  return (item.product.price + addons) * item.quantity;
}

/** Primeiro nome para a confirmação ("Obrigado, Ana!"); vazio quando não informado. */
export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
