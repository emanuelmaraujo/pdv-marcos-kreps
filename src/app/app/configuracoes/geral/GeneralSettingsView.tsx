"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import {
  AlertTriangle,
  Clock,
  Fingerprint,
  Globe2,
  Info,
  Loader2,
  MessageCircle,
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
import { Field } from "@/components/ui/Field";
import { ToggleGroup, ToggleRow } from "@/components/ui/ToggleRow";
import { StatPill } from "@/components/ui/StatPill";
import { SettingsPanel, type SettingsPanelAccent } from "@/components/ui/SettingsPanel";
import { settingsApi } from "@/lib/api/settings-api";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { branchesAdminApi } from "@/lib/api/branches-admin-api";
import { SettingsBadge, SettingsPageHeader } from "../components/SettingsPageHeader";

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

type SectionId = "pedido" | "impressao" | "whatsapp" | "biometria";

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
  label: "Sem conexão com a impressora",
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
  { id: "pedido", title: "Pedido pelo site", description: "Horario, disponibilidade e embalagem", icon: Store },
  { id: "impressao", title: "Impressão", description: "Padrão da rede — filiais podem sobrescrever", icon: Printer },
  { id: "whatsapp", title: "WhatsApp", description: "Padrão da rede — filiais podem sobrescrever", icon: MessageCircle },
  { id: "biometria", title: "Biometria", description: "Login rapido", icon: Fingerprint },
];

// Accent colors for section icons (cleaner than gradient headers)
const SECTION_ACCENT: Record<string, { iconBg: string; iconColor: string; navActive: string }> = {
  pedido:    { iconBg: "bg-[var(--status-info-bg)]", iconColor: "text-[var(--status-info)]", navActive: "" },
  impressao: { iconBg: "bg-brand-red/10", iconColor: "text-brand-red", navActive: "" },
  whatsapp:  { iconBg: "bg-[var(--status-success-bg)]", iconColor: "text-[var(--status-success)]", navActive: "" },
  biometria: { iconBg: "bg-[var(--bg-subtle)]", iconColor: "text-[var(--text-secondary)]", navActive: "" },
};

function accentFor(id: SectionId): SettingsPanelAccent {
  return SECTION_ACCENT[id] ?? SECTION_ACCENT.pedido;
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
    label: online ? "Impressora conectada" : "Sem conexão com a impressora",
    tone: online ? "green" : "red",
    lastSeen: formatLastSeen(lastSeenAt),
    raspberryIp: data.print_worker_ip || "-",
    printerHost: data.print_worker_printer_host || "-",
    printerPort: data.print_worker_printer_port || "-",
  };
}

export default function GeneralSettingsView() {
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
  const [branchOverrides, setBranchOverrides] = useState({ printer: 0, whatsapp: 0, total: 0 });
  const { toasts, addToast, removeToast } = useToast();
  const { isGlobalAdmin, isLoading: userLoading } = useUser();

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

      const branches = await branchesAdminApi.listAll();
      setBranchOverrides({
        printer: branches.filter((b) => b.printer_config && Object.keys(b.printer_config).length > 0).length,
        whatsapp: branches.filter((b) => b.whatsapp_templates && Object.keys(b.whatsapp_templates).length > 0).length,
        total: branches.length,
      });
    } catch {
      if (!silent) addToast("error", "Erro ao carregar configuracoes");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (userLoading) return;
    if (!isGlobalAdmin) return;
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
  }, [isGlobalAdmin, loadSettings, userLoading]);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.saveSettings(savePayload);
      addToast("success", "Configuracoes salvas com sucesso");
      void loadSettings(true);
    } catch (error: unknown) {
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos salvar as configurações. Tente novamente."));
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
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos disparar o teste de impressão."));
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
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos enviar a mensagem de teste."));
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
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos processar a fila agora."));
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
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos reprocessar as falhas agora."));
    } finally {
      setReprocessing(false);
    }
  }

  if (userLoading || (isGlobalAdmin && loading)) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!isGlobalAdmin) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[var(--bg-subtle)] p-6">
        <div className="max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 text-center shadow-sm">
          <Info className="mx-auto h-8 w-8 text-brand-amber" />
          <h1 className="mt-4 text-xl font-black text-[var(--text-primary)]">Configuração global protegida</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Administradores de filial podem alterar usuários, operação e taxas somente da própria unidade.
          </p>
          <Link href="/app/configuracoes" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-red px-5 text-sm font-black text-white">
            Voltar às configurações
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SettingsPageHeader
        eyebrow="Administração da rede"
        title="Configurações gerais"
        description="Defina os padrões usados por toda a operação. Cada filial pode sobrescrever impressão e WhatsApp sem alterar as demais unidades."
        icon={Globe2}
        meta={
          <>
            <SettingsBadge tone="info">Escopo global</SettingsBadge>
            <SettingsBadge>{branchOverrides.total} filial(is)</SettingsBadge>
            <SettingsBadge tone={branchOverrides.printer + branchOverrides.whatsapp > 0 ? "warning" : "success"}>
              {branchOverrides.printer + branchOverrides.whatsapp} personalizações locais
            </SettingsBadge>
          </>
        }
        action={
          <Button onClick={handleSave} loading={saving} className="min-h-11 w-full gap-2 sm:w-auto">
            <Save className="h-4 w-4" /> Salvar padrões
          </Button>
        }
      />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-[var(--elevation-1)]" aria-label="Áreas das configurações gerais">
        <nav className="hide-scrollbar flex gap-2 overflow-x-auto">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const accent = SECTION_ACCENT[section.id] ?? SECTION_ACCENT.pedido;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-14 min-w-[11rem] flex-1 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  active
                    ? `${accent.iconBg} ${accent.iconColor} ring-1 ring-inset ring-current/15`
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[var(--bg-surface)]/80" : "bg-[var(--bg-subtle)]"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{section.title}</span>
                  <span className={`mt-0.5 block truncate text-[10px] font-medium ${active ? "opacity-75" : "text-[var(--text-muted)]"}`}>{section.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </section>

      {/* ── Conteúdo principal (mobile + desktop) ─────────────────────── */}
      {/* No md: sidebar settings tem 288px (w-72), offset o conteúdo */}
      <div>
        <div className="space-y-4 pb-24 md:pb-8">

        <div className="space-y-4">
          <SettingsPanel
            id="pedido"
            accent={accentFor("pedido")}
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
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-wide">Horario online</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inicio">
                    <Input
                      type="time"
                      value={settings.public_ordering_start_time}
                      onChange={(event) => set("public_ordering_start_time", event.target.value)}
                      className="bg-[var(--bg-surface)]"
                    />
                  </Field>
                  <Field label="Fim">
                    <Input
                      type="time"
                      value={settings.public_ordering_end_time}
                      onChange={(event) => set("public_ordering_end_time", event.target.value)}
                      className="bg-[var(--bg-surface)]"
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
                    className="bg-[var(--bg-surface)]"
                  />
                </Field>
              </div>
            </div>
            </div>{/* end space-y-5 pedido */}
          </SettingsPanel>

          <SettingsPanel
            id="impressao"
            accent={accentFor("impressao")}
            icon={Printer}
            title="Impressão"
            description="Configure vias, rede e teste da impressora termica."
            className={activeSection === "impressao" ? "block" : "hidden md:block"}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Isto é o <strong className="text-[var(--text-primary)]">padrão da rede</strong>, usado por filiais que não customizaram.
                  {branchOverrides.printer > 0
                    ? ` ${branchOverrides.printer} de ${branchOverrides.total} filial(is) têm impressora customizada.`
                    : " Nenhuma filial customizou até agora."}
                </p>
                <Link href="/app/configuracoes/filiais" className="shrink-0 text-xs font-bold text-brand-red hover:underline">
                  Ver filiais →
                </Link>
              </div>
              <div className={`rounded-xl border p-4 ${
                printWorkerStatus.online
                  ? "border-[var(--status-success)]/25 bg-[var(--status-success-bg)]"
                  : "border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)]"
              }`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      printWorkerStatus.online ? "bg-[var(--status-success)]/15 text-[var(--status-success)]" : "bg-[var(--status-danger)]/15 text-[var(--status-danger)]"
                    }`}>
                      {printWorkerStatus.online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                    </span>
                    <span>
                      <p className="text-sm font-black text-[var(--text-primary)]">Impressora térmica</p>
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">{printWorkerStatus.label} - {printWorkerStatus.lastSeen}</p>
                    </span>
                  </div>
                  <Button variant="outline" onClick={() => void loadSettings(true)} className="h-10 gap-2 md:w-auto">
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 text-xs font-semibold text-[var(--text-secondary)] md:grid-cols-3">
                  <div className="rounded-lg bg-[var(--bg-surface)]/80 p-3">
                    <p className="font-black uppercase tracking-wide text-[var(--text-muted)]">IP do dispositivo</p>
                    <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{printWorkerStatus.raspberryIp}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)]/80 p-3">
                    <p className="font-black uppercase tracking-wide text-[var(--text-muted)]">IP confirmado pela impressora</p>
                    <p className="mt-1 text-sm font-black text-[var(--text-primary)]">
                      {printWorkerStatus.printerHost}:{printWorkerStatus.printerPort}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)]/80 p-3">
                    <p className="font-black uppercase tracking-wide text-[var(--text-muted)]">Configurado no painel</p>
                    <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{settings.printer_host}:{settings.printer_port}</p>
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

              <div className="grid gap-4 border-t border-[var(--border)] pt-4 md:grid-cols-2 lg:grid-cols-4">
                <Field label="Endereco IP">
                  <Input
                    placeholder="192.168.0.50"
                    value={settings.printer_host}
                    onChange={(event) => set("printer_host", event.target.value)}
                    aria-describedby="printer-host-hint"
                  />
                  <span id="printer-host-hint" className="block text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                    Salve para o dispositivo assumir o novo IP; a atualização acontece sozinha em poucos segundos.
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
                            ? "border-brand-red bg-[var(--status-danger-bg)] text-brand-red"
                            : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
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
            accent={accentFor("whatsapp")}
            icon={MessageCircle}
            title="WhatsApp"
            description="Templates transacionais, testes e fila de envio."
            className={activeSection === "whatsapp" ? "block" : "hidden md:block"}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Isto é o <strong className="text-[var(--text-primary)]">padrão da rede</strong>, usado por filiais que não customizaram.
                  {branchOverrides.whatsapp > 0
                    ? ` ${branchOverrides.whatsapp} de ${branchOverrides.total} filial(is) têm templates customizados.`
                    : " Nenhuma filial customizou até agora."}
                </p>
                <Link href="/app/configuracoes/filiais" className="shrink-0 text-xs font-bold text-brand-red hover:underline">
                  Ver filiais →
                </Link>
              </div>
              {whatsappStats.token_expired && (
                <div className="flex gap-3 rounded-xl border p-4" style={{ borderColor: "var(--status-danger)", backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)" }}>
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

              <div className="grid gap-4 border-t border-[var(--border)] pt-4 md:grid-cols-2">
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

              <div className="grid gap-2 border-t border-[var(--border)] pt-4 md:grid-cols-2">
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
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    onClick={handleProcessQueue}
                    loading={processingQueue}
                    className="w-full gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Processar fila agora
                  </Button>
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    {whatsappStats.pending > 0
                      ? `Envia as ${whatsappStats.pending} mensagens que estão esperando na fila.`
                      : "Nenhuma mensagem esperando no momento."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    onClick={handleReprocessFailures}
                    loading={reprocessing}
                    className="w-full gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reprocessar falhas recuperaveis
                  </Button>
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    {whatsappStats.failed_24h > 0
                      ? `Tenta reenviar as falhas recuperáveis das últimas 24h (até ${whatsappStats.failed_24h} mensagens).`
                      : "Nenhuma falha recuperável nas últimas 24h."}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border p-4" style={{ borderColor: "var(--status-warning)", backgroundColor: "var(--status-warning-bg)", color: "var(--status-warning)" }}>
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">
                  Templates devem estar aprovados pela Meta (categoria UTILITY). Falhas definitivas (template inexistente, token invalido, destinatario fora do WhatsApp) nao sao reprocessadas automaticamente.
                </p>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="biometria"
            accent={accentFor("biometria")}
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
    </main>
  );
}
