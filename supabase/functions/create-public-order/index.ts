import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS pré-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Setup do Supabase Client com Service Role (Bypass RLS para o público poder criar pedido)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { items, customer_name, customer_phone, order_type, notes } = body;

    // 2. Validações Básicas (Fail Fast)
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Carrinho vazio.');
    }
    if (order_type !== 'BALCAO' && order_type !== 'VIAGEM') {
      throw new Error('order_type inválido. Use BALCAO ou VIAGEM.');
    }
    if (customer_phone && customer_phone.length < 8) {
       throw new Error('Telefone inválido.');
    }

    // 3. Busca Configurações (Taxa de Embalagem)
    const { data: settingsData, error: settingsErr } = await supabaseClient
      .from('settings')
      .select('key, value')
      .in('key', ['packaging_fee', 'apply_packaging_fee_for_takeaway']);
    
    if (settingsErr) throw new Error('Erro ao buscar configurações do sistema.');
    
    let packingFeeValue = 0;
    if (order_type === 'VIAGEM') {
      const applyFeeStr = settingsData?.find(s => s.key === 'apply_packaging_fee_for_takeaway')?.value;
      const applyFee = applyFeeStr === 'true' || applyFeeStr === true;
      if (applyFee) {
        const feeStr = settingsData?.find(s => s.key === 'packaging_fee')?.value;
        packingFeeValue = parseFloat(feeStr || '0');
      }
    }

    // 4. Pré-carregar Entidades para Validação e Precificação Real do Banco
    const productIds = items.map((i: any) => i.product_id);
    const { data: products, error: prodErr } = await supabaseClient
      .from('products')
      .select('id, name, price, active, product_ingredients(ingredient_id)')
      .in('id', productIds);
      
    if (prodErr) throw new Error('Erro ao buscar produtos.');
    
    const { data: productAddons, error: paErr } = await supabaseClient
      .from('product_addons')
      .select('product_id, addon_id')
      .in('product_id', productIds);
      
    if (paErr) throw new Error('Erro ao buscar vínculos de adicionais.');

    const allAddonIds = items.flatMap((i:any) => (i.addons || []).map((a:any) => a.addon_id));
    const { data: addons, error: addonErr } = await supabaseClient
      .from('addons')
      .select('id, name, price, active')
      .in('id', allAddonIds.length > 0 ? allAddonIds : ['00000000-0000-0000-0000-000000000000']);
      
    if (addonErr) throw new Error('Erro ao buscar addons.');

    const allRemovedIngIds = items.flatMap((i:any) => i.removed_ingredient_ids || []);
    const { data: ingredients, error: ingErr } = await supabaseClient
      .from('ingredients')
      .select('id, name, active')
      .in('id', allRemovedIngIds.length > 0 ? allRemovedIngIds : ['00000000-0000-0000-0000-000000000000']);
      
    if (ingErr) throw new Error('Erro ao buscar ingredientes.');

    // 5. Cálculos e Validação Profunda (Trust no Server, never in Client)
    let productsSubtotal = 0;
    let addonsTotal = 0;

    for (const item of items) {
      const product = products?.find(p => p.id === item.product_id);
      if (!product) throw new Error(`Produto inexistente: ${item.product_id}`);
      if (!product.active) throw new Error(`Produto inativo/esgotado: ${product.name}`);
      if (!item.quantity || item.quantity < 1) throw new Error(`Quantidade inválida para o produto: ${product.name}`);
      
      const itemSubtotal = parseFloat(product.price) * item.quantity;
      productsSubtotal += itemSubtotal;

      // Valida ingredientes removidos (só pode remover o que faz parte do produto)
      const productIngIds = (product.product_ingredients || []).map((pi:any) => pi.ingredient_id);
      for (const remId of (item.removed_ingredient_ids || [])) {
        const ingExists = ingredients?.find(i => i.id === remId);
        if (!ingExists) throw new Error(`Ingrediente a ser removido inexistente.`);
        if (!productIngIds.includes(remId)) {
          throw new Error(`Ingrediente removido inválido para o produto ${product.name}`);
        }
      }

      // Valida addons
      for (const itemAddon of (item.addons || [])) {
        const addon = addons?.find(a => a.id === itemAddon.addon_id);
        if (!addon) throw new Error(`Addon inexistente: ${itemAddon.addon_id}`);
        if (!addon.active) throw new Error(`Addon inativo: ${addon.name}`);
        
        // Valida se o adicional é permitido para este produto
        const isAllowed = productAddons?.some(pa => pa.product_id === product.id && pa.addon_id === itemAddon.addon_id);
        if (!isAllowed) {
          throw new Error(`O adicional "${addon.name}" não é permitido para o produto "${product.name}".`);
        }

        if (!itemAddon.quantity || itemAddon.quantity < 1) throw new Error(`Quantidade inválida para o addon: ${addon.name}`);
        
        // Multiplica o valor do addon pela qtd dele E pela qtd do produto na linha
        addonsTotal += parseFloat(addon.price) * itemAddon.quantity * item.quantity;
      }
    }

    const totalAmount = productsSubtotal + addonsTotal + packingFeeValue;

    // 6. Inserir Pedido
    // IMPORTANTE: Não enviamos 'daily_number', o trigger set_daily_order_number cuidará de usar o get_next_daily_order_number
    const { data: order, error: orderErr } = await supabaseClient
      .from('orders')
      .insert({
        type: order_type,
        source: 'QR_CODE',
        status: 'AGUARDANDO_CONFIRMACAO',
        payment_status: 'PENDING',
        customer_name,
        customer_phone,
        packing_fee: packingFeeValue,
        total_amount: totalAmount,
        notes: notes 
      })
      .select('id, daily_number, public_token, total_amount, status')
      .single();

    if (orderErr) throw new Error('Erro ao criar pedido: ' + orderErr.message);

    // 7. Inserir Itens do Pedido e Seus Filhos (Addons e Removidos)
    for (const item of items) {
      const product = products?.find(p => p.id === item.product_id);
      
      // Calcula total unitário da linha (Produto * Qtd) + (Soma(Addons * Qtd Addon) * Qtd Produto)
      let itemTotalPrice = (parseFloat(product.price) * item.quantity);
      let itemAddonsTotal = 0;
      for (const itemAddon of (item.addons || [])) {
         const addon = addons?.find(a => a.id === itemAddon.addon_id);
         itemAddonsTotal += parseFloat(addon.price) * itemAddon.quantity * item.quantity;
      }
      itemTotalPrice += itemAddonsTotal;

      const { data: orderItem, error: oiErr } = await supabaseClient
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: product.id,
          product_name_snapshot: product.name,
          product_price_snapshot: product.price,
          production_sector: product.sector,
          quantity: item.quantity,
          observation: item.notes,
          total_price: itemTotalPrice
        })
        .select('id')
        .single();
        
      if (oiErr) throw new Error('Erro ao inserir item do pedido: ' + oiErr.message);

      // Inserir ingredientes removidos do item
      if (item.removed_ingredient_ids && item.removed_ingredient_ids.length > 0) {
        const removedInserts = item.removed_ingredient_ids.map((remId: string) => {
          const ing = ingredients?.find(i => i.id === remId);
          return {
            order_item_id: orderItem.id,
            ingredient_id: remId,
            ingredient_name_snapshot: ing.name
          };
        });
        await supabaseClient.from('order_item_removed_ingredients').insert(removedInserts);
      }

      // Inserir addons do item
      if (item.addons && item.addons.length > 0) {
        const addonsInserts = item.addons.map((a: any) => {
          const addon = addons?.find(ad => ad.id === a.addon_id);
          return {
            order_item_id: orderItem.id,
            addon_id: addon.id,
            quantity: a.quantity,
            addon_name_snapshot: addon.name,
            addon_price_snapshot: addon.price
          };
        });
        await supabaseClient.from('order_item_addons').insert(addonsInserts);
      }
    }

    // 8. Trilha de Auditoria
    await supabaseClient.from('audit_logs').insert({
      action: 'ORDER_CREATED',
      table_name: 'orders',
      record_id: order.id,
      new_data: order
    });

    // 9. Retorno de Sucesso para o Cliente
    return new Response(JSON.stringify({ 
      success: true, 
      order: {
        order_id: order.id,
        daily_number: order.daily_number,
        public_token: order.public_token,
        total: order.total_amount,
        status: order.status
      } 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });

  } catch (error: any) {
    // Retorno amigável do erro para o cliente
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
