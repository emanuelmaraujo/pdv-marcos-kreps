// Teste de ponta a ponta da localização GPS do endereço de entrega (checkout público).
//
// Requer supabase local rodando (`npx supabase start`), migrations aplicadas
// (`npx supabase db reset`) e as Edge Functions servindo localmente
// (`npx supabase functions serve --no-verify-jwt`). Roda com Node:
//
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_ANON_KEY=<anon do `supabase status`> \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role do `supabase status`> \
//   node scripts/test-geolocation-delivery.js
//
// Precisa de acesso à internet real (consulta o ViaCEP de verdade, como
// create-public-order já faz em produção — mesmo padrão dos outros testes
// deste diretório, sem mock de rede).
//
// Cobre:
//   1. Pedido com pin de GPS válido -> grava delivery_latitude/longitude certos.
//   2. Pedido sem pin -> segue normalmente, campos ficam NULL (nunca bloqueia).
//   3. Coordenada fora do intervalo válido -> descartada, pedido não é bloqueado.
//   4. latitude/longitude explicitamente null -> fica NULL, não vira 0,0
//      ("Null Island") — regressão do bug encontrado no code review.
//   5. Endereço salvo com pin -> reaproveitado corretamente num pedido novo.
//
// Cria e limpa seus próprios dados de teste (pedidos, endereços, clientes,
// zona de entrega) no fim da execução, mesmo em caso de falha.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Faltam variáveis de ambiente! Configure SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (ver `npx supabase status`).');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const RUN_ID = Date.now();
const TEST_CEP = '70297400'; // Quadra EQS 414/415, Asa Sul, Brasília-DF (ViaCEP real)
const TEST_NEIGHBORHOOD = 'Asa Sul';

// DDD (61) + 9 + 8 dígitos únicos por teste — telefone BR válido (11 dígitos).
const uniqueDigits = String(RUN_ID).slice(-7);
const testPhone = (n) => `619${uniqueDigits}${n}`;

const log = (step, expected, result) => {
  console.log(`\n✅ TESTE: ${step}\n   Esperado: ${expected}\n   Resultado: ${result}`);
};

const fail = (message) => {
  console.error(`\n🚨 FALHA: ${message}`);
  throw new Error(message);
};

async function callFunction(name, payload) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { status: response.status, data };
}

function orderPayload(overrides) {
  return {
    order_type: 'ENTREGA',
    branch_slug: 'principal',
    delivery_address: {
      street: 'Quadra EQS 414/415',
      neighborhood: TEST_NEIGHBORHOOD,
      postal_code: TEST_CEP,
      number: '1',
      ...overrides.delivery_address,
    },
    items: [{ product_id: overrides.productId, quantity: 1 }],
    customer_name: overrides.customerName,
    customer_phone: overrides.customerPhone,
    save_address: overrides.saveAddress,
  };
}

const cleanup = { phones: [], branchId: null };

async function main() {
  console.log('Iniciando teste de localização GPS do endereço de entrega...\n');

  const { data: branch, error: branchErr } = await admin
    .from('branches')
    .select('id, slug')
    .eq('slug', 'principal')
    .maybeSingle();
  if (branchErr || !branch) fail('Filial "principal" não encontrada — rode `npx supabase db reset` para popular o seed.');
  cleanup.branchId = branch.id;

  const { data: product, error: productErr } = await admin
    .from('products')
    .select('id')
    .eq('branch_id', branch.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (productErr || !product) fail('Nenhum produto ativo encontrado na filial "principal".');

  // Habilita entrega + zona pro bairro do CEP de teste (revertido no cleanup).
  const { error: enableErr } = await admin.from('branches').update({ delivery_enabled: true }).eq('id', branch.id);
  if (enableErr) fail(`Falha ao habilitar entrega: ${enableErr.message}`);
  const { error: zoneErr } = await admin.from('delivery_zones').insert({
    branch_id: branch.id,
    neighborhood: TEST_NEIGHBORHOOD,
    neighborhood_normalized: 'asa sul',
    fee: 7,
    active: true,
  });
  if (zoneErr) fail(`Falha ao cadastrar zona de entrega de teste: ${zoneErr.message}`);

  // --- 1. Pin de GPS válido ---
  const phone1 = testPhone(1);
  cleanup.phones.push(phone1);
  const res1 = await callFunction('create-public-order', orderPayload({
    productId: product.id,
    customerName: 'Cliente Pin Valido',
    customerPhone: phone1,
    delivery_address: { latitude: -15.8158, longitude: -47.9091 },
  }));
  if (!res1.data.success) fail(`Pedido com pin válido falhou: ${res1.data.error}`);
  const { data: order1 } = await admin.from('orders').select('delivery_latitude, delivery_longitude').eq('id', res1.data.order.order_id).single();
  if (order1.delivery_latitude !== -15.8158 || order1.delivery_longitude !== -47.9091) {
    fail(`Pin não gravado corretamente: ${JSON.stringify(order1)}`);
  }
  log('Fluxo 1 (pin de GPS válido)', 'delivery_latitude/longitude gravados exatamente como enviados', JSON.stringify(order1));

  // --- 2. Sem pin — nunca bloqueia o pedido ---
  const phone2 = testPhone(2);
  cleanup.phones.push(phone2);
  const res2 = await callFunction('create-public-order', orderPayload({
    productId: product.id,
    customerName: 'Cliente Sem Pin',
    customerPhone: phone2,
  }));
  if (!res2.data.success) fail(`Pedido sem pin foi bloqueado (não deveria): ${res2.data.error}`);
  const { data: order2 } = await admin.from('orders').select('delivery_latitude, delivery_longitude').eq('id', res2.data.order.order_id).single();
  if (order2.delivery_latitude !== null || order2.delivery_longitude !== null) {
    fail(`Pedido sem pin deveria ficar NULL: ${JSON.stringify(order2)}`);
  }
  log('Fluxo 2 (sem pin)', 'Pedido aceito normalmente, campos NULL', JSON.stringify(order2));

  // --- 3. Coordenada fora do intervalo válido — descartada, não bloqueia ---
  const phone3 = testPhone(3);
  cleanup.phones.push(phone3);
  const res3 = await callFunction('create-public-order', orderPayload({
    productId: product.id,
    customerName: 'Cliente Pin Invalido',
    customerPhone: phone3,
    delivery_address: { latitude: 999, longitude: -47.9091 },
  }));
  if (!res3.data.success) fail(`Pedido com coordenada inválida foi bloqueado (não deveria): ${res3.data.error}`);
  const { data: order3 } = await admin.from('orders').select('delivery_latitude, delivery_longitude').eq('id', res3.data.order.order_id).single();
  if (order3.delivery_latitude !== null) fail(`Latitude fora do intervalo deveria virar NULL: ${JSON.stringify(order3)}`);
  log('Fluxo 3 (coordenada fora do intervalo)', 'Descartada sem bloquear o pedido', JSON.stringify(order3));

  // --- 4. Regressão do bug: null explícito não vira 0,0 ---
  const phone4 = testPhone(4);
  cleanup.phones.push(phone4);
  const res4 = await callFunction('create-public-order', orderPayload({
    productId: product.id,
    customerName: 'Cliente Null Explicito',
    customerPhone: phone4,
    delivery_address: { latitude: null, longitude: null },
  }));
  if (!res4.data.success) fail(`Pedido com latitude/longitude null falhou: ${res4.data.error}`);
  const { data: order4 } = await admin.from('orders').select('delivery_latitude, delivery_longitude').eq('id', res4.data.order.order_id).single();
  if (order4.delivery_latitude === 0 || order4.delivery_longitude === 0) {
    fail(`REGRESSÃO: null virou 0,0 ("Null Island") em vez de ficar NULL: ${JSON.stringify(order4)}`);
  }
  if (order4.delivery_latitude !== null || order4.delivery_longitude !== null) {
    fail(`latitude/longitude null deveriam ficar NULL: ${JSON.stringify(order4)}`);
  }
  log('Fluxo 4 (null explícito não vira 0,0)', 'Fica NULL, não "Null Island"', JSON.stringify(order4));

  // --- 5. Endereço salvo com pin é reaproveitado ---
  const phone5 = testPhone(5);
  cleanup.phones.push(phone5);
  const res5a = await callFunction('create-public-order', orderPayload({
    productId: product.id,
    customerName: 'Cliente Reaproveita Pin',
    customerPhone: phone5,
    delivery_address: { latitude: -15.82, longitude: -47.91 },
    saveAddress: true,
  }));
  if (!res5a.data.success) fail(`Falha ao criar pedido pra salvar endereço: ${res5a.data.error}`);

  const { data: savedAddress, error: savedErr } = await admin
    .from('customer_addresses')
    .select('id, latitude, longitude')
    .eq('customer_id', `+55${phone5}`)
    .maybeSingle();
  if (savedErr || !savedAddress) fail('Endereço não foi salvo com o pin.');
  if (savedAddress.latitude !== -15.82 || savedAddress.longitude !== -47.91) {
    fail(`Pin salvo incorretamente: ${JSON.stringify(savedAddress)}`);
  }

  const res5b = await callFunction('create-public-order', {
    order_type: 'ENTREGA',
    branch_slug: 'principal',
    delivery_address_id: savedAddress.id,
    items: [{ product_id: product.id, quantity: 1 }],
    customer_name: 'Cliente Reaproveita Pin',
    customer_phone: phone5,
  });
  if (!res5b.data.success) fail(`Falha ao reutilizar endereço salvo: ${res5b.data.error}`);
  const { data: order5 } = await admin.from('orders').select('delivery_latitude, delivery_longitude').eq('id', res5b.data.order.order_id).single();
  if (order5.delivery_latitude !== -15.82 || order5.delivery_longitude !== -47.91) {
    fail(`Pin não foi reaproveitado do endereço salvo: ${JSON.stringify(order5)}`);
  }
  log('Fluxo 5 (reaproveitar endereço salvo)', 'Pin do endereço salvo aplicado ao pedido novo', JSON.stringify(order5));

  console.log('\n✅ LOCALIZAÇÃO GPS DO ENDEREÇO DE ENTREGA OK — todos os cenários passaram.\n');
}

async function cleanupAll() {
  console.log('\nLimpando dados de teste...');
  if (cleanup.phones.length > 0) {
    const e164s = cleanup.phones.map((p) => `+55${p}`);
    await admin.from('orders').delete().in('customer_phone', e164s);
    await admin.from('customer_addresses').delete().in('customer_id', e164s);
    await admin.from('customers').delete().in('phone_e164', e164s);
  }
  if (cleanup.branchId) {
    await admin.from('delivery_zones').delete().eq('branch_id', cleanup.branchId);
    await admin.from('branches').update({ delivery_enabled: false }).eq('id', cleanup.branchId);
  }
  console.log('Limpeza concluída.');
}

main()
  .then(() => cleanupAll())
  .then(() => process.exit(0))
  .catch(async (err) => {
    await cleanupAll();
    console.error('\n🚨 TESTE FALHOU:', err.message);
    process.exit(1);
  });
