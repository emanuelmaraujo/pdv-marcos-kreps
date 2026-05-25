import { initPrinter } from './printer';
import { pollPendingJobs, subscribeToJobs, subscribeToSettingsChanges } from './jobs';
import { config } from './config';
import { startWorkerHeartbeat } from './status';

process.on('uncaughtException', (err) => {
  console.error('[SYSTEM] Excecao nao tratada — reiniciando em 3s:', err);
  setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[SYSTEM] Promise rejeitada sem tratamento — reiniciando em 3s:', reason);
  setTimeout(() => process.exit(1), 3000);
});

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
