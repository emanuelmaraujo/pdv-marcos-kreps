import { initPrinter } from './printer';
import { pollPendingJobs, subscribeToJobs, subscribeToSettingsChanges } from './jobs';
import { config } from './config';
import { startWorkerHeartbeat } from './status';

// Exceção não tratada pode ter deixado estado inconsistente: aí sim vale sair
// e deixar o pm2 subir um processo limpo (ecosystem.config.js tem orçamento de
// restart alto + backoff exponencial justamente pra isso).
process.on('uncaughtException', (err) => {
  console.error('[SYSTEM] Excecao nao tratada — reiniciando em 3s:', err);
  setTimeout(() => process.exit(1), 3000);
});

// Promise rejeitada sem tratamento NAO derruba mais o worker. A origem quase
// sempre é o socket do Supabase Realtime numa oscilação de rede — e derrubar o
// processo por causa disso transformava um blip de Wi-Fi em impressora parada
// até alguém reiniciar o serviço na mão. O poll periódico é independente do
// Realtime e continua reivindicando os jobs, então seguir rodando é seguro.
process.on('unhandledRejection', (reason) => {
  console.error('[SYSTEM] Promise rejeitada sem tratamento — worker segue rodando:', reason);
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
