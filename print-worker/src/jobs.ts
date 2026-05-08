import { supabase } from './supabase';
import { printWithConfig } from './printer';
import { config } from './config';

// Cache simples para configurações remotas
let remoteConfigCache: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 10000; // 10 segundos

async function getRemoteConfig() {
  const now = Date.now();
  if (remoteConfigCache && (now - lastFetchTime < CACHE_TTL)) {
    return remoteConfigCache;
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const settings = data.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    remoteConfigCache = {
      printingEnabled: settings.printing_enabled !== "false", // Default true
      printerHost: settings.printer_host || config.printerHost,
      printerPort: settings.printer_port ? parseInt(settings.printer_port, 10) : config.printerPort,
      printerType: settings.printer_type || config.printerType,
      printerPaperWidth: settings.printer_paper_width ? parseInt(settings.printer_paper_width, 10) : config.printerPaperWidth
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
      printerPaperWidth: config.printerPaperWidth
    };
  }
}

export async function processJob(job: any) {
  console.log(`[JOBS] Processando job ${job.id} (setor: ${job.sector})`);
  
  try {
    const remoteConfig = await getRemoteConfig();
    
    if (!remoteConfig.printingEnabled) {
      throw new Error('Impressão desativada no painel administrativo');
    }

    await printWithConfig(job.content, remoteConfig);
    
    // Sucesso - Marcar como impresso
    const { error } = await supabase
      .from('printer_jobs')
      .update({ 
        status: 'PRINTED', 
        printed_at: new Date().toISOString() 
      })
      .eq('id', job.id);
      
    if (error) throw error;
    console.log(`[JOBS] Job ${job.id} marcado como PRINTED.`);
  } catch (err: any) {
    console.error(`[JOBS] Erro ao processar job ${job.id}:`, err);
    
    const errorMsg = err.message || String(err);
    const { error: failedError } = await supabase
      .from('printer_jobs')
      .update({ 
        status: 'FAILED',
        error_message: errorMsg 
      })
      .eq('id', job.id);
      
    if (failedError) {
       console.error(`[JOBS] Erro fatal: Não foi possível marcar o job ${job.id} como FAILED:`, failedError);
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
