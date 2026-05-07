import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.error("[add-items-to-order] Inicio da execucao");
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[add-items-to-order] Erro: Authorization header ausente");
      throw new Error('Usuário não autenticado. Envie o JWT no Authorization header.');
    }
    console.error(`[add-items-to-order] Authorization header presente. Valido? ${authHeader.startsWith('Bearer ') ? 'Sim (Bearer)' : 'Nao'}`);

    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    console.error("[add-items-to-order] Chamando supabaseClientAuth.auth.getUser()...");

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(token);
    if (userErr || !user) {
      console.error("[add-items-to-order] Erro no getUser:", userErr);
      throw new Error('Usuário não autenticado ou token inválido.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar profile e permissões
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
    const { order_id, items } = await req.json();
    console.error(`[add-items-to-order] Payload recebido: order_id=${order_id}, items_count=${items?.length}`);

    if (!order_id) throw new Error('ID do pedido (order_id) é obrigatório.');
    if (!items || items.length === 0) throw new Error('A lista de novos itens está vazia.');

    // 3. Buscar e validar pedido original
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, daily_number, status, payment_status, total_amount, type')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) throw new Error('Pedido não encontrado.');

    // Regras de bloqueio obrigatórias
    const allowedStatuses = ['NA_FILA', 'AGUARDANDO_PAGAMENTO'];
    if (!allowedStatuses.includes(order.status)) {
      throw new Error(`Não é possível adicionar itens a um pedido com status ${order.status}.`);
    }

    if (order.payment_status !== 'PENDING') {
      throw new Error(`Não é possível adicionar itens a um pedido que não esteja PENDENTE (Status atual: ${order.payment_status}).`);
    }

    // 4. Buscar configurações
    const { data: settingsData } = await supabaseAdmin.from('settings').select('key, value');
    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {};

    let additionalSubtotal = 0;
    const finalItemsData = [];

    // 5. Validar novos produtos/addons (Lógica reaproveitada da criação)
    for (const item of items) {
      if (item.quantity <= 0) throw new Error('Quantidade inválida para o produto.');

      const { data: product, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, name, price, sector, active')
        .eq('id', item.product_id)
        .single();

      if (prodErr || !product) throw new Error(`Produto inexistente (ID: ${item.product_id}).`);
      if (!product.active) throw new Error(`Produto ${product.name} não está ativo.`);

      let itemTotalPrice = Number(product.price) * item.quantity;
      let removedIngredientsSnapshots = [];
      let addonsSnapshots = [];

      // Validar removed_ingredients
      if (item.removed_ingredient_ids && item.removed_ingredient_ids.length > 0) {
        for (const ingId of item.removed_ingredient_ids) {
          const { data: prodIng, error: ingErr } = await supabaseAdmin
            .from('product_ingredients')
            .select('ingredients ( id, name )')
            .eq('product_id', product.id)
            .eq('ingredient_id', ingId)
            .single();

          if (ingErr || !prodIng || !prodIng.ingredients) {
            throw new Error(`Ingrediente removido inválido para o produto ${product.name}.`);
          }
          removedIngredientsSnapshots.push({
            ingredient_id: prodIng.ingredients.id,
            ingredient_name_snapshot: prodIng.ingredients.name
          });
        }
      }

      // Validar addons
      if (item.addons && item.addons.length > 0) {
        for (const add of item.addons) {
          const addonQty = add.quantity ?? 1;
          if (addonQty <= 0) throw new Error('Quantidade inválida de adicional.');
          
          const { data: addonDB, error: addErr } = await supabaseAdmin
            .from('addons')
            .select('id, name, price, active')
            .eq('id', add.addon_id)
            .single();

          if (addErr || !addonDB) throw new Error(`Adicional inexistente (ID: ${add.addon_id}).`);
          if (!addonDB.active) throw new Error(`Adicional ${addonDB.name} não está ativo.`);

          // Validar vínculo entre produto e adicional
          const { data: prodAddon, error: paErr } = await supabaseAdmin
            .from('product_addons')
            .select('product_id')
            .eq('product_id', product.id)
            .eq('addon_id', add.addon_id)
            .single();

          if (paErr || !prodAddon) {
            throw new Error(`O adicional "${addonDB.name}" não é permitido para o produto "${product.name}".`);
          }

          const addonTotal = Number(addonDB.price) * addonQty * item.quantity;
          itemTotalPrice += addonTotal;

          addonsSnapshots.push({
            addon_id: addonDB.id,
            quantity: addonQty,
            addon_name_snapshot: addonDB.name,
            addon_price_snapshot: addonDB.price
          });
        }
      }

      additionalSubtotal += itemTotalPrice;

      finalItemsData.push({
        product,
        quantity: item.quantity,
        notes: item.notes || null,
        itemTotalPrice,
        removedIngredientsSnapshots,
        addonsSnapshots
      });
    }

    // 6. Inserir Novos Itens
    const auditLogsToInsert = [];
    
    for (const itemData of finalItemsData) {
      const { data: oi, error: oiErr } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: itemData.product.id,
          product_name_snapshot: itemData.product.name,
          product_price_snapshot: itemData.product.price,
          production_sector: itemData.product.sector,
          quantity: itemData.quantity,
          observation: itemData.notes,
          total_price: itemData.itemTotalPrice
        })
        .select('id')
        .single();

      if (oiErr) throw new Error('Erro ao inserir item do pedido: ' + oiErr.message);

      if (itemData.removedIngredientsSnapshots.length > 0) {
        const rems = itemData.removedIngredientsSnapshots.map(r => ({
          order_item_id: oi.id, ...r
        }));
        await supabaseAdmin.from('order_item_removed_ingredients').insert(rems);
      }

      if (itemData.addonsSnapshots.length > 0) {
        const adds = itemData.addonsSnapshots.map(a => ({
          order_item_id: oi.id, ...a
        }));
        await supabaseAdmin.from('order_item_addons').insert(adds);
      }
    }

    // 7. Atualizar Total do Pedido (Apenas total_amount)
    const newTotal = Number(order.total_amount) + additionalSubtotal;
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({ total_amount: newTotal })
      .eq('id', order.id);

    if (updateErr) throw new Error('Erro ao atualizar total do pedido: ' + updateErr.message);

    auditLogsToInsert.push({ 
      action: 'ORDER_ITEMS_ADDED', 
      table_name: 'orders', 
      record_id: order.id, 
      user_id: user.id,
      details: { additional_amount: additionalSubtotal, new_total: newTotal }
    });

    // 8. Fila de Impressão (Apenas novos itens)
    const shouldPrintKitchen = settings['print_kitchen_copy'] === 'true';
    const shouldPrintJuice = settings['print_juice_potato_copy'] === 'true';

    const kitchenItems = finalItemsData.filter(i => i.product.sector === 'KITCHEN');
    const juicePotatoItems = finalItemsData.filter(i => i.product.sector === 'JUICE_POTATO');
    
    const printerJobsToInsert = [];
    const timestampNow = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const header = `MARCOS KREP'S\nADICIONAL DE COMANDA\nPEDIDO #${String(order.daily_number).padStart(3, '0')}\n`;

    if (kitchenItems.length > 0 && shouldPrintKitchen) {
      let content = header + `COZINHA / KREP\nHorário: ${timestampNow}\n------------------------\n`;
      for (const item of kitchenItems) {
        content += `${item.quantity}x ${item.product.name}\n`;
        if (item.removedIngredientsSnapshots.length > 0) {
           content += `  SEM: ${item.removedIngredientsSnapshots.map(r => r.ingredient_name_snapshot).join(', ')}\n`;
        }
        if (item.addonsSnapshots.length > 0) {
           content += `  COM: ${item.addonsSnapshots.map(a => `${a.quantity}x ${a.addon_name_snapshot}`).join(', ')}\n`;
        }
        if (item.notes) content += `  OBS: ${item.notes}\n`;
        content += `\n`;
      }
      content += `------------------------\n`;
      printerJobsToInsert.push({ order_id: order.id, sector: 'KITCHEN', content: { text: content } });
    }

    if (juicePotatoItems.length > 0 && shouldPrintJuice) {
      let content = header + `SUCOS / BATATA\nHorário: ${timestampNow}\n------------------------\n`;
      for (const item of juicePotatoItems) {
        content += `${item.quantity}x ${item.product.name}\n`;
        if (item.notes) content += `  OBS: ${item.notes}\n`;
        content += `\n`;
      }
      content += `------------------------\n`;
      printerJobsToInsert.push({ order_id: order.id, sector: 'JUICE_POTATO', content: { text: content } });
    }

    const createdJobsResponse = [];
    if (printerJobsToInsert.length > 0) {
       const { data: insertedJobs, error: jobsErr } = await supabaseAdmin
         .from('printer_jobs')
         .insert(printerJobsToInsert)
         .select('id, sector');
         
       if (!jobsErr) {
         createdJobsResponse.push(...insertedJobs.map(j => ({ type: j.sector, id: j.id })));
         for (const job of insertedJobs) {
            auditLogsToInsert.push({ action: 'PRINTER_JOB_CREATED', table_name: 'printer_jobs', record_id: job.id, user_id: user.id });
         }
       }
    }

    // 9. Registrar Auditoria
    await supabaseAdmin.from('audit_logs').insert(auditLogsToInsert);

    return new Response(JSON.stringify({ 
      success: true, 
      order: {
        id: order.id,
        total_amount: newTotal
      },
      printer_jobs: createdJobsResponse
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[add-items-to-order] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
