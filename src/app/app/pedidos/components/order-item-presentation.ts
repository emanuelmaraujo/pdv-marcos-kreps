import type { Category, OrderItem } from "@/types/pdv";

export type CategoryLookup = Record<string, Pick<Category, "name" | "sort_order">>;

export type OrderItemGroup = {
  id: string;
  label: string;
  order: number;
  items: OrderItem[];
};

const FALLBACK_CATEGORY_ORDER = [
  { label: "Crepes salgados", terms: ["crepe sal", "salgado"], order: 10 },
  { label: "Crepes doces", terms: ["crepe doce", "doce"], order: 20 },
  { label: "Bebidas", terms: ["bebida", "suco", "refrigerante"], order: 30 },
  { label: "Batatas", terms: ["batata"], order: 40 },
];

function fallbackCategory(item: OrderItem) {
  const name = item.product_name_snapshot.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return FALLBACK_CATEGORY_ORDER.find((entry) => entry.terms.some((term) => name.includes(term))) ?? {
    label: "Outros itens",
    order: 90,
  };
}

export function getOrderItemGroup(item: OrderItem, categories: CategoryLookup): Omit<OrderItemGroup, "items"> {
  const category = item.product?.category_id ? categories[item.product.category_id] : undefined;
  if (category) {
    return {
      id: `category:${item.product!.category_id}`,
      label: category.name,
      order: category.sort_order,
    };
  }

  const fallback = fallbackCategory(item);
  return { id: `fallback:${fallback.label}`, label: fallback.label, order: fallback.order };
}

/**
 * A ordem é estável e segue o cardápio da filial. O lote e a senha do item só
 * resolvem empates: itens acrescentados depois não se misturam ao pedido inicial.
 */
export function groupOrderItems(items: OrderItem[], categories: CategoryLookup): OrderItemGroup[] {
  const groups = new Map<string, OrderItemGroup>();

  for (const item of items.filter((entry) => entry.status !== "CANCELLED")) {
    const meta = getOrderItemGroup(item, categories);
    const group = groups.get(meta.id) ?? { ...meta, items: [] };
    group.items.push(item);
    groups.set(meta.id, group);
  }

  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"))
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) =>
        (a.addition_batch_no ?? 0) - (b.addition_batch_no ?? 0)
        || (a.sequence_no ?? 0) - (b.sequence_no ?? 0)
        || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      ),
    }));
}

export function categoryLookup(categories: Category[]): CategoryLookup {
  return Object.fromEntries(categories.map((category) => [category.id, {
    name: category.name,
    sort_order: category.sort_order,
  }]));
}
