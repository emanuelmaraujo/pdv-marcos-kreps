import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Utilizamos a chave SERVICE_ROLE_KEY para que o worker tenha poder administrativo 
// e consiga atualizar o status das tabelas com segurança (sem depender do RLS local).
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
