"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
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
      className="flex min-h-16 w-full items-center justify-between gap-4 border-b border-zinc-100 px-1 py-3 text-left last:border-b-0"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-zinc-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs font-medium leading-relaxed text-zinc-500">{description}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-red" : "bg-zinc-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
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
      <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
      {hint && <span className="block text-xs font-medium leading-relaxed text-zinc-400">{hint}</span>}
    </label>
  );
}

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
  return (
    <section id={id} className={`scroll-mt-24 rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <h2 className="text-base font-black text-zinc-950">{title}</h2>
          <p className="mt-0.5 text-xs font-medium text-zinc-500">{description}</p>
        </span>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "red";
}) {
  const toneClass = {
    neutral: "border-zinc-200 bg-white text-zinc-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-red-100 bg-red-50 text-red-700",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p>
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
    <div className="min-h-full bg-[#F5F7FA] pb-28">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur md:static md:bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-brand-red">Sistema</p>
              <h1 className="mt-1 text-2xl font-black text-zinc-950">Configuracoes</h1>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                Ajuste pedidos online, impressao, notificacoes e acesso rapido.
              </p>
            </div>
            <Button onClick={handleSave} loading={saving} className="gap-2 md:w-auto">
              {!saving && <Save className="h-4 w-4" />}
              Salvar alteracoes
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <StatPill
              label={`Das ${settings.public_ordering_start_time} as ${settings.public_ordering_end_time}`}
              value={publicOrderStatus}
              tone={settings.public_ordering_enabled === "true" ? "green" : "red"}
            />
            <StatPill
              label={`${settings.printer_host}:${settings.printer_port}`}
              value={printingStatus}
              tone={settings.printing_enabled === "true" ? "green" : "red"}
            />
            <StatPill
              label={printWorkerStatus.lastSeen}
              value={`Pi ${printWorkerStatus.value}`}
              tone={printWorkerStatus.tone}
            />
            <StatPill
              label={`${whatsappStats.pending} pendentes`}
              value={whatsappStatus}
              tone={settings.whatsapp_enabled === "true" ? "green" : "neutral"}
            />
          </div>

          <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-black transition-colors ${
                    active ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.title}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-5 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="hidden md:sticky md:top-20 md:block md:self-start">
          <nav className="grid gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    active ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{section.title}</span>
                    <span className={`mt-0.5 block text-xs font-medium ${active ? "text-zinc-300" : "text-zinc-400"}`}>
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-5">
          <SettingsPanel
            id="pedido"
            icon={Store}
            title="Pedido pelo site"
            description="Controle quando clientes podem criar pedidos pelo cardapio publico."
            className={activeSection === "pedido" ? "block" : "hidden md:block"}
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div>
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
              </div>
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
          </SettingsPanel>

          <SettingsPanel
            id="embalagem"
            icon={Package}
            title="Embalagem"
            description="Defina como a taxa de viagem entra no pedido."
            className={activeSection === "embalagem" ? "block" : "hidden md:block"}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                checked={settings.apply_packaging_fee_for_takeout === "true"}
                onChange={() => toggle("apply_packaging_fee_for_takeout")}
                label="Cobrar em pedidos para viagem"
                description="Mantem o calculo centralizado no backend e no caixa."
              />
              <Field label="Valor da taxa">
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

              <div className="grid gap-4 lg:grid-cols-3">
                <ToggleRow
                  checked={settings.printing_enabled === "true"}
                  onChange={() => toggle("printing_enabled")}
                  label="Impressao ativada"
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
                  description="Separa producao de bebidas, sucos e batatas."
                />
                <ToggleRow
                  checked={settings.print_customer_copy === "true"}
                  onChange={() => toggle("print_customer_copy")}
                  label="Via do cliente"
                  description="Copia de conferencia para entrega ou retirada."
                />
              </div>

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

              <ToggleRow
                checked={settings.whatsapp_enabled === "true"}
                onChange={() => toggle("whatsapp_enabled")}
                label="Integracao WhatsApp"
                description="Envia novo_pedido (quando entra na fila) e pedido_pronto (quando fica pronto)."
              />

              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <StatPill label="Pendentes" value={whatsappStats.pending} />
                <StatPill label="Enviadas (24h)" value={whatsappStats.sent_24h} tone="green" />
                <StatPill label="Entregues (24h)" value={whatsappStats.delivered_24h} tone="green" />
                <StatPill label="Lidas (24h)" value={whatsappStats.read_24h} tone="green" />
                <StatPill label="Falhas (24h)" value={whatsappStats.failed_24h} tone="red" />
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
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="text-sm font-black text-zinc-900">Salvar configuracoes</p>
            <p className="text-xs font-medium text-zinc-500">As alteracoes so entram em vigor depois de salvar.</p>
          </div>
          <Button onClick={handleSave} loading={saving} className="w-full gap-2 md:w-auto">
            {!saving && <Check className="h-4 w-4" />}
            Salvar alteracoes
          </Button>
        </div>
      </div>
    </div>
  );
}
