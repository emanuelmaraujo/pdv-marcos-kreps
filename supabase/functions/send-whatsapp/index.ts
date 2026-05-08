import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppPayload {
  action?: 'process_queue' | 'send_test';
  whatsapp_message_id?: string;
  phone?: string;
  template_name?: string;
}

// Remove non-numeric chars and ensure country code
function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authorization: Ensure only Admin can call this
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado.');
    
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Sessão expirada.');

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'ADMIN') throw new Error('Apenas administradores podem processar o WhatsApp.');

    const body: WhatsAppPayload = await req.json();
    const action = body.action || (body.whatsapp_message_id ? 'single' : 'process_queue');

    // Secrets
    const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const VERSION = Deno.env.get('WHATSAPP_API_VERSION') || 'v19.0';
    
    if (!ACCESS_TOKEN || !PHONE_ID) {
      throw new Error('Configuração do WhatsApp (Secrets) ausente no Supabase.');
    }

    if (action === 'send_test') {
      const phone = normalizePhoneNumber(body.phone || '');
      if (!phone) throw new Error('Telefone de teste inválido.');
      
      const template = body.template_name || Deno.env.get('WHATSAPP_DEFAULT_TEMPLATE_READY') || 'hello_world';
      
      // For test, we create a record first to track it
      const { data: testMsg, error: testErr } = await supabaseAdmin.from('whatsapp_messages').insert({
        phone,
        template_name: template,
        status: 'PENDING',
        payload: { customer_name: 'Teste Admin', daily_number: 999 }
      }).select().single();

      if (testErr) throw new Error('Erro ao criar registro de teste.');
      
      const result = await sendWhatsAppMessage(supabaseAdmin, testMsg, ACCESS_TOKEN, PHONE_ID, VERSION);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'process_queue') {
      // Fetch up to 10 PENDING messages
      const { data: queue, error: qErr } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(10);

      if (qErr) throw new Error('Erro ao buscar fila.');
      if (!queue || queue.length === 0) {
        return new Response(JSON.stringify({ success: true, processed: 0, message: 'Fila vazia.' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const results = [];
      for (const msg of queue) {
        results.push(await sendWhatsAppMessage(supabaseAdmin, msg, ACCESS_TOKEN, PHONE_ID, VERSION));
      }

      return new Response(JSON.stringify({ success: true, processed: queue.length, results }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Default: Single message processing
    const msgId = body.whatsapp_message_id;
    if (!msgId) throw new Error('Ação inválida ou whatsapp_message_id ausente.');

    const { data: message } = await supabaseAdmin.from('whatsapp_messages').select('*').eq('id', msgId).single();
    if (!message) throw new Error('Mensagem não encontrada.');

    const result = await sendWhatsAppMessage(supabaseAdmin, message, ACCESS_TOKEN, PHONE_ID, VERSION);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 to handle error in UI gracefully
    });
  }
});

async function sendWhatsAppMessage(supabaseAdmin: any, msg: any, token: string, phoneId: string, version: string) {
  try {
    const phone = normalizePhoneNumber(msg.phone);
    if (!phone) {
      await updateStatus(supabaseAdmin, msg.id, 'FAILED', 'Telefone inválido.', msg.attempts);
      return { id: msg.id, success: false, error: 'Telefone inválido' };
    }

    const templateName = msg.template_name || Deno.env.get('WHATSAPP_DEFAULT_TEMPLATE_READY') || 'hello_world';
    const payload = msg.payload || {};
    
    // Construct components based on standard template (2 variables: Name and Number)
    const components = [];
    if (payload.customer_name || payload.daily_number) {
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: String(payload.customer_name || 'Cliente') },
          { type: "text", text: String(payload.daily_number || '') }
        ]
      });
    }

    const waPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || "pt_BR" },
        components: components.length > 0 ? components : undefined
      }
    };

    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || JSON.stringify(data);
      await updateStatus(supabaseAdmin, msg.id, 'FAILED', errorMsg, msg.attempts);
      return { id: msg.id, success: false, error: errorMsg };
    }

    const providerId = data.messages?.[0]?.id || 'ok';
    await updateStatus(supabaseAdmin, msg.id, 'SENT', null, msg.attempts, providerId);
    return { id: msg.id, success: true, provider_id: providerId };

  } catch (e: any) {
    await updateStatus(supabaseAdmin, msg.id, 'FAILED', e.message, msg.attempts);
    return { id: msg.id, success: false, error: e.message };
  }
}

async function updateStatus(supabaseAdmin: any, id: string, status: string, errorMsg: string | null, currentAttempts: number, providerId?: string) {
  const update: any = {
    status,
    attempts: (currentAttempts || 0) + 1,
    last_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (status === 'SENT') {
    update.sent_at = new Date().toISOString();
    if (providerId) update.provider_message_id = providerId;
  }
  
  if (errorMsg) {
    update.error_message = errorMsg;
  }

  await supabaseAdmin.from('whatsapp_messages').update(update).eq('id', id);
}
