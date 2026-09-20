import os from 'os';
import { supabase } from './supabase';
import { getRemoteConfig } from './jobs';

// O Realtime é a via principal do worker. O heartbeat existe apenas para
// indicar saúde no painel; 15s gerava milhares de writes desnecessários por dia.
const HEARTBEAT_INTERVAL_MS = 60_000;

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
  ].map((row) => ({ ...row, updated_at: now }));

  const { error } = await supabase.from('settings').upsert(rows);
  if (error) {
    console.warn('[STATUS] Nao foi possivel atualizar metadados do Raspberry:', error.message);
  }
}

async function reportWorkerHeartbeat() {
  const now = new Date().toISOString();

  // Apenas os campos realmente dinâmicos mudam a cada batida.
  const { error } = await supabase.from('settings').upsert([
    { key: 'print_worker_status', value: 'ACTIVE', updated_at: now },
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
