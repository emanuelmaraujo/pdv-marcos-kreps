import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header missing');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) throw new Error('Usuario nao autenticado.');

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) throw new Error('Perfil nao encontrado.');
    if (profile.role !== 'ADMIN') throw new Error('Acesso negado. Apenas administradores podem testar a impressora.');
    if (!profile.active) throw new Error('Usuario inativo.');

    const { data: latestOrder, error: latestOrderErr } = await supabaseAdmin
      .from('orders')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestOrderErr || !latestOrder) {
      throw new Error('Nenhum pedido encontrado para vincular ao teste de impressao.');
    }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const testContent = `TESTE DE IMPRESSAO\n` +
      `PDV Marcos Krep's\n\n` +
      `Se voce esta vendo este papel,\n` +
      `a impressora esta configurada corretamente.\n\n` +
      `Data/hora: ${timestamp}\n` +
      `------------------------\n`;

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('printer_jobs')
      .insert({
        order_id: latestOrder.id,
        sector: 'TEST',
        status: 'PENDING',
        content: { text: testContent }
      })
      .select('id')
      .single();

    if (jobErr) throw new Error('Erro ao gerar job de teste: ' + jobErr.message);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'PRINTER_TEST_REQUESTED',
      table_name: 'printer_jobs',
      record_id: job.id
    });

    return new Response(JSON.stringify({ success: true, jobId: job.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("[test-printer] Erro:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
