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
    console.error(`[reprint-order] Authorization header presente. Valido? ${authHeader.startsWith('Bearer ') ? 'Sim (Bearer)' : 'Nao'}`);

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) {
      console.error("[reprint-order] Erro no getUser(jwt):", userErr?.message);
      throw new Error('Usuário não autenticado ou token inválido.');
    }
    console.error(`[reprint-order] getUser() com sucesso. User ID: ${user.id}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar profile e regras
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

    // 2. Extrair payload
    let { order_id, copies } = await req.json();

    if (!order_id) throw new Error('order_id ausente ou inválido.');
    
    // Se "copies" estiver vazio ou ausente, a via do cliente é o default
    if (!copies || !Array.isArray(copies) || copies.length === 0) {
      copies = ['CUSTOMER'];
    }

    const validCopies = ['KITCHEN', 'JUICE_POTATO', 'CUSTOMER'];
    for (const c of copies) {
      if (!validCopies.includes(c)) throw new Error(`Tipo de via inválido: ${c}.`);
    }

    // 3. Buscar Pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, daily_number, type, customer_name, total_amount, packing_fee, discount_amount, payment_method, payment_status, created_at')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) throw new Error('Pedido inexistente.');

    // 4. Buscar Itens
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .select(`
        id, quantity, observation, product_name_snapshot, product_price_snapshot, total_price, production_sector,
        order_item_removed_ingredients ( ingredient_name_snapshot ),
        order_item_addons ( addon_name_snapshot, quantity, addon_price_snapshot )
      `)
      .eq('order_id', order.id);

    if (itemsErr || !items || items.length === 0) throw new Error('Pedido sem itens. Erro de integridade estrutural.');

    // 5. Separa itens pelos setores de produção
    const kitchenItems = items.filter(i => i.production_sector === 'KITCHEN');
    const juicePotatoItems = items.filter(i => i.production_sector === 'JUICE_POTATO');

    // Validações rigorosas de emissão coerente - Agora apenas filtra o que é possível
    if (copies.includes('KITCHEN') && kitchenItems.length === 0) {
       console.error("[reprint-order] Removendo via KITCHEN pois não há itens deste setor.");
       copies = copies.filter((c: string) => c !== 'KITCHEN');
    }
    if (copies.includes('JUICE_POTATO') && juicePotatoItems.length === 0) {
       console.error("[reprint-order] Removendo via JUICE_POTATO pois não há itens deste setor.");
       copies = copies.filter((c: string) => c !== 'JUICE_POTATO');
    }

    if (copies.length === 0) {
       throw new Error('Nenhuma via válida para impressão encontrada (ex: pedido sem itens de cozinha solicitado via cozinha).');
    }

    const printerJobsToInsert = [];
    const formatBRL = (val: number) => `R$ ${parseFloat(val as any).toFixed(2).replace('.', ',')}`;
    const timestampNow = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Montar via KITCHEN
    if (copies.includes('KITCHEN') && kitchenItems.length > 0) {
      let content = `*** REIMPRESSÃO ***\n`;
      content += `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;
      content += `COZINHA / KREP\n`;
      content += `Tipo: ${order.type}\n`;
      content += `Horário Reimpr: ${timestampNow}\n`;
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
      printerJobsToInsert.push({ order_id: order.id, sector: 'KITCHEN', content: { text: content } });
    }

    // Montar via JUICE_POTATO
    if (copies.includes('JUICE_POTATO') && juicePotatoItems.length > 0) {
      let content = `*** REIMPRESSÃO ***\n`;
      content += `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;
      content += `SUCOS / BATATA\n`;
      content += `Tipo: ${order.type}\n`;
      content += `Horário Reimpr: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of juicePotatoItems) {
        content += `${item.quantity}x ${item.product_name_snapshot}\n`;
        if (item.observation) {
           content += `  OBS: ${item.observation}\n`;
        }
        content += `\n`;
      }
      content += `------------------------\n`;
      printerJobsToInsert.push({ order_id: order.id, sector: 'JUICE_POTATO', content: { text: content } });
    }

    // Montar via CUSTOMER
    if (copies.includes('CUSTOMER')) {
      let content = `*** REIMPRESSÃO ***\n`;
      content += `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;
      content += `CLIENTE / SENHA\n`;
      content += `Tipo: ${order.type}\n`;
      if (order.customer_name) {
         content += `Cliente: ${order.customer_name}\n`;
      }
      content += `Horário Reimpr: ${timestampNow}\n`;
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

      printerJobsToInsert.push({ order_id: order.id, sector: 'CUSTOMER', content: { text: content } });
    }

    // 6. Insert Printer Jobs and Audit Logs
    const createdJobsResponse = [];
    if (printerJobsToInsert.length > 0) {
       const { data: insertedJobs, error: jobsErr } = await supabaseAdmin
         .from('printer_jobs')
         .insert(printerJobsToInsert)
         .select('id, sector');
         
       if (jobsErr) throw new Error('Erro ao gerar fila de reimpressão: ' + jobsErr.message);
       createdJobsResponse.push(...insertedJobs.map(j => ({ type: j.sector, id: j.id })));
       
       const auditLogsToInsert = [];
       for (const job of insertedJobs) {
          auditLogsToInsert.push({ 
             action: 'PRINTER_JOB_REPRINTED', 
             table_name: 'printer_jobs', 
             record_id: job.id, 
             user_id: user.id 
          });
       }
       if (auditLogsToInsert.length > 0) {
         await supabaseAdmin.from('audit_logs').insert(auditLogsToInsert);
       }
    }

    // 7. Retorno com SUCESSO
    return new Response(JSON.stringify({ 
      success: true, 
      printer_jobs: createdJobsResponse
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[reprint-order] Failed to reprint order", {
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
