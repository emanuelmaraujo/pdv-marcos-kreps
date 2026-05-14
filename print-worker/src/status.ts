import os from 'os';
import { supabase } from './supabase';
import { getRemoteConfig } from './jobs';

const HEARTBEAT_INTERVAL_MS = 15000;

function localIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry): entry is os.NetworkInterfaceInfo => entry !== undefined && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

async function reportWorkerHeartbeat() {
  const now = new Date().toISOString();
  const remoteConfig = await getRemoteConfig();

  const rows = [
    { key: 'print_worker_status', value: 'ACTIVE' },
    { key: 'print_worker_last_seen_at', value: now },
    { key: 'print_worker_hostname', value: os.hostname() },
    { key: 'print_worker_ip', value: localIps().join(', ') },
    { key: 'print_worker_platform', value: `${process.platform} ${process.arch}` },
    { key: 'print_worker_printer_host', value: remoteConfig.printerHost },
    { key: 'print_worker_printer_port', value: remoteConfig.printerPort },
  ].map((row) => ({ ...row, updated_at: now }));

  const { error } = await supabase.from('settings').upsert(rows);
  if (error) {
    console.warn('[STATUS] Nao foi possivel atualizar heartbeat do Raspberry:', error.message);
  }
}

export function startWorkerHeartbeat() {
  void reportWorkerHeartbeat();
  setInterval(() => {
    void reportWorkerHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}
