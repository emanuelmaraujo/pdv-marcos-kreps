import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildCustomerReceipt, buildProductionReceipt, settingBool, settingNumber } from "../_shared/print-format.ts";
import { enqueueWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone BR para E.164 canonico ("+55DDDNNNNNNNN[N]"). Retorna null se invalido.
function normalizeBrazilPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return `+55${digits}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.error("[create-attendant-order] Inicio da execucao");
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[create-attendant-order] Erro: Authorization header ausente");
      throw new Error('Usuário não autenticado. Envie o JWT no Authorization header.');
    }
    console.error(`[create-attendant-order] Authorization header presente. Valido? ${authHeader.startsWith('Bearer ') ? 'Sim (Bearer)' : 'Nao'}`);

    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    console.error("[create-attendant-order] Chamando supabaseClientAuth.auth.getUser()...");
    let { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser();
    
    if (userErr || !user) {
      console.error("[create-attendant-order] Erro no getUser():", userErr?.message || "User null");
      console.error("[create-attendant-order] Detalhes do erro Auth:", JSON.stringify(userErr));
      
      // Attempt alternative method if getUser fails due to missing session
      if (userErr?.message?.includes("session missing")) {
         console.error("[create-attendant-order] Tentando fallback getUser(jwt)...");
         const jwt = authHeader.replace('Bearer ', '');
         const { data: fallbackData, error: fallbackErr } = await supabaseClientAuth.auth.getUser(jwt);
         if (fallbackErr || !fallbackData.user) {
            console.error("[create-attendant-order] Fallback getUser(jwt) tambem falhou:", fallbackErr?.message);
            throw new Error('Usuário não autenticado ou token inválido (fallback). Detalhes: ' + JSON.stringify(fallbackErr));
         } else {
            console.error("[create-attendant-order] Fallback getUser(jwt) teve SUCESSO. User ID:", fallbackData.user.id);
            // Re-assign user for the rest of the flow
            user = fallbackData.user;
         }
      } else {
         throw new Error('Usuário não autenticado ou token inválido. Detalhes: ' + JSON.stringify(userErr));
      }
    } else {
      console.error("[create-attendant-order] getUser() com sucesso via headers globais. User ID:", user.id);
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
    const {
      order_type, customer_name, customer_phone, notes,
      payment_method, payment_status, discount, items,
      remember_checkout_data,
      branch_id,
      split_bill,
    } = await req.json();

    // split_bill: cria em AGUARDANDO_PAGAMENTO e pula impressão
    // A impressão acontece automaticamente em mark-payment quando tudo for pago
    const isSplitBill = split_bill === true;

    if (!items || items.length === 0) throw new Error('O carrinho está vazio.');
    if (!branch_id) throw new Error('branch_id é obrigatório.');

    // Valida que o atendente pode operar essa filial (RLS via JWT).
    const { data: branch, error: branchErr } = await supabaseClientAuth
      .from('branches')
      .select('id, code, name, active')
      .eq('id', branch_id)
      .single();
    if (branchErr || !branch) throw new Error('Filial inválida ou usuário sem permissão.');
    if (!branch.active) throw new Error('Filial inativa.');
    if (order_type !== 'BALCAO' && order_type !== 'VIAGEM') throw new Error('order_type inválido (BALCAO ou VIAGEM).');

    const validPayMethods = ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PENDING', 'COURTESY'];
    const validPayStatuses = ['PENDING', 'PAID', 'COURTESY'];

    if (!validPayMethods.includes(payment_method)) throw new Error('payment_method inválido.');
    if (!validPayStatuses.includes(payment_status)) throw new Error('payment_status inválido.');

    if (payment_status === 'COURTESY' && payment_method !== 'COURTESY') {
       throw new Error('payment_method deve ser COURTESY quando o status for COURTESY.');
    }

    // Normalizacao do telefone (opcional). Frontend ja envia +E.164, mas mantemos
    // defensivo. customer_phone_e164 sera usado para upsert em customers e para
    // gravar o pedido. Se invalido, mantem so o que veio (compat com fluxos antigos).
    const customerPhoneE164 = normalizeBrazilPhone(customer_phone);
    if (customer_phone && customer_phone.length > 0 && customer_phone.length < 8) {
      throw new Error('Número de telefone inválido.');
    }
    const shouldRememberCustomer = remember_checkout_data === true && !!customerPhoneE164;

    // 3. Buscar configurações e validar produtos/addons
    const { data: settingsData } = await supabaseAdmin.from('settings').select('key, value');
    const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {};

    let subtotalAmount = 0;
    const finalItemsData = [];

    // Validar itens, preços e setores
    for (const item of items) {
      if (item.quantity <= 0) throw new Error('Quantidade inválida para o produto.');

      const { data: product, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, name, price, sector, active, branch_id')
        .eq('id', item.product_id)
        .eq('branch_id', branch_id)
        .single();

      if (prodErr || !product) throw new Error(`Produto inexistente nessa filial (ID: ${item.product_id}).`);
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
          if (add.quantity <= 0) throw new Error('Quantidade inválida de adicional.');
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

          const addonTotal = Number(addonDB.price) * add.quantity * item.quantity; // x qtd do produto!
          itemTotalPrice += addonTotal;

          addonsSnapshots.push({
            addon_id: addonDB.id,
            quantity: add.quantity,
            addon_name_snapshot: addonDB.name,
            addon_price_snapshot: addonDB.price
          });
        }
      }

      subtotalAmount += itemTotalPrice;

      finalItemsData.push({
        product,
        quantity: item.quantity,
        notes: item.notes || null,
        itemTotalPrice,
        removedIngredientsSnapshots,
        addonsSnapshots
      });
    }

    // 4. Calcular Taxas e Descontos
    let packingFee = 0;
    if (order_type === 'VIAGEM' && settingBool(settings.apply_packaging_fee_for_takeout)) {
      packingFee = settingNumber(settings.packaging_fee);
    }

    let discountAmount = 0;
    if (discount) {
      if (!discount.reason) throw new Error('É obrigatório informar o motivo (reason) do desconto.');
      if (discount.type !== 'AMOUNT' && discount.type !== 'PERCENT') throw new Error('Tipo de desconto inválido.');
      
      if (discount.type === 'AMOUNT') {
        discountAmount = Number(discount.value);
      } else if (discount.type === 'PERCENT') {
        discountAmount = subtotalAmount * (Number(discount.value) / 100);
      }
      
      if (discountAmount > (subtotalAmount + packingFee)) {
         throw new Error('Desconto maior que o total do pedido (subtotal + embalagem).');
      }
    }

    const totalAmount = subtotalAmount + packingFee - discountAmount;
    if (totalAmount < 0) {
       throw new Error('Total final nunca pode ser menor que zero.');
    }
    const nowIso = new Date().toISOString();
    let paidAt = null;

    // Se pago ou cortesia, já setamos o paid_at
    if (payment_status === 'PAID' || payment_status === 'COURTESY') {
      paidAt = nowIso;
    }

    // 4.5. Upsert do cliente se telefone valido. Mesmo padrão do create-public-order:
    // sempre toca last_seen/last_order/orders_count; só atualiza nome + flag de
    // "lembrar" quando remember_checkout_data=true. Falha aqui nao bloqueia o pedido.
    let customerId: string | null = null;
    if (customerPhoneE164) {
      try {
        const { data: existingCustomer } = await supabaseAdmin
          .from('customers')
          .select('id, orders_count, name')
          .eq('id', customerPhoneE164)
          .maybeSingle();

        const ordersCount = Number(existingCustomer?.orders_count ?? 0) + 1;
        const upsertPayload: Record<string, unknown> = {
          id: customerPhoneE164,
          phone_e164: customerPhoneE164,
          // Se o atendente nao digitou nome, preserva o nome anterior (fallback "Cliente")
          name: (customer_name && String(customer_name).trim()) || existingCustomer?.name || 'Cliente',
          last_seen_at: nowIso,
          last_order_at: nowIso,
          orders_count: ordersCount,
          source: existingCustomer ? undefined : 'ATTENDANT',
        };

        if (shouldRememberCustomer) {
          upsertPayload.remember_checkout_data = true;
          upsertPayload.checkout_profile_updated_at = nowIso;
          upsertPayload.last_order_type = order_type;
        }

        const { error: customerErr } = await supabaseAdmin
          .from('customers')
          .upsert(upsertPayload, { onConflict: 'id', ignoreDuplicates: false });

        if (customerErr) {
          console.error('[create-attendant-order] customer upsert falhou (non-blocking):', customerErr.message);
        } else {
          customerId = customerPhoneE164;
        }
      } catch (customerErr) {
        console.error('[create-attendant-order] customer upsert excecao (non-blocking):', customerErr);
      }
    }

    // 5. Inserir Pedido (Avança o status para NA_FILA)
    const { data: createdOrder, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        branch_id: branch.id,
        source: 'ATTENDANT',
        type: order_type,
        // split_bill: fica em AGUARDANDO_PAGAMENTO até todos pagarem → mark-payment imprime depois
        status: isSplitBill ? 'AGUARDANDO_PAGAMENTO' : 'NA_FILA',
        customer_name: customer_name || null,
        customer_phone: customerPhoneE164 ?? (customer_phone || null),
        customer_id: customerId,
        notes: notes || null,
        discount_amount: discountAmount,
        packing_fee: packingFee,
        total_amount: totalAmount,
        payment_method: payment_method,
        payment_status: payment_status,
        created_by: user.id,
        confirmed_by: isSplitBill ? null : user.id, // confirmação acontece após pagamento no split
        confirmed_at: isSplitBill ? null : nowIso,
        paid_at: paidAt
      })
      .select('id, daily_number')
      .single();

    if (insertError) throw new Error('Erro ao criar pedido principal: ' + insertError.message);

    const auditLogsToInsert = [];
    auditLogsToInsert.push({ action: 'ORDER_CREATED', table_name: 'orders', record_id: createdOrder.id, user_id: user.id });
    auditLogsToInsert.push({ action: 'ORDER_SENT_TO_QUEUE', table_name: 'orders', record_id: createdOrder.id, user_id: user.id });

    // 6. Registrar Desconto
    if (discountAmount > 0) {
      await supabaseAdmin.from('discounts').insert({
        order_id: createdOrder.id,
        type: discount.type,
        value: discount.value,
        amount_applied: discountAmount,
        reason: discount.reason,
        granted_by: user.id
      });
      auditLogsToInsert.push({ action: 'DISCOUNT_APPLIED', table_name: 'orders', record_id: createdOrder.id, user_id: user.id });
    }

    // 7. Registrar Pagamento em Histórico
    if (payment_status === 'PAID') {
       await supabaseAdmin.from('payments').insert({
         order_id: createdOrder.id,
         amount: totalAmount,
         payment_method: payment_method,
         payment_status: 'PAID',
         received_by: user.id
       });
       auditLogsToInsert.push({ action: 'PAYMENT_MARKED_PAID', table_name: 'orders', record_id: createdOrder.id, user_id: user.id });
    } else if (payment_status === 'COURTESY') {
       await supabaseAdmin.from('payments').insert({
         order_id: createdOrder.id,
         amount: totalAmount,
         payment_method: 'COURTESY',
         payment_status: 'COURTESY',
         received_by: user.id
       });
       auditLogsToInsert.push({ action: 'PAYMENT_MARKED_COURTESY', table_name: 'orders', record_id: createdOrder.id, user_id: user.id });
    }

    // 8. Inserir Itens
    for (const itemData of finalItemsData) {
      const { data: oi, error: oiErr } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: createdOrder.id,
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

      if (oiErr) throw new Error('Erro ao inserir item do pedido.');

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

    // 9. Fila de Impressão
    // split_bill: NÃO imprime agora — mark-payment dispara a impressão quando tudo for pago
    const printingEnabled = !isSplitBill && settingBool(settings['printing_enabled'], true);
    const shouldPrintCustomer = printingEnabled && settingBool(settings['print_customer_copy']);
    const shouldPrintKitchen = printingEnabled && settingBool(settings['print_kitchen_copy']);
    const shouldPrintJuice = printingEnabled && settingBool(settings['print_juice_potato_copy']);

    const kitchenItems = finalItemsData.filter(i => i.product.sector === 'KITCHEN');
    const juicePotatoItems = finalItemsData.filter(i => i.product.sector === 'JUICE_POTATO');
    
    const printerJobsToInsert = [];
    const createdJobsResponse = [];
    const formatBRL = (val: number) => `R$ ${parseFloat(val as any).toFixed(2).replace('.', ',')}`;
    const timestampNow = new Date(nowIso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const receiptOrder = {
      ...createdOrder,
      type: order_type,
      customer_name,
      customer_phone,
      notes,
      discount_amount: discountAmount,
      packing_fee: packingFee,
      total_amount: totalAmount,
      payment_status,
      payment_method,
    };

    // Monta Via KITCHEN
    if (kitchenItems.length > 0 && shouldPrintKitchen) {
      let content = `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(createdOrder.daily_number).padStart(3, '0')}\n`;
      content += `KREPS\n`;
      content += `Tipo: ${order_type}\n`;
      content += `Horário: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of kitchenItems) {
        content += `${item.quantity}x ${item.product.name}\n`;
        if (item.removedIngredientsSnapshots.length > 0) {
           content += `  SEM: ${item.removedIngredientsSnapshots.map(r => r.ingredient_name_snapshot).join(', ')}\n`;
        }
        if (item.addonsSnapshots.length > 0) {
           content += `  COM: ${item.addonsSnapshots.map(a => `${a.quantity}x ${a.addon_name_snapshot}`).join(', ')}\n`;
        }
        if (item.notes) {
           content += `  OBS: ${item.notes}\n`;
        }
        content += `\n`;
      }
      content += `------------------------\n`;
      content = buildProductionReceipt(receiptOrder, finalItemsData, 'KITCHEN', {
        timestamp: timestampNow,
        title: 'KREPS',
        branchCode: branch.code,
        branchName: branch.name,
      });
      printerJobsToInsert.push({ order_id: createdOrder.id, branch_id: branch.id, sector: 'KITCHEN', content: { text: content } });
    }

    // Monta Via JUICE_POTATO
    if (juicePotatoItems.length > 0 && shouldPrintJuice) {
      let content = `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(createdOrder.daily_number).padStart(3, '0')}\n`;
      content += `COZINHA\n`;
      content += `Tipo: ${order_type}\n`;
      content += `Horário: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of juicePotatoItems) {
        content += `${item.quantity}x ${item.product.name}\n`;
        if (item.notes) {
           content += `  OBS: ${item.notes}\n`;
        }
        content += `\n`;
      }
      content += `------------------------\n`;
      content = buildProductionReceipt(receiptOrder, finalItemsData, 'JUICE_POTATO', {
        timestamp: timestampNow,
        title: 'COZINHA',
        branchCode: branch.code,
        branchName: branch.name,
      });
      printerJobsToInsert.push({ order_id: createdOrder.id, branch_id: branch.id, sector: 'JUICE_POTATO', content: { text: content } });
    }

    // Monta Via CUSTOMER
    if (shouldPrintCustomer) {
      let content = `MARCOS KREP'S\n`;
      content += `PEDIDO #${String(createdOrder.daily_number).padStart(3, '0')}\n`;
      content += `CLIENTE / SENHA\n`;
      content += `Tipo: ${order_type}\n`;
      if (customer_name) {
         content += `Cliente: ${customer_name}\n`;
      }
      content += `Horário: ${timestampNow}\n`;
      content += `------------------------\n`;
      
      for (const item of finalItemsData) {
        content += `${item.quantity}x ${item.product.name} - ${formatBRL(item.product.price)}\n`;
        if (item.addonsSnapshots.length > 0) {
           for(const add of item.addonsSnapshots) {
              content += `  + ${add.quantity}x ${add.addon_name_snapshot} - ${formatBRL(add.addon_price_snapshot)}\n`;
           }
        }
      }
      content += `------------------------\n`;
      if (discountAmount > 0) content += `Desconto: -${formatBRL(discountAmount)}\n`;
      if (packingFee > 0) content += `Taxa Embalagem: ${formatBRL(packingFee)}\n`;
      content += `TOTAL: ${formatBRL(totalAmount)}\n`;
      content += `Status Pagamento: ${payment_status}\n`;
      if (payment_method !== 'PENDING') content += `Forma: ${payment_method}\n`;
      content += `------------------------\n`;
      content += `Guarde este número para retirada.\n`;

      content = buildCustomerReceipt(receiptOrder, finalItemsData, {
        timestamp: timestampNow,
        branchCode: branch.code,
        branchName: branch.name,
      });
      printerJobsToInsert.push({ order_id: createdOrder.id, branch_id: branch.id, sector: 'CUSTOMER', content: { text: content } });
    }

    // Insert Printer Jobs
    if (printerJobsToInsert.length > 0) {
       const { data: insertedJobs, error: jobsErr } = await supabaseAdmin
         .from('printer_jobs')
         .insert(printerJobsToInsert)
         .select('id, sector');
         
       if (jobsErr) throw new Error('Erro ao gerar fila de impressão: ' + jobsErr.message);
       createdJobsResponse.push(...insertedJobs.map(j => ({ type: j.sector, id: j.id })));
       
       for (const job of insertedJobs) {
          auditLogsToInsert.push({ action: 'PRINTER_JOB_CREATED', table_name: 'printer_jobs', record_id: job.id, user_id: user.id });
       }
    }

    // Commits the Audit Logs
    if (auditLogsToInsert.length > 0) {
      await supabaseAdmin.from('audit_logs').insert(auditLogsToInsert);
    }

    // WhatsApp: notify "novo_pedido" if attendant captured customer phone (non-blocking)
    await enqueueWhatsAppMessage(supabaseAdmin, {
      orderId: createdOrder.id,
      branchId: branch.id,
      eventType: 'order_received',
      phone: customerPhoneE164 ?? customer_phone,
      customerName: customer_name,
      dailyNumber: createdOrder.daily_number,
      branchCode: branch.code,
      branchName: branch.name,
    });

    // 10. Retorno
    return new Response(JSON.stringify({ 
      success: true, 
      order: {
        order_id: createdOrder.id,
        daily_number: createdOrder.daily_number,
        status: 'NA_FILA',
        payment_status: payment_status,
        payment_method: payment_method,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        packaging_fee: packingFee,
        total_amount: totalAmount
      },
      printer_jobs: createdJobsResponse
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[create-attendant-order] Failed to create order", {
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
