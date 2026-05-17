"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { useBranch } from "@/contexts/BranchContext";
import {
  AlertTriangle,
  Check,
  Clock,
  Fingerprint,
  Info,
  Loader2,
  MessageCircle,
  Package,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Store,
  Wifi,
  WifiOff,
} from "lucide-react";
import { BiometricManager } from "@/components/auth/BiometricManager";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { settingsApi } from "@/lib/api/settings-api";

type SettingsState = {
  printing_enabled: string;
  printer_host: string;
  printer_port: string;
  printer_type: string;
  printer_paper_width: string;
  print_customer_copy: string;
  print_kitchen_copy: string;
  print_juice_potato_copy: string;
  whatsapp_enabled: string;
  whatsapp_template_ready: string;
  whatsapp_template_received: string;
  whatsapp_template_language: string;
  whatsapp_test_phone: string;
  public_ordering_enabled: string;
  public_ordering_start_time: string;
  public_ordering_end_time: string;
  packaging_fee: string;
  apply_packaging_fee_for_takeout: string;
};

type SectionId = "pedido" | "embalagem" | "impressao" | "whatsapp" | "biometria";

type PrintWorkerStatus = {
  online: boolean;
  value: string;
  label: string;
  tone: "green" | "red" | "neutral";
  lastSeen: string;
  raspberryIp: string;
  printerHost: string;
  printerPort: string;
};

const DEFAULT_SETTINGS: SettingsState = {
  printing_enabled: "true",
  printer_host: "192.168.0.50",
  printer_port: "9100",
  printer_type: "network",
  printer_paper_width: "80",
  print_customer_copy: "true",
  print_kitchen_copy: "true",
  print_juice_potato_copy: "true",
  whatsapp_enabled: "false",
  whatsapp_template_ready: "pedido_pronto",
  whatsapp_template_received: "novo_pedido",
  whatsapp_template_language: "pt_BR",
  whatsapp_test_phone: "",
  public_ordering_enabled: "true",
  public_ordering_start_time: "17:00",
  public_ordering_end_time: "23:30",
  packaging_fee: "0",
  apply_packaging_fee_for_takeout: "false",
};

const DEFAULT_WORKER_STATUS: PrintWorkerStatus = {
  online: false,
  value: "Offline",
  label: "Sem sinal do Raspberry",
  tone: "red",
  lastSeen: "Nunca recebido",
  raspberryIp: "-",
  printerHost: "-",
  printerPort: "-",
};

const SECTIONS: Array<{
  id: SectionId;
  title: string;
  description: string;
  icon: ElementType;
}> = [
  { id: "pedido", title: "Pedido pelo site", description: "Horario e disponibilidade", icon: Store },
  { id: "embalagem", title: "Embalagem", description: "Taxa para viagem", icon: Package },
  { id: "impressao", title: "Impressao", description: "Vias e impressora", icon: Printer },
  { id: "whatsapp", title: "WhatsApp", description: "Templates e testes", icon: MessageCircle },
  { id: "biometria", title: "Biometria", description: "Login rapido", icon: Fingerprint },
];

function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start justify-between gap-5 py-4 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-800 group-hover:text-zinc-600 transition-colors">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{description}</span>
        )}
      </span>
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-all duration-300 ${
          checked ? "bg-brand-red shadow-md shadow-brand-red/25" : "bg-zinc-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
            checked ? "translate-x-5 shadow-md" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ToggleGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] leading-relaxed text-zinc-400">{hint}</span>}
    </label>
  );
}

// Accent colors for section icons (cleaner than gradient headers)
const SECTION_ACCENT: Record<string, { iconBg: string; iconColor: string; navActive: string }> = {
  pedido:    { iconBg: "bg-blue-100",    iconColor: "text-blue-600",    navActive: "bg-blue-500/20 text-blue-200 border-l-2 border-blue-400" },
  embalagem: { iconBg: "bg-amber-100",   iconColor: "text-amber-600",   navActive: "bg-amber-500/20 text-amber-200 border-l-2 border-amber-400" },
  impressao: { iconBg: "bg-violet-100",  iconColor: "text-violet-600",  navActive: "bg-violet-500/20 text-violet-200 border-l-2 border-violet-400" },
  whatsapp:  { iconBg: "bg-emerald-100", iconColor: "text-emerald-600", navActive: "bg-emerald-500/20 text-emerald-200 border-l-2 border-emerald-400" },
  biometria: { iconBg: "bg-zinc-100",    iconColor: "text-zinc-600",    navActive: "bg-white/10 text-white border-l-2 border-zinc-400" },
};

// Keep SECTION_COLORS as alias for nav mobile pills (uses bg gradient)
const SECTION_COLORS = SECTION_ACCENT;

function SettingsPanel({
  id,
  icon: Icon,
  title,
  description,
  className = "",
  children,
}: {
  id: SectionId;
  icon: ElementType;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  const accent = SECTION_ACCENT[id] ?? SECTION_ACCENT.pedido;
  return (
    <section
      id={id}
      className={`scroll-mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80 ${className}`}
    >
      <header className="flex items-center gap-4 px-6 py-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${accent.iconBg} ring-1 ring-black/5`}>
          <Icon className={`h-5 w-5 ${accent.iconColor}`} />
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-zinc-900">{title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </span>
      </header>
      <div className="border-t border-zinc-100 px-6 py-5">{children}</div>
    </section>
  );
}

function StatPill({
  label,
  value,
  tone = "neutral",
  light = false,
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "red";
  light?: boolean;
}) {
  if (light) {
    // Light variant for use inside white content panels
    const styles = {
      neutral: { card: "border-zinc-200 bg-zinc-50", value: "text-zinc-700", dot: "bg-zinc-400", label: "text-zinc-500" },
      green:   { card: "border-emerald-100 bg-emerald-50", value: "text-emerald-700", dot: "bg-emerald-500", label: "text-emerald-600" },
      red:     { card: "border-red-100 bg-red-50", value: "text-red-700", dot: "bg-red-500", label: "text-red-600" },
    }[tone];
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${styles.card}`}>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
          <p className={`text-sm font-black leading-none ${styles.value}`}>{value}</p>
        </div>
        <p className={`mt-1 text-[10px] font-medium truncate ${styles.label}`}>{label}</p>
      </div>
    );
  }

  // Dark sidebar variant
  const dot = { neutral: "bg-zinc-500", green: "bg-emerald-400", red: "bg-red-400" }[tone];
  const valueColor = { neutral: "text-zinc-200", green: "text-emerald-300", red: "text-red-300" }[tone];

  return (
    <div className="rounded-xl bg-white/8 px-3 py-2.5 border border-white/10">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className={`text-xs font-black leading-none ${valueColor}`}>{value}</p>
      </div>
      <p className="mt-1 text-[10px] font-medium text-zinc-500 truncate">{label}</p>
    </div>
  );
}

function formatLastSeen(iso?: string) {
  if (!iso) return "Nunca recebido";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "Data invalida";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 10) return "Agora";
  if (diffSeconds < 60) return `Ha ${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Ha ${diffMinutes}min`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `Ha ${diffHours}h`;
}

function resolvePrintWorkerStatus(data: Record<string, string>): PrintWorkerStatus {
  const lastSeenAt = data.print_worker_last_seen_at;
  const lastSeenTime = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  const secondsSinceLastSeen = Number.isFinite(lastSeenTime) ? (Date.now() - lastSeenTime) / 1000 : Infinity;
  const online = data.print_worker_status === "ACTIVE" && secondsSinceLastSeen <= 45;

  return {
    online,
    value: online ? "Online" : "Offline",
    label: online ? "Raspberry ativo" : "Sem heartbeat recente",
    tone: online ? "green" : "red",
    lastSeen: formatLastSeen(lastSeenAt),
    raspberryIp: data.print_worker_ip || "-",
    printerHost: data.print_worker_printer_host || "-",
    printerPort: data.print_worker_printer_port || "-",
  };
}

export default function ConfiguracoesSistema() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingEvent, setTestingEvent] = useState<"order_received" | "order_ready" | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("pedido");
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [printWorkerStatus, setPrintWorkerStatus] = useState<PrintWorkerStatus>(DEFAULT_WORKER_STATUS);
  const [whatsappStats, setWhatsappStats] = useState({
    pending: 0,
    sent_24h: 0,
    failed_24h: 0,
    delivered_24h: 0,
    read_24h: 0,
    token_expired: false,
  });
  const { toasts, addToast, removeToast } = useToast();
  const { currentBranch } = useBranch();

  const publicOrderStatus = settings.public_ordering_enabled === "true" ? "Aberto" : "Pausado";
  const printingStatus = settings.printing_enabled === "true" ? "Ativa" : "Pausada";
  const whatsappStatus = settings.whatsapp_enabled === "true" ? "Ativo" : "Inativo";

  const savePayload = useMemo(() => ({
    ...settings,
    printing_enabled: settings.printing_enabled === "true",
    apply_packaging_fee_for_takeout: settings.apply_packaging_fee_for_takeout === "true",
    print_customer_copy: settings.print_customer_copy === "true",
    print_kitchen_copy: settings.print_kitchen_copy === "true",
    print_juice_potato_copy: settings.print_juice_potato_copy === "true",
    public_ordering_enabled: settings.public_ordering_enabled === "true",
    printer_port: parseInt(settings.printer_port, 10),
    printer_paper_width: parseInt(settings.printer_paper_width, 10),
    packaging_fee: parseFloat(settings.packaging_fee.replace(",", ".")),
  }), [settings]);

  const set = (key: keyof SettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggle = (key: keyof SettingsState) => {
    setSettings((prev) => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));
  };

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    if (window.matchMedia("(min-width: 768px)").matches) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const loadSettings = useCallback(async (silent = false) => {
    try {
      const data = await settingsApi.getSettings();
      setPrintWorkerStatus(resolvePrintWorkerStatus(data));
      setSettings((prev) => ({
        ...prev,
        printing_enabled: String(data.printing_enabled ?? DEFAULT_SETTINGS.printing_enabled),
        printer_host: data.printer_host ?? DEFAULT_SETTINGS.printer_host,
        printer_port: String(data.printer_port ?? DEFAULT_SETTINGS.printer_port),
        printer_type: data.printer_type ?? DEFAULT_SETTINGS.printer_type,
        printer_paper_width: String(data.printer_paper_width ?? DEFAULT_SETTINGS.printer_paper_width),
        print_customer_copy: String(data.print_customer_copy ?? DEFAULT_SETTINGS.print_customer_copy),
        print_kitchen_copy: String(data.print_kitchen_copy ?? DEFAULT_SETTINGS.print_kitchen_copy),
        print_juice_potato_copy: String(data.print_juice_potato_copy ?? DEFAULT_SETTINGS.print_juice_potato_copy),
        whatsapp_enabled: String(data.whatsapp_enabled ?? DEFAULT_SETTINGS.whatsapp_enabled),
        whatsapp_template_ready: data.whatsapp_template_ready ?? DEFAULT_SETTINGS.whatsapp_template_ready,
        whatsapp_template_received: data.whatsapp_template_received ?? DEFAULT_SETTINGS.whatsapp_template_received,
        whatsapp_template_language: data.whatsapp_template_language ?? DEFAULT_SETTINGS.whatsapp_template_language,
        whatsapp_test_phone: data.whatsapp_test_phone ?? DEFAULT_SETTINGS.whatsapp_test_phone,
        public_ordering_enabled: String(data.public_ordering_enabled ?? DEFAULT_SETTINGS.public_ordering_enabled),
        public_ordering_start_time: data.public_ordering_start_time ?? DEFAULT_SETTINGS.public_ordering_start_time,
        public_ordering_end_time: data.public_ordering_end_time ?? DEFAULT_SETTINGS.public_ordering_end_time,
        packaging_fee: data.packaging_fee ?? DEFAULT_SETTINGS.packaging_fee,
        apply_packaging_fee_for_takeout: String(
          data.apply_packaging_fee_for_takeout ?? DEFAULT_SETTINGS.apply_packaging_fee_for_takeout,
        ),
      }));

      const stats = await settingsApi.getWhatsAppStats();
      setWhatsappStats(stats);
    } catch {
      if (!silent) addToast("error", "Erro ao carregar configuracoes");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    const interval = window.setInterval(() => {
      void loadSettings(true);
    }, 15000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [loadSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.saveSettings(savePayload);
      addToast("success", "Configuracoes salvas com sucesso");
      void loadSettings(true);
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao salvar configuracoes");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestPrinter() {
    setTesting(true);
    try {
      await settingsApi.testPrinter();
      addToast("success", "Teste de impressao enviado para a fila");
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao disparar teste");
    } finally {
      setTesting(false);
    }
  }

  async function handleTestWhatsApp(eventType: "order_received" | "order_ready") {
    if (!settings.whatsapp_test_phone) {
      addToast("error", "Informe um telefone de teste");
      return;
    }
    const templateName = eventType === "order_received"
      ? settings.whatsapp_template_received
      : settings.whatsapp_template_ready;
    if (!templateName) {
      addToast("error", "Informe o nome do template antes de testar");
      return;
    }

    setTestingEvent(eventType);
    try {
      const result = await settingsApi.testWhatsApp({
        phone: settings.whatsapp_test_phone,
        event_type: eventType,
        template_name: templateName,
        daily_number: 999,
      });
      addToast(
        "success",
        `Teste enviado (${templateName})${result.provider_message_id ? ` · id ${String(result.provider_message_id).slice(-10)}` : ""}`,
      );
      setWhatsappStats(await settingsApi.getWhatsAppStats());
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao enviar teste");
    } finally {
      setTestingEvent(null);
    }
  }

  async function handleProcessQueue() {
    setProcessingQueue(true);
    try {
      const result = await settingsApi.processWhatsAppQueue();
      addToast(
        "success",
        `${result.processed ?? 0} processadas (enviadas: ${result.sent ?? 0}, falhas: ${result.failed ?? 0})`,
      );
      setWhatsappStats(await settingsApi.getWhatsAppStats());
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao processar fila");
    } finally {
      setProcessingQueue(false);
    }
  }

  async function handleReprocessFailures() {
    setReprocessing(true);
    try {
      const { reset } = await settingsApi.reprocessFailedWhatsApp();
      if (reset === 0) {
        addToast("success", "Nenhuma falha recuperavel encontrada");
      } else {
        addToast("success", `${reset} mensagens reenfileiradas para nova tentativa`);
      }
      setWhatsappStats(await settingsApi.getWhatsAppStats());
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao reprocessar falhas");
    } finally {
      setReprocessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F5F7FA]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Sidebar fixa (desktop) ──────────────────────────────────── */}
      {/* Sidebar settings: no md começa na left-0 do conteúdo; no lg precisa offset do sidebar do app (240px = lg:left-60) */}
      <aside className="fixed left-0 top-14 z-20 hidden h-[calc(100vh-3.5rem)] w-72 flex-col overflow-y-auto bg-[#1C1C1E] md:flex lg:left-60 border-r border-zinc-800/80">
        {/* Identity */}
        <div className="px-6 pt-6 pb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-brand-red">Painel de controle</p>
          <h1 className="mt-1.5 text-xl font-black text-white">Configurações</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Pedidos, impressão, notificações e autenticação.
          </p>
        </div>

        {/* Branch badge */}
        {currentBranch && (
          <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-zinc-800/60 ring-1 ring-white/8">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-red/15 text-[11px] font-black text-brand-red ring-1 ring-brand-red/20">
                {currentBranch.code}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">{currentBranch.name}</p>
                <p className="text-[10px] text-zinc-500">Configurações globais</p>
              </div>
            </div>
            <a
              href="/app/configuracoes/filiais"
              className="flex items-center justify-center border-t border-white/6 px-4 py-2.5 text-[11px] font-bold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Editar filial →
            </a>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const accent = SECTION_ACCENT[section.id] ?? SECTION_ACCENT.pedido;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-150 ${
                  active
                    ? "bg-white/10 shadow-sm ring-1 ring-white/10"
                    : "hover:bg-white/5"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                  active ? `${accent.iconBg}` : "bg-zinc-800 group-hover:bg-zinc-700"
                }`}>
                  <Icon className={`h-4 w-4 transition-colors ${active ? accent.iconColor : "text-zinc-500 group-hover:text-zinc-400"}`} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold transition-colors ${active ? "text-white" : "text-zinc-300 group-hover:text-white"}`}>
                    {section.title}
                  </span>
                  <span className={`block text-[10px] leading-tight transition-colors ${active ? "text-zinc-400" : "text-zinc-600"}`}>
                    {section.description}
                  </span>
                </span>
                {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />}
              </button>
            );
          })}
        </nav>

        {/* Status */}
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-zinc-800/40 ring-1 ring-white/6">
          <p className="border-b border-white/6 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-600">Status do sistema</p>
          <div className="grid grid-cols-2 gap-px bg-white/6">
            <StatPill label={`${settings.public_ordering_start_time}–${settings.public_ordering_end_time}`} value={publicOrderStatus} tone={settings.public_ordering_enabled === "true" ? "green" : "red"} />
            <StatPill label={printWorkerStatus.lastSeen} value={`Pi ${printWorkerStatus.value}`} tone={printWorkerStatus.tone} />
            <StatPill label={`${settings.printer_host}:${settings.printer_port}`} value={printingStatus} tone={settings.printing_enabled === "true" ? "green" : "red"} />
            <StatPill label={`${whatsappStats.pending} pendentes`} value={whatsappStatus} tone={settings.whatsapp_enabled === "true" ? "green" : "neutral"} />
          </div>
        </div>

        {/* Save */}
        <div className="p-4 pt-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-4 py-3 text-sm font-black text-white shadow-lg shadow-brand-red/25 transition-all hover:bg-brand-red/90 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </aside>

      {/* ── Mobile header (sticky, dark) ─────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#1C1C1E] md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-brand-red">Painel de controle</p>
            <h1 className="text-base font-black text-white">Configurações</h1>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-red px-3.5 py-2 text-xs font-black text-white transition-all active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </button>
        </div>

        {/* Branch indicator — mobile */}
        {currentBranch && (
          <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-red/20 text-[9px] font-black text-brand-red">
                {currentBranch.code}
              </span>
              <p className="text-[11px] font-bold text-zinc-300">{currentBranch.name}</p>
            </div>
            <a href="/app/configuracoes/filiais" className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300">
              Editar →
            </a>
          </div>
        )}

        {/* Mobile section tabs */}
        <nav className="-mx-0 flex gap-1.5 overflow-x-auto px-3 pb-3 pt-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const accent = SECTION_ACCENT[section.id] ?? SECTION_ACCENT.pedido;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${
                  active
                    ? `${accent.iconBg} ${accent.iconColor} ring-1 ring-inset ring-current/20`
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{section.title}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Conteúdo principal (mobile + desktop) ─────────────────────── */}
      {/* No md: sidebar settings tem 288px (w-72), offset o conteúdo */}
      <div className="md:pl-72">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-32 md:max-w-none md:px-6 md:py-6 md:pb-8">

        <div className="space-y-4">
          <SettingsPanel
            id="pedido"
            icon={Store}
            title="Pedido pelo site"
            description="Controle quando clientes podem criar pedidos pelo cardapio publico."
            className={activeSection === "pedido" ? "block" : "hidden md:block"}
          >
            <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
              <ToggleGroup>
                <ToggleRow
                  checked={settings.public_ordering_enabled === "true"}
                  onChange={() => toggle("public_ordering_enabled")}
                  label="Receber pedidos online"
                  description="Quando desligado, clientes veem a mensagem de pedidos pausados e nao conseguem criar pedidos."
                />
                <ToggleRow
                  checked={settings.apply_packaging_fee_for_takeout === "true"}
                  onChange={() => toggle("apply_packaging_fee_for_takeout")}
                  label="Cobrar taxa em pedidos para viagem"
                  description="Aplica automaticamente a taxa de embalagem quando o cliente selecionar para levar."
                />
              </ToggleGroup>
              <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="flex items-center gap-2 text-zinc-700">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-wide">Horario online</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inicio">
                    <Input
                      type="time"
                      value={settings.public_ordering_start_time}
                      onChange={(event) => set("public_ordering_start_time", event.target.value)}
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Fim">
                    <Input
                      type="time"
                      value={settings.public_ordering_end_time}
                      onChange={(event) => set("public_ordering_end_time", event.target.value)}
                      className="bg-white"
                    />
                  </Field>
                </div>
                <Field label="Taxa viagem">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 1.00"
                    value={settings.packaging_fee}
                    onChange={(event) => set("packaging_fee", event.target.value)}
                    className="bg-white"
                  />
                </Field>
              </div>
            </div>
            </div>{/* end space-y-5 pedido */}
          </SettingsPanel>

          <SettingsPanel
            id="embalagem"
            icon={Package}
            title="Embalagem"
            description="Defina como a taxa de viagem entra no pedido."
            className={activeSection === "embalagem" ? "block" : "hidden md:block"}
          >
            <div className="space-y-5">
              <ToggleGroup>
                <ToggleRow
                  checked={settings.apply_packaging_fee_for_takeout === "true"}
                  onChange={() => toggle("apply_packaging_fee_for_takeout")}
                  label="Cobrar em pedidos para viagem"
                  description="Mantem o calculo centralizado no backend e no caixa."
                />
              </ToggleGroup>
              <Field label="Valor da taxa (R$)">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 1.00"
                  value={settings.packaging_fee}
                  onChange={(event) => set("packaging_fee", event.target.value)}
                />
              </Field>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="impressao"
            icon={Printer}
            title="Impressao"
            description="Configure vias, rede e teste da impressora termica."
            className={activeSection === "impressao" ? "block" : "hidden md:block"}
          >
            <div className="space-y-5">
              <div className={`rounded-xl border p-4 ${
                printWorkerStatus.online
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-red-100 bg-red-50"
              }`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      printWorkerStatus.online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>
                      {printWorkerStatus.online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                    </span>
                    <span>
                      <p className="text-sm font-black text-zinc-950">Raspberry Pi</p>
                      <p className="text-xs font-semibold text-zinc-600">{printWorkerStatus.label} - {printWorkerStatus.lastSeen}</p>
                    </span>
                  </div>
                  <Button variant="outline" onClick={() => void loadSettings(true)} className="h-10 gap-2 bg-white md:w-auto">
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 text-xs font-semibold text-zinc-700 md:grid-cols-3">
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="font-black uppercase tracking-wide text-zinc-400">IP do Raspberry</p>
                    <p className="mt-1 text-sm font-black text-zinc-900">{printWorkerStatus.raspberryIp}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="font-black uppercase tracking-wide text-zinc-400">IP lido pelo worker</p>
                    <p className="mt-1 text-sm font-black text-zinc-900">
                      {printWorkerStatus.printerHost}:{printWorkerStatus.printerPort}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="font-black uppercase tracking-wide text-zinc-400">Configurado no painel</p>
                    <p className="mt-1 text-sm font-black text-zinc-900">{settings.printer_host}:{settings.printer_port}</p>
                  </div>
                </div>
              </div>

              <ToggleGroup>
                <ToggleRow
                  checked={settings.printing_enabled === "true"}
                  onChange={() => toggle("printing_enabled")}
                  label="Impressão ativada"
                  description="Habilita o envio de jobs para a impressora."
                />
                <ToggleRow
                  checked={settings.print_kitchen_copy === "true"}
                  onChange={() => toggle("print_kitchen_copy")}
                  label="Via da cozinha"
                  description="Usada para kreps e itens de cozinha."
                />
                <ToggleRow
                  checked={settings.print_juice_potato_copy === "true"}
                  onChange={() => toggle("print_juice_potato_copy")}
                  label="Via sucos e batatas"
                  description="Separa produção de bebidas, sucos e batatas."
                />
                <ToggleRow
                  checked={settings.print_customer_copy === "true"}
                  onChange={() => toggle("print_customer_copy")}
                  label="Via do cliente"
                  description="Cópia de conferência para entrega ou retirada."
                />
              </ToggleGroup>

              <div className="grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-2 lg:grid-cols-4">
                <Field label="Endereco IP">
                  <Input
                    placeholder="192.168.0.50"
                    value={settings.printer_host}
                    onChange={(event) => set("printer_host", event.target.value)}
                    aria-describedby="printer-host-hint"
                  />
                  <span id="printer-host-hint" className="block text-xs font-medium leading-relaxed text-zinc-400">
                    Salve para o Raspberry assumir o novo IP; o worker atualiza sozinho em poucos segundos.
                  </span>
                </Field>
                <Field label="Porta">
                  <Input
                    type="number"
                    placeholder="9100"
                    value={settings.printer_port}
                    onChange={(event) => set("printer_port", event.target.value)}
                  />
                </Field>
                <Field label="Largura">
                  <div className="grid grid-cols-2 gap-2">
                    {["80", "58"].map((width) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => set("printer_paper_width", width)}
                        className={`h-12 rounded-lg border text-sm font-black transition-colors ${
                          settings.printer_paper_width === width
                            ? "border-brand-red bg-red-50 text-brand-red"
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {width}mm
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={handleTestPrinter}
                    loading={testing}
                    className="h-12 w-full"
                  >
                    Testar impressao
                  </Button>
                </div>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="whatsapp"
            icon={MessageCircle}
            title="WhatsApp"
            description="Templates transacionais, testes e fila de envio."
            className={activeSection === "whatsapp" ? "block" : "hidden md:block"}
          >
            <div className="space-y-5">
              {whatsappStats.token_expired && (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="text-xs font-semibold leading-relaxed">
                    <p className="font-black">Token Meta expirado nas ultimas 24h.</p>
                    <p className="mt-1">Renove WHATSAPP_ACCESS_TOKEN no Supabase Secrets e reprocesse as falhas.</p>
                  </div>
                </div>
              )}

              <ToggleGroup>
                <ToggleRow
                  checked={settings.whatsapp_enabled === "true"}
                  onChange={() => toggle("whatsapp_enabled")}
                  label="Integração WhatsApp"
                  description="Envia novo_pedido (quando entra na fila) e pedido_pronto (quando fica pronto)."
                />
              </ToggleGroup>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <StatPill light label="Pendentes" value={whatsappStats.pending} />
                <StatPill light label="Enviadas (24h)" value={whatsappStats.sent_24h} tone="green" />
                <StatPill light label="Entregues (24h)" value={whatsappStats.delivered_24h} tone="green" />
                <StatPill light label="Lidas (24h)" value={whatsappStats.read_24h} tone="green" />
                <StatPill light label="Falhas (24h)" value={whatsappStats.failed_24h} tone="red" />
              </div>

              <div className="grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-2">
                <Field label="Template 'novo pedido'" hint="Enviado ao entrar em producao (UTILITY).">
                  <Input
                    placeholder="novo_pedido"
                    value={settings.whatsapp_template_received}
                    onChange={(event) => set("whatsapp_template_received", event.target.value)}
                  />
                </Field>
                <Field label="Template 'pedido pronto'" hint="Enviado ao marcar PRONTO (UTILITY).">
                  <Input
                    placeholder="pedido_pronto"
                    value={settings.whatsapp_template_ready}
                    onChange={(event) => set("whatsapp_template_ready", event.target.value)}
                  />
                </Field>
                <Field label="Idioma">
                  <Input
                    placeholder="pt_BR"
                    value={settings.whatsapp_template_language}
                    onChange={(event) => set("whatsapp_template_language", event.target.value)}
                  />
                </Field>
                <Field label="Telefone de teste" hint="DDI+DDD+numero (com ou sem +).">
                  <Input
                    placeholder="+5561999999999"
                    value={settings.whatsapp_test_phone}
                    onChange={(event) => set("whatsapp_test_phone", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-2 border-t border-zinc-100 pt-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => handleTestWhatsApp("order_received")}
                  loading={testingEvent === "order_received"}
                  disabled={testingEvent !== null}
                >
                  Testar &quot;novo pedido&quot;
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleTestWhatsApp("order_ready")}
                  loading={testingEvent === "order_ready"}
                  disabled={testingEvent !== null}
                >
                  Testar &quot;pedido pronto&quot;
                </Button>
                <Button
                  variant="outline"
                  onClick={handleProcessQueue}
                  loading={processingQueue}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Processar fila agora
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReprocessFailures}
                  loading={reprocessing}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reprocessar falhas recuperaveis
                </Button>
              </div>

              <div className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-amber-900">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">
                  Templates devem estar aprovados pela Meta (categoria UTILITY). Falhas definitivas (template inexistente, token invalido, destinatario fora do WhatsApp) nao sao reprocessadas automaticamente.
                </p>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="biometria"
            icon={Fingerprint}
            title="Biometria"
            description="Controle digitais salvas para login rapido neste dispositivo."
            className={activeSection === "biometria" ? "block" : "hidden md:block"}
          >
            <BiometricManager />
          </SettingsPanel>

        </div>{/* end space-y-4 panels */}
        </div>{/* end content wrapper */}
      </div>{/* end md:pl-72 */}
    </div>
  );
}
