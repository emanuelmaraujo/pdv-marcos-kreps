import dotenv from 'dotenv';
dotenv.config();

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  printerType: process.env.PRINTER_TYPE || 'network',
  printerHost: process.env.PRINTER_HOST || '192.168.0.50',
  printerPort: parseInt(process.env.PRINTER_PORT || '9100', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10)
};

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
