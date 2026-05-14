import { supabase } from './supabase';
import { printWithConfig } from './printer';
import { config } from './config';

let remoteConfigCache: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 10000;

function settingBool(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function settingNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function settingString(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

async function updateJobStatus(jobId: string, status: 'PENDING' | 'PRINTED' | 'FAILED', extra: Record<string, unknown> = {}) {
  const { error } = await supabase
    .from('printer_jobs')
    .update({ status, ...extra })
    .eq('id', jobId);

  if (!error) return;

  console.warn(`[JOBS] Atualizacao com metadados falhou para job ${jobId}; tentando somente status:`, error.message);
  const { error: fallbackError } = await supabase
    .from('printer_jobs')
    .update({ status })
    .eq('id', jobId);

  if (fallbackError) throw fallbackError;
}

export function invalidateRemoteConfig() {
  remoteConfigCache = null;
  lastFetchTime = 0;
}

export async function getRemoteConfig() {
  const now = Date.now();
  if (remoteConfigCache && (now - lastFetchTime < CACHE_TTL)) {
    return remoteConfigCache;
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const settings = (data || []).reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    remoteConfigCache = {
      printingEnabled: settingBool(settings.printing_enabled, true),
      printerHost: settingString(settings.printer_host, config.printerHost),
      printerPort: settingNumber(settings.printer_port, config.printerPort),
      printerType: settingString(settings.printer_type, config.printerType),
      printerPaperWidth: settingNumber(settings.printer_paper_width, config.printerPaperWidth),
      printerCharacterSet: settingString(settings.printer_character_set, config.printerCharacterSet)
    };
    lastFetchTime = now;
    return remoteConfigCache;
  } catch (err) {
    console.warn('[JOBS] Falha ao carregar config remota, usando fallback:', err);
    return {
      printingEnabled: true,
      printerHost: config.printerHost,
      printerPort: config.printerPort,
      printerType: config.printerType,
      printerPaperWidth: config.printerPaperWidth,
      printerCharacterSet: config.printerCharacterSet
    };
  }
}

export async function processJob(job: any) {
  console.log(`[JOBS] Processando job ${job.id} (setor: ${job.sector})`);

  try {
    const remoteConfig = await getRemoteConfig();

    if (!remoteConfig.printingEnabled) {
      throw new Error('Impressao desativada no painel administrativo');
    }

    await printWithConfig(job.content, remoteConfig);
    await updateJobStatus(job.id, 'PRINTED', { printed_at: new Date().toISOString() });
    console.log(`[JOBS] Job ${job.id} marcado como PRINTED.`);
  } catch (err: any) {
    console.error(`[JOBS] Erro ao processar job ${job.id}:`, err);

    const errorMsg = err.message || String(err);
    const shouldRetry = [
      'offline',
      'inalcancavel',
      'unreachable',
      'econnrefused',
      'ehostunreach',
      'etimedout',
      'timeout',
      'connect',
    ].some((part) => errorMsg.toLowerCase().includes(part));

    try {
      if (shouldRetry) {
        await updateJobStatus(job.id, 'PENDING', { error_message: errorMsg });
        console.warn(`[JOBS] Job ${job.id} permanece PENDING para retry quando a impressora voltar.`);
      } else {
        await updateJobStatus(job.id, 'FAILED', { error_message: errorMsg });
      }
    } catch (failedError) {
      console.error(`[JOBS] Erro fatal: nao foi possivel marcar o job ${job.id} como FAILED:`, failedError);
    }
  }
}

let isProcessing = false;

export async function pollPendingJobs() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const { data: jobs, error } = await supabase
      .from('printer_jobs')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[JOBS] Erro ao buscar jobs pendentes:', error);
      return;
    }

    for (const job of jobs || []) {
      await processJob(job);
    }
  } finally {
    isProcessing = false;
  }
}

export function subscribeToJobs() {
  console.log('[JOBS] Inscrito no Supabase Realtime para captar novos printer_jobs...');
  supabase
    .channel('public:printer_jobs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'printer_jobs' },
      (payload) => {
        const job = payload.new;
        if (job.status === 'PENDING') {
          console.log(`[JOBS] Realtime: Novo job recebido via canal: ${job.id}`);
          processJob(job);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[JOBS] Assinatura Realtime ativada com sucesso.');
      } else {
        console.log(`[JOBS] Status do Realtime: ${status}`);
      }
    });
}

export function subscribeToSettingsChanges() {
  console.log('[JOBS] Inscrito no Supabase Realtime para captar mudancas de settings...');
  supabase
    .channel('public:settings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        const key = String((payload.new as any)?.key || (payload.old as any)?.key || '');
        if (key.startsWith('print_worker_')) return;

        invalidateRemoteConfig();
        console.log(`[JOBS] Configuracao atualizada (${key || 'settings'}). Cache da impressora invalidado.`);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[JOBS] Assinatura de settings ativada com sucesso.');
      } else {
        console.log(`[JOBS] Status do Realtime settings: ${status}`);
      }
    });
}
