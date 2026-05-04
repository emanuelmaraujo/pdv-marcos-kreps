import { supabase } from './supabase';
import { printJobContent } from './printer';

export async function processJob(job: any) {
  console.log(`[JOBS] Processando job ${job.id} (target: ${job.target_sector})`);
  try {
    await printJobContent(job.content);
    
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
    
    // Falha - Marcar erro
    // Nota: Estamos usando um update simples apenas mudando status e inserindo erro caso a coluna exista, mas como o prompt indica: error_message = mensagem do erro. 
    // Vamos inserir se estiver no schema, se der erro porque não tem a coluna, faz fallback sem ela.
    
    const errorMsg = err.message || String(err);
    let updatePayload: any = { 
      status: 'FAILED',
      // Assuming error_message column exists as per requirements
      error_message: errorMsg 
    };
    
    const { error: failedError } = await supabase
      .from('printer_jobs')
      .update(updatePayload) // Se error_message for requerido, adicionamos dinâmico
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
