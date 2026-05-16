/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildCustomerReceipt, buildProductionReceipt, settingBool } from "../_shared/print-format.ts";
import { enqueueWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Para confirmar, precisamos do Auth JWT do usuário interno enviando a request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Usuário não autenticado. Envie o JWT no Authorization header.');
    console.error(`[confirm-order] Authorization header presente. Valido? ${authHeader.startsWith('Bearer ') ? 'Sim (Bearer)' : 'Nao'}`);

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) {
      console.error("[confirm-order] Erro no getUser(jwt):", userErr?.message);
      throw new Error('Usuário não autenticado ou token inválido.');
    }
    console.error(`[confirm-order] getUser() com sucesso. User ID: ${user.id}`);

    // 2. Criamos o client Admin para bypass do RLS ao ler profiles e gravar as ordens
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Valida Perfil e Role
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) throw new Error('Usuário sem profile. Contate o administrador.');
    if (!profile.active) throw new Error('Usuário inativo.');
    if (profile.role !== 'ADMIN' && profile.role !== 'ATTENDANT') {
      throw new Error('Role não autorizada. Apenas ADMIN e ATTENDANT podem confirmar pedidos.');
    }

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id não fornecido no payload.');

    // 3. Busca o Pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, daily_number, status, type, customer_name, customer_phone, notes, total_amount, packing_fee, discount_amount, payment_method, payment_status, created_at, branch_id, branches ( code, name )')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) throw new Error('Pedido inexistente.');

    // Regras de negócio do status
    if (order.status === 'CANCELADO') throw new Error('Pedido cancelado.');
    if (order.status === 'EXPIRADO') throw new Error('Pedido expirado.');
    if (order.status !== 'AGUARDANDO_CONFIRMACAO' && order.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new Error('Pedido já confirmado ou em estado inválido para confirmação (já está na fila, pronto, etc).');
    }

    // Busca os Itens do Pedido com suas correlações
    if (order.status === 'AGUARDANDO_PAGAMENTO' && order.payment_status !== 'PAID') {
      throw new Error('Pedido aguardando pagamento nao pode ser enviado para a cozinha antes da aprovacao.');
    }

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .select(`
        id, quantity, observation, product_name_snapshot, product_price_snapshot, total_price, production_sector,
        order_item_removed_ingredients ( ingredient_name_snapshot ),
        order_item_addons ( addon_name_snapshot, quantity, addon_price_snapshot )
      `)
      .eq('order_id', order.id);

    if (itemsErr || !items || items.length === 0) throw new Error('Pedido sem itens. Impossível confirmar.');

    // Checa se já não existem printer_jobs (para evitar duplicação em caso de retry malicioso/acidental)
    const { data: existingJobs } = await supabaseAdmin
      .from('printer_jobs')
      .select('id')
      .eq('order_id', order.id);
      
    if (existingJobs && existingJobs.length > 0) {
       throw new Error('Já existem jobs de impressão para este pedido. Ele já deve ter sido enviado para a cozinha.');
    }

    // Busca as Configurações de Impressão globais
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['printing_enabled', 'print_customer_copy', 'print_kitchen_copy', 'print_juice_potato_copy']);
    
    const printingEnabled = settingBool(settings?.find(s => s.key === 'printing_enabled')?.value, true);
    const shouldPrintCustomer = printingEnabled && settingBool(settings?.find(s => s.key === 'print_customer_copy')?.value);
    const shouldPrintKitchen = printingEnabled && settingBool(settings?.find(s => s.key === 'print_kitchen_copy')?.value);
    const shouldPrintJuice = printingEnabled && settingBool(settings?.find(s => s.key === 'print_juice_potato_copy')?.value);

    // 4. Separa os itens por setor
    const kitchenItems = items.filter(i => i.production_sector === 'KITCHEN');
    const juicePotatoItems = items.filter(i => i.production_sector === 'JUICE_POTATO');

    const printerJobsToInsert = [];
    const createdJobsResponse = [];
    const timestampNow = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const formatBRL = (val: number) => `R$ ${parseFloat(val as any).toFixed(2).replace('.', ',')}`;
    const branchCode: string | undefined = (order as any).branches?.code;
    const branchName: string | undefined = (order as any).branches?.name;
    const receiptOpts = { timestamp: timestampNow, branchCode, branchName } as const;

    // --- Monta Via KITCHEN (Apenas se houver item KITCHEN e settings permitir) ---
    if (kitchenItems.length > 0 && shouldPrintKitchen) {
      let content = `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;
      content += `KREPS\n`;
      content += `Tipo: ${order.type}\n`;
      content += `Horário: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of kitchenItems) {
        content += `${item.quantity}x ${item.product_name_snapshot}\n`;
        if (item.order_item_removed_ingredients.length > 0) {
           content += `  SEM: ${item.order_item_removed_ingredients.map(r => r.ingredient_name_snapshot).join(', ')}\n`;
        }
        if (item.order_item_addons.length > 0) {
           content += `  COM: ${item.order_item_addons.map(a => `${a.quantity}x ${a.addon_name_snapshot}`).join(', ')}\n`;
        }
        if (item.observation) {
           content += `  OBS: ${item.observation}\n`;
        }
        content += `\n`;
      }
      content += `------------------------\n`;

      content = buildProductionReceipt(order, items, 'KITCHEN', {
        ...receiptOpts,
        title: 'KREPS',
      });
      printerJobsToInsert.push({ order_id: order.id, branch_id: order.branch_id, sector: 'KITCHEN', content: { text: content } });
    }

    // --- Monta Via JUICE_POTATO (Apenas se houver item de Bebida/Batata) ---
    if (juicePotatoItems.length > 0 && shouldPrintJuice) {
      let content = `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;
      content += `COZINHA\n`;
      content += `Tipo: ${order.type}\n`;
      content += `Horário: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of juicePotatoItems) {
        content += `${item.quantity}x ${item.product_name_snapshot}\n`;
        if (item.observation) {
           content += `  OBS: ${item.observation}\n`;
        }
        content += `\n`;
      }
      content += `------------------------\n`;

      content = buildProductionReceipt(order, items, 'JUICE_POTATO', {
        ...receiptOpts,
        title: 'COZINHA',
      });
      printerJobsToInsert.push({ order_id: order.id, branch_id: order.branch_id, sector: 'JUICE_POTATO', content: { text: content } });
    }

    // --- Monta Via CUSTOMER (Para todos os setores) ---
    if (shouldPrintCustomer) {
      let content = `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;
      content += `CLIENTE / SENHA\n`;
      content += `Tipo: ${order.type}\n`;
      if (order.customer_name) {
         content += `Cliente: ${order.customer_name}\n`;
      }
      content += `Horário: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of items) {
        content += `${item.quantity}x ${item.product_name_snapshot} - ${formatBRL(item.product_price_snapshot)}\n`;
        if (item.order_item_addons.length > 0) {
           for(const add of item.order_item_addons) {
              content += `  + ${add.quantity}x ${add.addon_name_snapshot} - ${formatBRL(add.addon_price_snapshot)}\n`;
           }
        }
      }
      content += `------------------------\n`;
      if (order.discount_amount > 0) content += `Desconto: -${formatBRL(order.discount_amount)}\n`;
      if (order.packing_fee > 0) content += `Taxa Embalagem: ${formatBRL(order.packing_fee)}\n`;
      content += `TOTAL: ${formatBRL(order.total_amount)}\n`;
      content += `Status Pagamento: ${order.payment_status}\n`;
      if (order.payment_method !== 'PENDING') content += `Forma: ${order.payment_method}\n`;
      content += `------------------------\n`;
      content += `Guarde este número para retirada.\n`;

      content = buildCustomerReceipt(order, items, receiptOpts);
      printerJobsToInsert.push({ order_id: order.id, branch_id: order.branch_id, sector: 'CUSTOMER', content: { text: content } });
    }

    // 5. Inserir os printer_jobs se a array não estiver vazia
    if (printerJobsToInsert.length > 0) {
       const { data: insertedJobs, error: jobsErr } = await supabaseAdmin
         .from('printer_jobs')
         .insert(printerJobsToInsert)
         .select('id, sector');
         
       if (jobsErr) throw new Error('Erro ao gerar fila de impressão: ' + jobsErr.message);
       createdJobsResponse.push(...insertedJobs.map(j => ({ type: j.sector, id: j.id })));
       
       // Log da fila
       for (const job of insertedJobs) {
          await supabaseAdmin.from('audit_logs').insert({
            action: 'PRINTER_JOB_CREATED',
            table_name: 'printer_jobs',
            record_id: job.id,
            user_id: user.id
          });
       }
    }

    // 6. Atualiza o Status do Pedido para NA_FILA
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from('orders')
      .update({
         status: 'NA_FILA',
         confirmed_by: user.id,
         confirmed_at: nowIso,
         queue_entered_at: nowIso,
         updated_at: nowIso
      })
      .eq('id', order.id);

    if (updErr) throw new Error('Erro ao atualizar status do pedido.');

    // Audit Log da Confirmação do Status
    await supabaseAdmin.from('audit_logs').insert({
      action: 'ORDER_CONFIRMED',
      table_name: 'orders',
      record_id: order.id,
      user_id: user.id
    });

    // WhatsApp: notify "novo_pedido" once order enters production (non-blocking)
    await enqueueWhatsAppMessage(supabaseAdmin, {
      orderId: order.id,
      branchId: order.branch_id,
      eventType: 'order_received',
      phone: order.customer_phone,
      customerName: order.customer_name,
      dailyNumber: order.daily_number,
      branchCode: branchCode ?? null,
      branchName: branchName ?? null,
    });

    // 7. Retorno com sucesso
    return new Response(JSON.stringify({ 
      success: true, 
      order: {
        order_id: order.id,
        daily_number: order.daily_number,
        status: 'NA_FILA'
      },
      printer_jobs: createdJobsResponse
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
