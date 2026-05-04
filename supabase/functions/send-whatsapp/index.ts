import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remove non-numeric chars and ensure country code
function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null; // Invalid
  
  // se já começa com 55 e tem tamanho adequado
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  // Se parece ser BR mas sem DDI (10 ou 11 dígitos)
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
    // 1. Authenticate the caller (optional but recommended to accept only Admin or Webhook service role)
    // Here we will use Service Role to fetch and update
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // Accept both direct call { whatsapp_message_id } and Database Webhook { record: { id } }
    const whatsapp_message_id = body.whatsapp_message_id || body.record?.id;

    if (!whatsapp_message_id) {
      throw new Error('whatsapp_message_id é obrigatório. Envie { "whatsapp_message_id": "..." } ou configure o webhook para enviar o registro completo.');
    }

    // 2. Fetch message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('whatsapp_messages')
      .select(`
        id, 
        order_id, 
        phone, 
        status, 
        message_type,
        orders (
          daily_number,
          customer_name
        )
      `)
      .eq('id', whatsapp_message_id)
      .single();

    if (msgErr || !message) {
      throw new Error('Mensagem não encontrada.');
    }

    // 3. Idempotency Check
    if (message.status === 'SENT') {
      return new Response(JSON.stringify({ success: true, status: 'already_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (message.status !== 'PENDING') {
      throw new Error(`Mensagem não está PENDING. Status atual: ${message.status}`);
    }

    // 4. Validate and Format Phone
    const formattedPhone = normalizePhoneNumber(message.phone);
    if (!formattedPhone) {
      await updateMessageStatus(supabaseAdmin, message.id, 'FAILED', 'Número de telefone inválido ou muito curto.', null);
      throw new Error('Número de telefone inválido.');
    }

    // 5. Gather config and construct payload
    const WHATSAPP_CLOUD_TOKEN = Deno.env.get('WHATSAPP_CLOUD_TOKEN');
    const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');
    const TEMPLATE_NAME = Deno.env.get('WHATSAPP_TEMPLATE_NAME') || 'pedido_pronto_kreps';
    const TEMPLATE_LANG = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'pt_BR';

    if (!WHATSAPP_CLOUD_TOKEN || !WHATSAPP_PHONE_ID) {
      await updateMessageStatus(supabaseAdmin, message.id, 'FAILED', 'Variáveis de ambiente do WhatsApp não configuradas.', null);
      throw new Error('Configuração do WhatsApp ausente no servidor.');
    }

    const customerName = message.orders?.customer_name || 'Cliente';
    const dailyNumber = String(message.orders?.daily_number || '');

    const whatsappPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: {
          code: TEMPLATE_LANG
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: customerName
              },
              {
                type: "text",
                text: dailyNumber
              }
            ]
          }
        ]
      }
    };

    // 6. Send to WhatsApp API
    const response = await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_CLOUD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappPayload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorDetail = responseData.error?.message || JSON.stringify(responseData);
      await updateMessageStatus(supabaseAdmin, message.id, 'FAILED', errorDetail, null);
      throw new Error(`Falha na API do WhatsApp: ${errorDetail}`);
    }

    // 7. Success Update
    const providerMessageId = responseData.messages?.[0]?.id || 'unknown';
    await updateMessageStatus(supabaseAdmin, message.id, 'SENT', null, providerMessageId);

    return new Response(JSON.stringify({ 
      success: true, 
      status: 'SENT', 
      provider_message_id: providerMessageId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

async function updateMessageStatus(supabaseAdmin: any, id: string, status: string, errorMsg: string | null, providerId: string | null) {
  const payload: any = {
    status: status,
    updated_at: new Date().toISOString()
  };
  
  if (status === 'SENT') {
    payload.sent_at = new Date().toISOString();
  }
  
  if (errorMsg) {
    payload.error_message = errorMsg;
  }
  
  if (providerId) {
    payload.provider_message_id = providerId;
  }

  await supabaseAdmin
    .from('whatsapp_messages')
    .update(payload)
    .eq('id', id);
}
