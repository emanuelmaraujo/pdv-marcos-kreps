import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type JsonRecord = Record<string, unknown>;

const DEFAULT_ORDERING_START = "17:00";
const DEFAULT_ORDERING_END = "23:30";
const ORDERING_TIME_ZONE = "America/Sao_Paulo";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function settingBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.replace(/^"|"$/g, "").toLowerCase() === "true";
  return fallback;
}

function settingNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/^"|"$/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function settingString(value: unknown, fallback: string) {
  if (typeof value === "string") return value.replace(/^"|"$/g, "");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function parseTimeToMinutes(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getSaoPauloMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: ORDERING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hours * 60 + minutes;
}

function isWithinOrderingWindow(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime) ?? parseTimeToMinutes(DEFAULT_ORDERING_START)!;
  const end = parseTimeToMinutes(endTime) ?? parseTimeToMinutes(DEFAULT_ORDERING_END)!;
  const now = getSaoPauloMinutes();
  if (start === end) return true;
  if (start < end) return now >= start && now <= end;
  return now >= start || now <= end;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Metodo nao permitido." }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const publicKeys = [
      "public_ordering_enabled",
      "public_ordering_start_time",
      "public_ordering_end_time",
      "packaging_fee",
      "apply_packaging_fee_for_takeout",
    ];

    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("key, value")
      .in("key", publicKeys);

    if (error) throw new Error("Erro ao carregar configuracoes publicas.");

    const settings = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
    const enabledByAdmin = settingBool(settings.public_ordering_enabled, true);
    const start = settingString(settings.public_ordering_start_time, DEFAULT_ORDERING_START);
    const end = settingString(settings.public_ordering_end_time, DEFAULT_ORDERING_END);
    const isOpenBySchedule = isWithinOrderingWindow(start, end);
    const onlineOrderingEnabled = enabledByAdmin && isOpenBySchedule;

    return jsonResponse(req, {
      success: true,
      settings: {
        public_ordering_enabled: String(enabledByAdmin),
        public_ordering_start_time: start,
        public_ordering_end_time: end,
        packaging_fee: String(settingNumber(settings.packaging_fee, 0)),
        apply_packaging_fee_for_takeout: String(settingBool(settings.apply_packaging_fee_for_takeout, false)),
      },
      online_ordering_enabled: onlineOrderingEnabled,
      ordering_closed_reason: !enabledByAdmin
        ? "Os pedidos online foram pausados pelo administrador."
        : !isOpenBySchedule
          ? `No momento nao estamos recebendo pedidos. Atendimento online das ${start} as ${end}.`
          : "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar configuracoes publicas.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
