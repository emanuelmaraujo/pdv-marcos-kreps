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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

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
    const { data, error } = await supabase.functions.invoke('test-printer', {
      headers: await getAuthHeaders(),
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao disparar teste de impressão');
    return data;
  },

  async testWhatsApp(params: {
    phone: string;
    event_type?: 'order_received' | 'order_ready';
    template_name?: string;
    daily_number?: number | string;
  }) {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        action: 'send_test',
        phone: params.phone,
        event_type: params.event_type,
        template_name: params.template_name,
        daily_number: params.daily_number,
      },
      headers: await getAuthHeaders(),
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao enviar teste de WhatsApp');
    return data;
  },

  async processWhatsAppQueue() {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: { action: 'process_queue' },
      headers: await getAuthHeaders(),
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Falha ao processar fila de WhatsApp');
    return data;
  },

  async getWhatsAppStats(): Promise<{
    pending: number;
    sent_24h: number;
    failed_24h: number;
    delivered_24h: number;
    read_24h: number;
    token_expired: boolean;
  }> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: rows, error: rowsErr }, { data: tokenAlerts }] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('status, delivery_status, updated_at')
        .gte('updated_at', since24h),
      supabase
        .from('audit_logs')
        .select('id')
        .eq('action', 'WHATSAPP_FAILED')
        .gte('created_at', since24h)
        .filter('new_data->>token_expired', 'eq', 'true')
        .limit(1),
    ]);
    if (rowsErr) throw rowsErr;

    let pending = 0;
    let sent_24h = 0;
    let failed_24h = 0;
    let delivered_24h = 0;
    let read_24h = 0;

    (rows || []).forEach((m: { status: string; delivery_status?: string | null }) => {
      if (m.status === 'PENDING') pending++;
      else if (m.status === 'SENT') sent_24h++;
      else if (m.status === 'FAILED') failed_24h++;
      if (m.delivery_status === 'DELIVERED') delivered_24h++;
      else if (m.delivery_status === 'READ') read_24h++;
    });

    // pending count must not be bound to the 24h window — count it independently
    const { count: pendingTotal } = await supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    return {
      pending: pendingTotal ?? pending,
      sent_24h,
      failed_24h,
      delivered_24h,
      read_24h,
      token_expired: (tokenAlerts?.length ?? 0) > 0,
    };
  },

  // Recoverable failures = transient errors (rate limits, 5xx, network) that
  // exhausted retries. Definitive failures (template missing, token expired,
  // recipient invalid, bad params) are skipped — reprocessing would just fail
  // again.
  async reprocessFailedWhatsApp(): Promise<{ reset: number }> {
    const DEFINITIVE_CODES = ['100', '131026', '131047', '131051', '132000', '132001', '132005', '132012', '190'];
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .update({
        status: 'PENDING',
        attempts: 0,
        next_retry_at: null,
        error_message: null,
        error_code: null,
      })
      .eq('status', 'FAILED')
      .or(`error_code.is.null,error_code.not.in.(${DEFINITIVE_CODES.join(',')})`)
      .select('id');
    if (error) throw error;
    return { reset: data?.length ?? 0 };
  },
};
