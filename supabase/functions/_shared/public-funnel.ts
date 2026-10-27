export const CLIENT_FUNNEL_EVENTS = ["menu_view","product_view","add_to_cart","cart_view","checkout_start","delivery_check","payment_option_select","order_submit","order_failure"] as const;
export const FUNNEL_DEVICES = ["MOBILE","TABLET","DESKTOP","UNKNOWN"] as const;
export const FUNNEL_SOURCES = ["DIRECT","INSTAGRAM","WHATSAPP","QR","GOOGLE","OTHER","UNKNOWN"] as const;
export const FUNNEL_ERRORS = ["NONE","NETWORK","ADDRESS","CLOSED","ORDER"] as const;
export type ClientFunnelEvent = typeof CLIENT_FUNNEL_EVENTS[number];
export type FunnelInput = {
  consent: true; event_id: string; event_name: ClientFunnelEvent; branch_slug: string;
  order_type: "BALCAO" | "VIAGEM" | "ENTREGA";
  device: typeof FUNNEL_DEVICES[number]; source: typeof FUNNEL_SOURCES[number];
  error_category?: typeof FUNNEL_ERRORS[number]; payment_option?: "PIX" | "CARD" | "ON_DELIVERY";
  product_id?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseFunnelInput(value: unknown): FunnelInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Evento inválido.");
  const data = value as Record<string,unknown>;
  const keys = ["consent","event_id","event_name","branch_slug","order_type","device","source","error_category","payment_option","product_id"];
  const member = (items: readonly string[], field: unknown) => typeof field === "string" && items.includes(field);
  if (data.consent !== true || Object.keys(data).some(key=>!keys.includes(key)) || typeof data.event_id !== "string" || !uuid.test(data.event_id)
    || !member(CLIENT_FUNNEL_EVENTS,data.event_name) || !member(FUNNEL_DEVICES,data.device) || !member(FUNNEL_SOURCES,data.source)
    || !member(["BALCAO","VIAGEM","ENTREGA"],data.order_type)
    || typeof data.branch_slug !== "string" || !/^[a-z0-9-]{1,32}$/.test(data.branch_slug)
    || (data.error_category !== undefined && !member(FUNNEL_ERRORS,data.error_category))
    || (data.payment_option !== undefined && !member(["PIX","CARD","ON_DELIVERY"],data.payment_option))
    || (data.product_id !== undefined && (typeof data.product_id !== "string" || !uuid.test(data.product_id)))) throw new Error("Evento inválido.");
  return data as FunnelInput;
}
export function funnelSource(search: string): FunnelInput["source"] {
  const params=new URLSearchParams(search);
  const source=(params.get("utm_source")??"").trim().toLowerCase();
  const medium=(params.get("utm_medium")??"").trim().toLowerCase();
  if(source==="instagram")return "INSTAGRAM";
  if(source==="whatsapp")return "WHATSAPP";
  if(source==="qr"||medium==="qr"||medium==="qrcode")return "QR";
  if(source==="google")return "GOOGLE";
  return source||medium ? "OTHER" : "DIRECT";
}

/** Limite real em bytes mesmo sem Content-Length ou com envio em chunks. */
export async function readFunnelJson(request: Request, maxBytes = 2048): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Evento inválido.");
  const decoder = new TextDecoder(); let total=0; let text="";
  for (;;) {
    const {value,done}=await reader.read(); if(done)break;
    total+=value.byteLength;
    if(total>maxBytes){await reader.cancel();throw new RangeError("Evento excede o limite.");}
    text+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(text+decoder.decode());
}
