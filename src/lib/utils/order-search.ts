import type { Order } from "@/types/pdv";

function normalizeSearchText(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function orderMatchesSearch(order: Order, query: string) {
  const normalizedQuery = normalizeSearchText(query).replace(/^#/, "");
  if (!normalizedQuery) return true;

  const searchableValues = [
    order.daily_number,
    order.customer_name,
    order.customer_phone,
    order.delivery_street,
    order.delivery_number,
    order.delivery_neighborhood,
    order.delivery_city,
  ];
  if (searchableValues.some((value) => normalizeSearchText(value).includes(normalizedQuery))) return true;

  const queryDigits = query.replace(/\D/g, "");
  const phoneDigits = order.customer_phone?.replace(/\D/g, "") ?? "";
  return queryDigits.length >= 3 && phoneDigits.includes(queryDigits);
}
