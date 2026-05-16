type Sector = "KITCHEN" | "JUICE_POTATO";

type ReceiptOptions = {
  title?: string;
  timestamp?: string;
  mode?: "NORMAL" | "REPRINT" | "ADDITIONAL";
  source?: "ATTENDANT" | "PUBLIC";
  branchCode?: string;   // prefixo curto da filial: "P", "F", etc. Resulta em "P-042-1".
  branchName?: string;   // nome humano da filial: aparece no cabeçalho do recibo.
};

const LINE = "========================================";
const DASH = "----------------------------------------";
const PUBLIC_ORDER_SITE = "marcoskreps.com.br";
const INSTAGRAM = "@marcos_kreps";
const WHATSAPP = "(61) 99341-0411";

export function settingBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "off"].includes(normalized)) return false;
  }
  return fallback;
}

export function settingNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatBRL(value: unknown): string {
  return `R$ ${settingNumber(value).toFixed(2).replace(".", ",")}`;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalize(value: unknown): string {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function resolveProductionSector(item: any): Sector | "NONE" {
  const explicit = text(item?.production_sector || item?.product?.sector || item?.sector).toUpperCase();
  if (explicit === "KITCHEN" || explicit === "JUICE_POTATO") return explicit;

  const searchable = [
    item?.product_name_snapshot,
    item?.product?.name,
    item?.name,
    item?.category_name,
    item?.product?.category?.name,
    item?.category?.name,
  ].map(normalize).join(" ");

  if (/\b(bebida|suco|refri|refrigerante|agua|coca|guarana|fanta|sprite|kuat|schweppes|h2o|del valle|tampico|mate|cha|cafe|cerveja|heineken|skol|brahma|batata)\b/.test(searchable)) {
    return "JUICE_POTATO";
  }

  if (/\b(krep|kreps|crepe|crepes)\b/.test(searchable)) {
    return "KITCHEN";
  }

  return "NONE";
}

function orderNumber(order: any): string {
  return String(order?.daily_number ?? "0").padStart(3, "0");
}

function orderLabel(order: any, branchCode?: string): string {
  const num = orderNumber(order);
  return branchCode ? `${branchCode}-${num}` : num;
}

function itemLabel(order: any, item: any, branchCode?: string): string {
  const seq = item?.sequence_no;
  const base = orderLabel(order, branchCode);
  return seq != null ? `${base}-${seq}` : base;
}

function timestampNow() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function itemName(item: any): string {
  return text(item?.product_name_snapshot || item?.product?.name || item?.name);
}

function itemSector(item: any): string {
  return resolveProductionSector(item);
}

function itemPrice(item: any): number {
  return settingNumber(item?.product_price_snapshot ?? item?.product?.price);
}

function itemObservation(item: any): string {
  return text(item?.observation ?? item?.notes).replace(/^\[VIAGEM\]\s*/i, "");
}

function itemIsTakeout(item: any): boolean {
  const observation = text(item?.observation ?? item?.notes);
  return item?.is_takeout === true || /^\[VIAGEM\]/i.test(observation);
}

function removedNames(item: any): string[] {
  const values = item?.order_item_removed_ingredients || item?.removedIngredientsSnapshots || [];
  return values.map((entry: any) => text(entry?.ingredient_name_snapshot || entry?.name)).filter(Boolean);
}

function addons(item: any): Array<{ name: string; quantity: number; price: number }> {
  const values = item?.order_item_addons || item?.addonsSnapshots || [];
  return values.map((entry: any) => ({
    name: text(entry?.addon_name_snapshot || entry?.name),
    quantity: settingNumber(entry?.quantity, 1),
    price: settingNumber(entry?.addon_price_snapshot ?? entry?.price),
  })).filter((entry: any) => entry.name);
}

function header(order: any, section: string, options: ReceiptOptions) {
  const label = orderLabel(order, options.branchCode);
  const modeLabel = options.mode === "REPRINT"
    ? "REIMPRESSAO"
    : options.mode === "ADDITIONAL"
      ? "ADICIONAL"
      : "PEDIDO";

  const lines = [
    LINE,
    "MARCOS KREP'S",
  ];

  if (options.branchName) lines.push(`Filial: ${options.branchName}`);
  lines.push(`${modeLabel} ${label}`);
  lines.push(section);

  if (options.source === "PUBLIC") lines.push("Origem: APP");
  if (order?.customer_name) lines.push(`Cliente: ${text(order.customer_name)}`);
  if (order?.customer_phone) lines.push(`Fone: ${text(order.customer_phone)}`);
  lines.push(`Hora: ${options.timestamp || timestampNow()}`);
  if (order?.notes) lines.push(`Obs pedido: ${text(order.notes)}`);
  lines.push(LINE);
  return `${lines.join("\n")}\n`;
}

export function buildProductionReceipt(order: any, items: any[], sector: Sector, options: ReceiptOptions = {}) {
  const section = options.title || (sector === "KITCHEN" ? "KREPS" : "COZINHA");
  const sectorItems = items.filter((item) => itemSector(item) === sector);
  let content = header(order, section, options);

  sectorItems.forEach((item) => {
    const label = itemLabel(order, item, options.branchCode);
    content += `${label}) ${settingNumber(item?.quantity, 1)}x ${itemName(item)}\n`;
    if (sector === "KITCHEN" && itemIsTakeout(item)) {
      content += "   >>> PARA VIAGEM <<<\n";
    }

    const removed = removedNames(item);
    if (removed.length > 0) content += `   NAO COLOCAR: ${removed.join(", ")}\n`;

    const itemAddons = addons(item);
    if (itemAddons.length > 0) {
      content += `   ADICIONAIS: ${itemAddons.map((add) => `${add.quantity}x ${add.name}`).join(", ")}\n`;
    }

    const obs = itemObservation(item);
    if (obs) content += `   OBS: ${obs}\n`;
    content += DASH + "\n";
  });

  content += `TOTAL ITENS: ${sectorItems.reduce((sum, item) => sum + settingNumber(item?.quantity, 1), 0)}\n`;
  content += `${LINE}\n`;
  content += `>>> PEDIDO ${orderLabel(order, options.branchCode)} <<<\n`;
  return content;
}

export function buildCustomerReceipt(order: any, items: any[], options: ReceiptOptions = {}) {
  let content = header(order, "CLIENTE / SENHA", options);

  for (const item of items) {
    const quantity = settingNumber(item?.quantity, 1);
    const itemTag = item?.sequence_no != null ? `${itemLabel(order, item, options.branchCode)} · ` : "";
    content += `${itemTag}${quantity}x ${itemName(item)} - ${formatBRL(itemPrice(item))}\n`;
    if (itemSector(item) === "KITCHEN" && itemIsTakeout(item)) {
      content += "   PARA VIAGEM\n";
    }

    const removed = removedNames(item);
    if (removed.length > 0) content += `   Sem: ${removed.join(", ")}\n`;

    for (const add of addons(item)) {
      content += `   + ${add.quantity}x ${add.name} - ${formatBRL(add.price)}\n`;
    }
  }

  content += DASH + "\n";
  if (settingNumber(order?.discount_amount) > 0) content += `Desconto: -${formatBRL(order.discount_amount)}\n`;
  if (settingNumber(order?.packing_fee) > 0) content += `Taxa embalagem: ${formatBRL(order.packing_fee)}\n`;
  content += `TOTAL: ${formatBRL(order?.total_amount)}\n`;
  content += `Pagamento: ${text(order?.payment_status)}\n`;
  if (text(order?.payment_method) && text(order?.payment_method) !== "PENDING") {
    content += `Forma: ${text(order.payment_method)}\n`;
  }
  content += LINE + "\n";
  content += `SENHA: ${orderLabel(order, options.branchCode)}\n`;
  content += "Guarde este numero para retirada.\n";
  content += DASH + "\n";
  content += "Na proxima, peca pelo site:\n";
  content += `${PUBLIC_ORDER_SITE}\n`;
  content += `Instagram: ${INSTAGRAM}\n`;
  content += `WhatsApp: ${WHATSAPP}\n`;
  content += "Obrigado pela preferencia!\n";
  return content;
}
