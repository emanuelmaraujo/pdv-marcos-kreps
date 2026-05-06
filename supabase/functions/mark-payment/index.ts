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
    console.error(`[mark-payment] Authorization header presente. Valido? ${authHeader.startsWith('Bearer ') ? 'Sim (Bearer)' : 'Nao'}`);

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) {
      console.error("[mark-payment] Erro no getUser(jwt):", userErr?.message);
      throw new Error('Usuário não autenticado ou token inválido.');
    }
    console.error(`[mark-payment] getUser() com sucesso. User ID: ${user.id}`);

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

    const { order_id, payment_method, payment_status, amount, notes } = await req.json();

    if (!order_id) throw new Error('order_id ausente ou inválido.');
    
    const validStatuses = ['PENDING', 'PAID', 'REFUNDED', 'CANCELED', 'COURTESY'];
    const validMethods = ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PENDING', 'COURTESY'];
    
    if (!validStatuses.includes(payment_status)) throw new Error('payment_status inválido.');
    if (!validMethods.includes(payment_method)) throw new Error('payment_method inválido.');

    // Busca o Pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, daily_number, status, total_amount, payment_status, payment_method, paid_at')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) throw new Error('Pedido inexistente.');

    if (order.status === 'CANCELADO' || order.status === 'EXPIRADO') {
      throw new Error('Não é possível alterar pagamento de pedido cancelado ou expirado.');
    }

    const nowIso = new Date().toISOString();
    let updatedPaymentStatus = payment_status;
    let updatedPaymentMethod = payment_method;
    let updatedPaidAt = null; 
    let auditAction = '';
    let insertPayment = false;
    let paymentRecordAmount = 0;

    if (payment_status === 'PAID') {
      // Amount deve ser igual ao total do pedido para fechar a conta exata (regra de negócio definida)
      // Se fosse permitir pagamento parcial, seria diferente.
      if (Number(amount) !== Number(order.total_amount)) {
        throw new Error(`O valor informado (R$ ${amount}) é diferente do total do pedido (R$ ${order.total_amount}).`);
      }
      updatedPaymentMethod = payment_method;
      updatedPaidAt = nowIso;
      insertPayment = true;
      paymentRecordAmount = order.total_amount;
      auditAction = 'PAYMENT_MARKED_PAID';

    } else if (payment_status === 'PENDING') {
      updatedPaymentMethod = 'PENDING';
      auditAction = 'PAYMENT_MARKED_PENDING';

    } else if (payment_status === 'COURTESY') {
      updatedPaymentMethod = 'COURTESY';
      updatedPaidAt = nowIso;
      insertPayment = true;
      paymentRecordAmount = order.total_amount; // Salva o quanto foi 'cedido' de cortesia
      auditAction = 'PAYMENT_MARKED_COURTESY';

    } else if (payment_status === 'REFUNDED') {
      if (profile.role !== 'ADMIN') {
        throw new Error('Apenas ADMIN pode estornar (REFUNDED) pagamentos.');
      }
      insertPayment = true;
      // Registra o estorno como negativo no histórico
      paymentRecordAmount = -Math.abs(Number(amount) || order.total_amount); 
      auditAction = 'PAYMENT_REFUNDED';

    } else if (payment_status === 'CANCELED') {
      if (order.status === 'ENTREGUE') {
         throw new Error('Não é possível cancelar o pagamento de um pedido ENTREGUE.');
      }
      auditAction = 'PAYMENT_CANCELED';
    }

    // 1. Atualizar Pedido
    const orderUpdatePayload: any = {
      payment_status: updatedPaymentStatus,
      payment_method: updatedPaymentMethod,
      updated_at: nowIso
    };

    if (payment_status === 'PAID' || payment_status === 'COURTESY') {
      orderUpdatePayload.paid_at = updatedPaidAt;
    } else if (payment_status === 'PENDING') {
      orderUpdatePayload.paid_at = null;
    }
    // No refund/cancel nós mantemos a data de quando ele foi originalmente pago, ou podemos limpar (depende da RN). Vamos apenas atualizar o status.

    const { error: updErr } = await supabaseAdmin
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', order.id);

    if (updErr) throw new Error('Erro ao atualizar status do pedido.');

    // 2. Criar registro de pagamento (Histórico detalhado do caixa)
    if (insertPayment) {
      const { error: payErr } = await supabaseAdmin
        .from('payments')
        .insert({
          order_id: order.id,
          amount: paymentRecordAmount,
          payment_method: updatedPaymentMethod,
          payment_status: updatedPaymentStatus,
          received_by: user.id,
          notes: notes || null
        });
      if (payErr) throw new Error('Erro ao registrar histórico financeiro.');
    }

    // 3. Registrar Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      action: auditAction,
      table_name: 'orders',
      record_id: order.id,
      user_id: user.id
    });

    return new Response(JSON.stringify({ 
      success: true, 
      order: {
        order_id: order.id,
        daily_number: order.daily_number,
        payment_status: updatedPaymentStatus,
        payment_method: updatedPaymentMethod,
        paid_at: orderUpdatePayload.paid_at !== undefined ? orderUpdatePayload.paid_at : order.paid_at
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[mark-payment] Failed to mark payment", {
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
