import os from 'os';
import { supabase } from './supabase';
import { getRemoteConfig } from './jobs';

// O Realtime é a via principal do worker. O heartbeat só serve para indicar
// saúde no painel e não precisa gravar no banco a cada minuto.
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

function localIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry): entry is os.NetworkInterfaceInfo => entry !== undefined && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

async function reportWorkerMetadata() {
  const now = new Date().toISOString();
  const remoteConfig = await getRemoteConfig();

  const rows = [
    { key: 'print_worker_hostname', value: os.hostname() },
    { key: 'print_worker_ip', value: localIps().join(', ') },
    { key: 'print_worker_platform', value: `${process.platform} ${process.arch}` },
    { key: 'print_worker_printer_host', value: remoteConfig.printerHost },
    { key: 'print_worker_printer_port', value: remoteConfig.printerPort },
    { key: 'print_worker_status', value: 'ACTIVE' },
  ].map((row) => ({ ...row, updated_at: now }));

  const { error } = await supabase.from('settings').upsert(rows);
  if (error) {
    console.warn('[STATUS] Nao foi possivel atualizar metadados do Raspberry:', error.message);
  }
}

async function reportWorkerHeartbeat() {
  const now = new Date().toISOString();

  // Status e metadados são gravados no startup. Durante a execução,
  // somente o last_seen realmente muda.
  const { error } = await supabase.from('settings').upsert([
    { key: 'print_worker_last_seen_at', value: now, updated_at: now },
  ]);

  if (error) {
    console.warn('[STATUS] Nao foi possivel atualizar heartbeat do Raspberry:', error.message);
  }
}

export function startWorkerHeartbeat() {
  void reportWorkerMetadata();
  void reportWorkerHeartbeat();

  setInterval(() => {
    void reportWorkerHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}
