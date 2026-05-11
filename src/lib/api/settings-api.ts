import { createClient } from "../supabase/client";

const supabase = createClient();

export interface PrinterSettings {
  printing_enabled?: string;
  printer_host?: string;
  printer_port?: string | number;
  printer_type?: string;
  printer_paper_width?: string | number;
}

type SettingPrimitive = string | number | boolean;

function settingToInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export const settingsApi = {
  async getSettings(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');
    
    if (error) throw error;
    
    return (data || []).reduce((acc: Record<string, string>, curr: { key: string; value: unknown }) => {
      acc[curr.key] = settingToInputValue(curr.value);
      return acc;
    }, {} as Record<string, string>);
  },

  async saveSettings(settings: Record<string, SettingPrimitive>) {
    const entries = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('settings')
      .upsert(entries);
    
    if (error) throw error;
  },

  async testPrinter() {
    const { data, error } = await supabase.functions.invoke('test-printer');
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao disparar teste de impressão');
    return data;
  },

  async testWhatsApp(phone: string) {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: { action: 'send_test', phone }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao enviar teste de WhatsApp');
    return data;
  },

  async processWhatsAppQueue() {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: { action: 'process_queue' }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao processar fila de WhatsApp');
    return data;
  },

  async getWhatsAppStats() {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('status');
    
    if (error) throw error;
    
    const stats = {
      pending: 0,
      sent: 0,
      failed: 0,
    };
    
    (data || []).forEach((m: { status: string }) => {
      if (m.status === 'PENDING') stats.pending++;
      else if (m.status === 'SENT') stats.sent++;
      else if (m.status === 'FAILED') stats.failed++;
    });
    
    return stats;
  }
};
