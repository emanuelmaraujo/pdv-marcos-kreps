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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Usuário não autenticado. Envie o JWT no Authorization header.');
    console.error(`[update-order-status] Authorization header presente. Valido? ${authHeader.startsWith('Bearer ') ? 'Sim (Bearer)' : 'Nao'}`);

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) {
      console.error("[update-order-status] Erro no getUser(jwt):", userErr?.message);
      throw new Error('Usuário não autenticado ou token inválido.');
    }
    console.error(`[update-order-status] getUser() com sucesso. User ID: ${user.id}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) throw new Error('Usuário sem profile.');
    if (!profile.active) throw new Error('Usuário inativo.');
    if (profile.role !== 'ADMIN' && profile.role !== 'ATTENDANT') {
      throw new Error('Role não autorizada. Apenas ADMIN ou ATTENDANT.');
    }

    const { order_id, status, reason, force_delivery } = await req.json();

    if (!order_id) throw new Error('order_id ausente ou inválido.');
    
    // De acordo com as instruções, estes são os status permitidos pela função
    const validStatuses = ['NA_FILA', 'PRONTO', 'ENTREGUE', 'CANCELADO'];
    if (!validStatuses.includes(status)) {
       throw new Error(`status inválido. Permitidos: ${validStatuses.join(', ')}`);
    }

    // Busca o Pedido atual
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, daily_number, status, payment_status, customer_phone')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) throw new Error('Pedido inexistente.');

    // Regras de Transição Rígidas
    const currentStatus = order.status;

    if (currentStatus === 'ENTREGUE') throw new Error('Pedido já ENTREGUE não pode ter seu status alterado.');
    if (currentStatus === 'CANCELADO') throw new Error('Pedido já CANCELADO não pode ter seu status alterado.');
    if (currentStatus === 'EXPIRADO') throw new Error('Pedido EXPIRADO não pode ter seu status alterado.');

    // Tabela de transições permitidas
    let transitionAllowed = false;

    if (status === 'CANCELADO') {
      if (['AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'NA_FILA', 'PRONTO'].includes(currentStatus)) {
        transitionAllowed = true;
      }
    } else if (status === 'PRONTO') {
      if (currentStatus === 'NA_FILA') transitionAllowed = true;
    } else if (status === 'ENTREGUE') {
      if (currentStatus === 'PRONTO') transitionAllowed = true;
    } else if (status === 'NA_FILA') {
      // Como não listado nas transições, bloqueamos ou usamos apenas para admin bypass?
      // "Transições permitidas: ... AGUARDANDO_CONFIRMACAO -> CANCELADO, etc."
      // NA_FILA -> PRONTO... mas não há transição para NA_FILA aqui.
      throw new Error(`Transição inválida de ${currentStatus} para ${status}.`);
    }

    if (!transitionAllowed) {
      throw new Error(`Transição de status inválida de ${currentStatus} para ${status}.`);
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: status,
      updated_at: nowIso
    };

    let auditAction = '';

    // Lógica por Status
    if (status === 'PRONTO') {
      updatePayload.ready_at = nowIso;
      auditAction = 'ORDER_READY';

      // Fila do WhatsApp
      if (order.customer_phone && order.customer_phone.length >= 8) {
         await supabaseAdmin.from('whatsapp_messages').insert({
            order_id: order.id,
            phone: order.customer_phone,
            message_type: 'order_ready',
            status: 'PENDING'
         });
      }

    } else if (status === 'ENTREGUE') {
      if (order.payment_status === 'PENDING') {
         if (force_delivery === true && profile.role === 'ADMIN') {
            // ADMIN force pass
         } else {
            throw new Error('Pedido com pagamento pendente. Confirme o pagamento antes de entregar.');
         }
      }
      updatePayload.delivered_at = nowIso;
      auditAction = 'ORDER_DELIVERED';

    } else if (status === 'CANCELADO') {
      if (!reason || reason.trim() === '') {
         throw new Error('É obrigatório informar um motivo (reason) para cancelar o pedido.');
      }
      // O motivo pode ir no notes ou discount_reason? A tabela não tem `cancel_reason`.
      // Vamos salvar no `notes` como "Cancelado por: reason" apenas pra manter o histórico.
      // O audit_log pode conter o reason.
      updatePayload.cancelled_at = nowIso;
      updatePayload.cancelled_by = user.id;
      // updatePayload.notes = reason; // Se preferir. Mas a instrução não cita onde salvar, o Audit_log salvará.
      auditAction = 'ORDER_CANCELLED';
    }

    // 1. Atualizar o Pedido no Banco
    const { error: updErr } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updErr) throw new Error('Erro ao atualizar status do pedido.');

    // 2. Registrar Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      action: auditAction,
      table_name: 'orders',
      record_id: order.id,
      user_id: user.id,
      new_data: { status, reason, force_delivery }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      order: {
        order_id: order.id,
        daily_number: order.daily_number,
        status: status,
        ready_at: updatePayload.ready_at,
        delivered_at: updatePayload.delivered_at,
        cancelled_at: updatePayload.cancelled_at
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[update-order-status] Failed to update status", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
