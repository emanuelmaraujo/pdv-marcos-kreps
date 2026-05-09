"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { settingsApi } from "@/lib/api/settings-api";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { Printer, Loader2, Info, Package, FileText } from "lucide-react";

export default function ConfiguracoesSistema() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingWA, setTestingWA] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  
  const [whatsappStats, setWhatsappStats] = useState({
    pending: 0,
    sent: 0,
    failed: 0,
  });

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        packaging_fee: parseFloat(settings.packaging_fee.replace(',', '.')),
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
      const msg = error instanceof Error ? error.message : "Erro ao disparar teste";
      addToast("error", msg);
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
      const msg = error instanceof Error ? error.message : "Erro ao enviar teste";
      addToast("error", msg);
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
      const msg = error instanceof Error ? error.message : "Erro ao processar fila";
      addToast("error", msg);
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
    <div className="flex flex-col h-full bg-zinc-50/50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="p-4 md:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl lg:mx-auto">
        {/* Taxa de Embalagem */}
        <Card className="border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-charcoal" />
            <h2 className="font-bold text-brand-charcoal">Taxa de Embalagem</h2>
          </div>
          
          <CardContent className="p-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Cobrar em pedidos &quot;Para Viagem&quot;?</label>
              <Select
                value={settings.apply_packaging_fee_for_takeout}
                onChange={(e) => setSettings({ ...settings, apply_packaging_fee_for_takeout: e.target.value })}
              >
                <option value="true">Sim, cobrar</option>
                <option value="false">Não, isentar</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Valor da Taxa (R$)</label>
              <Input
                type="text"
                placeholder="Ex: 1.00"
                value={settings.packaging_fee}
                onChange={(e) => setSettings({ ...settings, packaging_fee: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Impressora Térmica */}
        <Card className="border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <Printer className="w-5 h-5 text-brand-charcoal" />
            <h2 className="font-bold text-brand-charcoal">Impressora Térmica</h2>
          </div>
          
          <CardContent className="p-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Status da Impressão</label>
              <Select
                value={settings.printing_enabled}
                onChange={(e) => setSettings({ ...settings, printing_enabled: e.target.value })}
              >
                <option value="true">Ativa</option>
                <option value="false">Desativada</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Endereço IP (Host)</label>
              <Input
                placeholder="Ex: 192.168.0.50"
                value={settings.printer_host}
                onChange={(e) => setSettings({ ...settings, printer_host: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Porta</label>
                <Input
                  type="number"
                  placeholder="Ex: 9100"
                  value={settings.printer_port}
                  onChange={(e) => setSettings({ ...settings, printer_port: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Largura do Papel</label>
                <Select
                  value={settings.printer_paper_width}
                  onChange={(e) => setSettings({ ...settings, printer_paper_width: e.target.value })}
                >
                  <option value="80">80mm</option>
                  <option value="58">58mm</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={handleTest} 
                loading={testing}
                className="w-full h-12 text-base font-bold border-zinc-200"
              >
                Testar Impressão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Vias de Impressão */}
        <Card className="border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-charcoal" />
            <h2 className="font-bold text-brand-charcoal">Vias de Impressão</h2>
          </div>
          
          <CardContent className="p-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Via do Cliente</label>
              <Select
                value={settings.print_customer_copy}
                onChange={(e) => setSettings({ ...settings, print_customer_copy: e.target.value })}
              >
                <option value="true">Sim, imprimir</option>
                <option value="false">Não imprimir</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Via da Cozinha (Kreps)</label>
              <Select
                value={settings.print_kitchen_copy}
                onChange={(e) => setSettings({ ...settings, print_kitchen_copy: e.target.value })}
              >
                <option value="true">Sim, imprimir</option>
                <option value="false">Não imprimir</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Via de Sucos / Batatas</label>
              <Select
                value={settings.print_juice_potato_copy}
                onChange={(e) => setSettings({ ...settings, print_juice_potato_copy: e.target.value })}
              >
                <option value="true">Sim, imprimir</option>
                <option value="false">Não imprimir</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card className="border-zinc-100 shadow-sm overflow-hidden mt-6">
          <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-charcoal" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.394 0 12.03c0 2.119.554 4.187 1.604 5.952L0 24l6.126-1.605a11.803 11.803 0 005.92 1.586h.005c6.634 0 12.03-5.396 12.033-12.032.002-3.213-1.248-6.231-3.518-8.502z"/></svg>
            <h2 className="font-bold text-brand-charcoal">WhatsApp Cloud API</h2>
          </div>
          
          <CardContent className="p-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Status da Integração</label>
              <Select
                value={settings.whatsapp_enabled}
                onChange={(e) => setSettings({ ...settings, whatsapp_enabled: e.target.value })}
              >
                <option value="true">Ativada</option>
                <option value="false">Desativada</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Template (Pronto)</label>
                <Input
                  placeholder="Ex: pedido_pronto"
                  value={settings.whatsapp_template_ready}
                  onChange={(e) => setSettings({ ...settings, whatsapp_template_ready: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Idioma</label>
                <Input
                  placeholder="Ex: pt_BR"
                  value={settings.whatsapp_template_language}
                  onChange={(e) => setSettings({ ...settings, whatsapp_template_language: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Telefone de Teste</label>
              <Input
                placeholder="Ex: 5561999999999"
                value={settings.whatsapp_test_phone}
                onChange={(e) => setSettings({ ...settings, whatsapp_test_phone: e.target.value })}
              />
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="bg-zinc-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-zinc-700">{whatsappStats.pending}</div>
                <div className="text-[10px] uppercase font-bold text-zinc-500">Pendentes</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-green-700">{whatsappStats.sent}</div>
                <div className="text-[10px] uppercase font-bold text-green-500">Enviadas</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-red-700">{whatsappStats.failed}</div>
                <div className="text-[10px] uppercase font-bold text-red-500">Falhas</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleTestWhatsApp} 
                  loading={testingWA}
                  className="h-12 text-sm font-bold border-zinc-200"
                >
                  Enviar Teste
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleProcessQueue} 
                  loading={processingQueue}
                  className="h-12 text-sm font-bold border-zinc-200"
                >
                  Processar Fila
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ação Global de Salvar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-10 lg:relative lg:bg-transparent lg:border-none lg:shadow-none lg:p-0">
          <Button 
            onClick={handleSave} 
            loading={saving}
            className="w-full h-12 text-base font-bold shadow-brand-charcoal/20 shadow-lg"
          >
            Salvar Todas as Alterações
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 mt-6 pb-20">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-amber-800 font-bold leading-none">Atenção</p>
            <p className="text-xs text-amber-800/80 leading-relaxed">
              O WhatsApp Cloud API requer templates aprovados pela Meta. Certifique-se de que os <strong>Secrets</strong> estão configurados no Supabase.
            </p>
          </div>
        </div>
        </div>{/* end max-w-2xl */}
      </div>
    </div>
  );
}
