import { initPrinter } from './printer';
import { pollPendingJobs, subscribeToJobs, subscribeToSettingsChanges } from './jobs';
import { config } from './config';
import { startWorkerHeartbeat } from './status';

async function main() {
  console.log('=============================================');
  console.log('   PDV Marcos Kreps - Local Print Worker     ');
  console.log('=============================================');
  
  console.log(`[SYSTEM] Conectando ao Supabase...`);
  
  await initPrinter();
  
  console.log('[SYSTEM] Executando poll inicial por jobs perdidos ou pendentes...');
  await pollPendingJobs();
  
  console.log(`[SYSTEM] Configurando rotina de checagem a cada ${config.pollIntervalMs}ms...`);
  setInterval(pollPendingJobs, config.pollIntervalMs);
  
  startWorkerHeartbeat();
  subscribeToJobs();
  subscribeToSettingsChanges();
  
  console.log('[SYSTEM] Worker rodando com segurança. Aguardando impressão...');
}

main().catch(err => {
  console.error('[SYSTEM] Erro fatal iniciando worker:', err);
  process.exit(1);
});
