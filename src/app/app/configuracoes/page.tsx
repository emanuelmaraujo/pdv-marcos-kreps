"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { settingsApi } from "@/lib/api/settings-api";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import {
  Printer,
  Loader2,
  Info,
  Package,
  FileText,
  ChevronDown,
  Check,
  Fingerprint,
} from "lucide-react";
import { BiometricManager } from "@/components/auth/BiometricManager";

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-100 active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-zinc-800">{label}</p>
        {description && <p className="text-xs text-zinc-400 mt-0.5">{description}</p>}
      </div>
      <div
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-brand-red" : "bg-zinc-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}

// ─── Accordion Section ────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = false,
  iconColor = "text-brand-charcoal",
  iconBg = "bg-zinc-100",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  iconColor?: string;
  iconBg?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-zinc-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left md:cursor-default md:pointer-events-none"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-brand-charcoal leading-tight">{title}</p>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{description}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform md:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Always visible on desktop, toggle on mobile */}
      <div className={`md:block ${open ? "block" : "hidden"}`}>
        <div className="border-t border-zinc-100 p-4 space-y-4">{children}</div>
      </div>
    </Card>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ConfiguracoesSistema() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingWA, setTestingWA] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const [whatsappStats, setWhatsappStats] = useState({ pending: 0, sent: 0, failed: 0 });

  const [settings, setSettings] = useState({
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
    whatsapp_template_language: "pt_BR",
    whatsapp_test_phone: "",
    packaging_fee: "0",
    apply_packaging_fee_for_takeout: "false",
  });

  const set = (key: keyof typeof settings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));
  const toggle = (key: keyof typeof settings) =>
    setSettings((prev) => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsApi.getSettings();
      setSettings((prev) => ({
        ...prev,
        printing_enabled: String(data.printing_enabled ?? "true"),
        printer_host: data.printer_host ?? "192.168.0.50",
        printer_port: String(data.printer_port ?? "9100"),
        printer_type: data.printer_type ?? "network",
        printer_paper_width: String(data.printer_paper_width ?? "80"),
        print_customer_copy: String(data.print_customer_copy ?? "true"),
        print_kitchen_copy: String(data.print_kitchen_copy ?? "true"),
        print_juice_potato_copy: String(data.print_juice_potato_copy ?? "true"),
        whatsapp_enabled: String(data.whatsapp_enabled ?? "false"),
        whatsapp_template_ready: data.whatsapp_template_ready ?? "pedido_pronto",
        whatsapp_template_language: data.whatsapp_template_language ?? "pt_BR",
        whatsapp_test_phone: data.whatsapp_test_phone ?? "",
        packaging_fee: data.packaging_fee ?? "0",
        apply_packaging_fee_for_takeout: String(data.apply_packaging_fee_for_takeout ?? "false"),
      }));
      const stats = await settingsApi.getWhatsAppStats();
      setWhatsappStats(stats);
    } catch {
      addToast("error", "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.saveSettings({
        ...settings,
        printing_enabled: settings.printing_enabled === "true",
        apply_packaging_fee_for_takeout: settings.apply_packaging_fee_for_takeout === "true",
        print_customer_copy: settings.print_customer_copy === "true",
        print_kitchen_copy: settings.print_kitchen_copy === "true",
        print_juice_potato_copy: settings.print_juice_potato_copy === "true",
        printer_port: parseInt(settings.printer_port, 10),
        printer_paper_width: parseInt(settings.printer_paper_width, 10),
        packaging_fee: parseFloat(settings.packaging_fee.replace(",", ".")),
      });
      addToast("success", "Configurações salvas com sucesso!");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar configurações";
      addToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      await settingsApi.testPrinter();
      addToast("success", "Teste de impressão enviado para a fila!");
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao disparar teste");
    } finally {
      setTesting(false);
    }
  }

  async function handleTestWhatsApp() {
    if (!settings.whatsapp_test_phone) {
      addToast("error", "Informe um telefone de teste");
      return;
    }
    setTestingWA(true);
    try {
      await settingsApi.testWhatsApp(settings.whatsapp_test_phone);
      addToast("success", "Teste de WhatsApp enviado!");
      const stats = await settingsApi.getWhatsAppStats();
      setWhatsappStats(stats);
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao enviar teste");
    } finally {
      setTestingWA(false);
    }
  }

  async function handleProcessQueue() {
    setProcessingQueue(true);
    try {
      const result = await settingsApi.processWhatsAppQueue();
      addToast("success", `${result.processed} mensagens processadas!`);
      const stats = await settingsApi.getWhatsAppStats();
      setWhatsappStats(stats);
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao processar fila");
    } finally {
      setProcessingQueue(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F5F7FA]">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="p-4 md:p-6 lg:p-8 pb-28 space-y-4 max-w-3xl lg:mx-auto w-full">

        {/* Desktop: 2-column grid for first two sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Embalagem */}
          <Section
            icon={Package}
            title="Taxa de Embalagem"
            description="Cobrança para pedidos viagem"
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            defaultOpen
          >
            <Toggle
              checked={settings.apply_packaging_fee_for_takeout === "true"}
              onChange={() => toggle("apply_packaging_fee_for_takeout")}
              label="Cobrar em pedidos Viagem"
              description="Adiciona taxa automaticamente ao selecionar viagem"
            />
            <Field label="Valor da taxa (R$)">
              <Input
                type="text"
                placeholder="Ex: 1.00"
                value={settings.packaging_fee}
                onChange={(e) => set("packaging_fee", e.target.value)}
              />
            </Field>
          </Section>

          {/* Vias de Impressão */}
          <Section
            icon={FileText}
            title="Vias de Impressão"
            description="Defina quais vias são impressas"
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            defaultOpen
          >
            <Toggle
              checked={settings.print_kitchen_copy === "true"}
              onChange={() => toggle("print_kitchen_copy")}
              label="Via da Cozinha (Kreps)"
            />
            <Toggle
              checked={settings.print_juice_potato_copy === "true"}
              onChange={() => toggle("print_juice_potato_copy")}
              label="Via de Sucos / Batatas"
            />
            <Toggle
              checked={settings.print_customer_copy === "true"}
              onChange={() => toggle("print_customer_copy")}
              label="Via do Cliente"
            />
          </Section>
        </div>

        {/* Impressora */}
        <Section
          icon={Printer}
          title="Impressora Térmica"
          description="Configure o endereço de rede da impressora"
          iconBg="bg-zinc-100"
          iconColor="text-zinc-600"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Toggle
              checked={settings.printing_enabled === "true"}
              onChange={() => toggle("printing_enabled")}
              label="Impressão ativada"
              description="Habilita o envio de jobs para a impressora"
            />
            <div />
            <Field label="Endereço IP">
              <Input
                placeholder="192.168.0.50"
                value={settings.printer_host}
                onChange={(e) => set("printer_host", e.target.value)}
              />
            </Field>
            <Field label="Porta">
              <Input
                type="number"
                placeholder="9100"
                value={settings.printer_port}
                onChange={(e) => set("printer_port", e.target.value)}
              />
            </Field>
            <Field label="Largura do Papel">
              <div className="flex gap-2">
                {["80", "58"].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => set("printer_paper_width", w)}
                    className={`flex-1 h-11 rounded-xl border-2 text-sm font-black transition-all ${
                      settings.printer_paper_width === w
                        ? "border-brand-red bg-brand-red/5 text-brand-red"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleTest}
                loading={testing}
                className="w-full h-11 text-sm font-bold border-zinc-200"
              >
                Testar Impressão
              </Button>
            </div>
          </div>
        </Section>

        {/* WhatsApp */}
        <Section
          icon={() => (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.394 0 12.03c0 2.119.554 4.187 1.604 5.952L0 24l6.126-1.605a11.803 11.803 0 005.92 1.586h.005c6.634 0 12.03-5.396 12.033-12.032.002-3.213-1.248-6.231-3.518-8.502z" />
            </svg>
          )}
          title="WhatsApp Cloud API"
          description="Notificações automáticas para clientes"
          iconBg="bg-green-50"
          iconColor="text-green-600"
        >
          <Toggle
            checked={settings.whatsapp_enabled === "true"}
            onChange={() => toggle("whatsapp_enabled")}
            label="Integração WhatsApp"
            description="Envia mensagem quando o pedido ficar pronto"
          />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-zinc-700">{whatsappStats.pending}</p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Pendentes</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-green-700">{whatsappStats.sent}</p>
              <p className="text-[10px] font-bold text-green-500 uppercase">Enviadas</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-red-700">{whatsappStats.failed}</p>
              <p className="text-[10px] font-bold text-red-400 uppercase">Falhas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Template (Pedido Pronto)">
              <Input
                placeholder="pedido_pronto"
                value={settings.whatsapp_template_ready}
                onChange={(e) => set("whatsapp_template_ready", e.target.value)}
              />
            </Field>
            <Field label="Idioma">
              <Input
                placeholder="pt_BR"
                value={settings.whatsapp_template_language}
                onChange={(e) => set("whatsapp_template_language", e.target.value)}
              />
            </Field>
            <Field label="Telefone de Teste">
              <Input
                placeholder="5561999999999"
                value={settings.whatsapp_test_phone}
                onChange={(e) => set("whatsapp_test_phone", e.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={handleTestWhatsApp}
                loading={testingWA}
                className="flex-1 h-11 text-sm font-bold border-zinc-200"
              >
                Enviar Teste
              </Button>
              <Button
                variant="outline"
                onClick={handleProcessQueue}
                loading={processingQueue}
                className="flex-1 h-11 text-sm font-bold border-zinc-200"
              >
                Processar Fila
              </Button>
            </div>
          </div>
        </Section>

        {/* Biometria */}
        <Section
          icon={Fingerprint}
          title="Biometria / Digital"
          description="Gerencie as digitais para login rápido (máx. 3)"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        >
          <BiometricManager />
        </Section>

        {/* Nota */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-amber-800 font-bold leading-none">Atenção</p>
            <p className="text-xs text-amber-800/80 leading-relaxed">
              O WhatsApp Cloud API requer templates aprovados pela Meta. Certifique-se de que os{" "}
              <strong>Secrets</strong> estão configurados no Supabase.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-100 bg-white/95 backdrop-blur p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto">
          <Button
            onClick={handleSave}
            loading={saving}
            className="w-full h-12 text-base font-black shadow-lg shadow-brand-red/20 gap-2"
          >
            {!saving && <Check className="h-4 w-4" />}
            Salvar Todas as Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
