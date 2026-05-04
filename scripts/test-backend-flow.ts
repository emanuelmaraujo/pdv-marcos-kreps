import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
let ATTENDANT_JWT = Deno.env.get('ATTENDANT_JWT') || '';

if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltam variáveis de ambiente! Configure: SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const log = (step: string, expected: string, result: string, isError = false) => {
  if (isError) {
    console.error(`\n❌ TESTE: ${step}\n   Esperado: ${expected}\n   Resultado: ${result}`);
  } else {
    console.log(`\n✅ TESTE: ${step}\n   Esperado: ${expected}\n   Resultado: ${result}`);
  }
};

const fail = (message: string) => {
  console.error(`\n🚨 FALHA CRÍTICA: ${message}`);
  Deno.exit(1);
};

const callFunction = async (name: string, payload: any, token: string) => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { status: response.status, data };
};

async function runTests() {
  console.log("Iniciando testes ponta a ponta do backend...\n");

  if (!ATTENDANT_JWT) {
    console.log("ATTENDANT_JWT vazio. Criando um atendente de testes temporário...");
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: `test_attendant_${Date.now()}@pdv.com`,
      password: 'password123'
    });
    if (authErr || !authData.session) fail("Falha ao criar usuário de teste: " + (authErr?.message || 'Sem sessão'));
    
    ATTENDANT_JWT = authData.session.access_token;
    
    const { error: profErr } = await supabase.from('profiles').update({
      role: 'ATTENDANT',
      active: true
    }).eq('id', authData.user!.id);
    
    if (profErr) fail("Falha ao promover perfil para ATTENDANT: " + profErr.message);
    console.log("Usuário temporário criado e promovido com sucesso!\n");
  }

  // 1. Setup - Buscar IDs no banco
  const { data: products } = await supabase.from('products').select('id, name');
  const { data: ingredients } = await supabase.from('ingredients').select('id, name');
  const { data: addons } = await supabase.from('addons').select('id, name');

  const getProdId = (name: string) => products?.find(p => p.name === name)?.id;
  const getIngId = (name: string) => ingredients?.find(p => p.name === name)?.id;
  const getAddonId = (name: string) => addons?.find(p => p.name === name)?.id;

  const krepId = getProdId('04 Mercedes');
  const sucoId = getProdId('Suco de Laranja');
  const baconAddonId = getAddonId('bacon') || getAddonId('Bacon');
  const milhoIngId = getIngId('milho') || getIngId('Milho');

  if (!krepId || !sucoId || !baconAddonId || !milhoIngId) {
    fail("Não foi possível encontrar todos os produtos base no banco de dados. Verifique os nomes e o Seed.");
  }

  let orderId = '';
  let dailyNumber = 0;
  let publicToken = '';
  let calculatedTotal = 0;

  // --- TESTES NEGATIVOS INICIAIS ---

  // Negativo 1: create-public-order com preço manipulado
  const neg1 = await callFunction('create-public-order', {
    order_type: "BALCAO",
    items: [{ product_id: krepId, quantity: 1, price: 1.00 }] // Tentando roubar
  }, SUPABASE_ANON_KEY);
  if (neg1.status === 200) {
     // A função vai ignorar o price e calcular certo, ou falhar se esperar algo estrito. 
     // Como não usamos o price do payload, ele passará, mas o subtotal estará certo.
     // Validaremos se o total calculado é diferente de 1.00
     if (neg1.data.order.total === 1.00) fail("Preço manipulado aceito pelo backend!");
     log("Negativo 1 (Preço Manipulado)", "Backend ignora payload.price e calcula o valor real", "Ignorado com sucesso (Total calculado foi real)");
     // Cancel order so it doesnt litter our DB
     await supabase.from('orders').update({status: 'CANCELADO'}).eq('id', neg1.data.order.order_id);
  } else {
     log("Negativo 1 (Preço Manipulado)", "Pode retornar erro", `Retornou ${neg1.status}`);
  }

  // Negativo 2: confirm-order sem token
  const neg2 = await callFunction('confirm-order', { order_id: "xyz" }, SUPABASE_ANON_KEY); // Usando ANON e não JWT
  if (neg2.status === 200) fail("confirm-order executado sem token JWT de atendente!");
  log("Negativo 2 (confirm-order sem token JWT)", "Status 400", `Status ${neg2.status} e erro bloqueado.`);

  // --- FLUXO FELIZ (Ponta a Ponta) ---

  // 1. create-public-order
  const payloadCreate = {
    order_type: "BALCAO",
    customer_name: "Cliente Teste E2E",
    customer_phone: "61999999999",
    items: [
      {
        product_id: krepId,
        quantity: 1,
        removed_ingredient_ids: [milhoIngId],
        addons: [{ addon_id: baconAddonId, quantity: 1 }],
        notes: "Bem caprichado"
      },
      {
        product_id: sucoId,
        quantity: 1
      }
    ]
  };

  const res1 = await callFunction('create-public-order', payloadCreate, SUPABASE_ANON_KEY);
  if (!res1.data.success) fail(`Falha ao criar public order: ${res1.data.error}`);
  
  orderId = res1.data.order.order_id;
  dailyNumber = res1.data.order.daily_number;
  publicToken = res1.data.order.public_token;
  calculatedTotal = res1.data.order.total;

  log("Fluxo 1 (create-public-order)", "Pedido criado, AGUARDANDO_CONFIRMACAO, PENDING, e tokens gerados", 
      `Criado com SUCESSO. ID: ${orderId}, Senha: ${dailyNumber}`);

  // 2. Validações diretas no BD
  const { data: dbOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (dbOrder.status !== 'AGUARDANDO_CONFIRMACAO') fail(`Status no BD não é AGUARDANDO_CONFIRMACAO, é ${dbOrder.status}`);
  if (dbOrder.payment_status !== 'PENDING') fail(`Pagamento não é PENDING, é ${dbOrder.payment_status}`);
  if (dbOrder.total_amount !== calculatedTotal) fail(`Total no BD ${dbOrder.total_amount} difere do retornado ${calculatedTotal}`);
  
  const { count: pjCount } = await supabase.from('printer_jobs').select('*', { count: 'exact' }).eq('order_id', orderId);
  if (pjCount > 0) fail("printer_jobs foram criados precocemente!");

  log("Fluxo 2 (Validações DB Iniciais)", "Tudo exato no banco de dados", "Validado");

  // 3. get-public-order-status
  const res3 = await callFunction('get-public-order-status', { daily_number: dailyNumber, public_token: publicToken }, SUPABASE_ANON_KEY);
  if (!res3.data.success || !res3.data.order.customer_name) fail("Falha ao buscar status público");
  log("Fluxo 3 (get-public-order-status)", "Retorna status omitindo UUIDs internos", "Retornado com sucesso");

  // 4. confirm-order
  const res4 = await callFunction('confirm-order', { order_id: orderId }, ATTENDANT_JWT);
  if (!res4.data.success) fail(`Falha no confirm-order: ${res4.data.error}`);
  
  // Verifica fila de impressão
  const pJobs = res4.data.printer_jobs.map((j: any) => j.type);
  if (!pJobs.includes('KITCHEN') || !pJobs.includes('JUICE_POTATO') || !pJobs.includes('CUSTOMER')) {
    fail(`Impressão incompleta: ${pJobs}`);
  }
  log("Fluxo 4 (confirm-order)", "Status virou NA_FILA, 3 printer_jobs gerados", "Confirmado com sucesso");

  // Negativo 3: mark-payment amount inválido
  const neg3 = await callFunction('mark-payment', {
    order_id: orderId,
    payment_method: "PIX",
    payment_status: "PAID",
    amount: calculatedTotal - 5 // Diferente
  }, ATTENDANT_JWT);
  if (neg3.status === 200) fail("mark-payment aceitou amount diferente do total_amount!");
  log("Negativo 3 (mark-payment c/ amount inválido)", "Status 400", `Status ${neg3.status} e erro bloqueado`);

  // 5. mark-payment
  const res5 = await callFunction('mark-payment', {
    order_id: orderId,
    payment_method: "PIX",
    payment_status: "PAID",
    amount: calculatedTotal
  }, ATTENDANT_JWT);
  if (!res5.data.success) fail(`Falha no mark-payment: ${res5.data.error}`);
  
  const { data: dbOrderAfterPay } = await supabase.from('orders').select('payment_status, paid_at').eq('id', orderId).single();
  if (dbOrderAfterPay.payment_status !== 'PAID' || !dbOrderAfterPay.paid_at) fail("Pagamento não foi efetivado no BD");
  
  const { count: payCount } = await supabase.from('payments').select('*', { count: 'exact' }).eq('order_id', orderId);
  if (payCount !== 1) fail("Registro em payments não foi criado");
  log("Fluxo 5 (mark-payment)", "Pagamento efetivado, registro em payments criado", "Sucesso");

  // 6. update-order-status -> PRONTO
  const res6 = await callFunction('update-order-status', { order_id: orderId, status: "PRONTO" }, ATTENDANT_JWT);
  if (!res6.data.success) fail(`Falha ao marcar PRONTO: ${res6.data.error}`);
  
  const { data: dbReady } = await supabase.from('orders').select('ready_at').eq('id', orderId).single();
  if (!dbReady.ready_at) fail("ready_at não preenchido");
  
  const { count: zapCount } = await supabase.from('whatsapp_messages').select('*', { count: 'exact' }).eq('order_id', orderId);
  if (zapCount !== 1) fail("Mensagem PENDING de whatsapp não inserida");
  log("Fluxo 6 (update-order-status PRONTO)", "ready_at e whatsapp_messages gerados", "Sucesso");

  // 7. update-order-status -> ENTREGUE
  const res7 = await callFunction('update-order-status', { order_id: orderId, status: "ENTREGUE" }, ATTENDANT_JWT);
  if (!res7.data.success) fail(`Falha ao marcar ENTREGUE: ${res7.data.error}`);
  
  const { data: dbDelivered } = await supabase.from('orders').select('delivered_at').eq('id', orderId).single();
  if (!dbDelivered.delivered_at) fail("delivered_at não preenchido");
  log("Fluxo 7 (update-order-status ENTREGUE)", "delivered_at preenchido", "Sucesso");

  // Negativo 4: update-order-status tentar entregar pedido PENDING
  // Vamos criar um rapidão só pra testar
  const fakeOrder = await callFunction('create-public-order', payloadCreate, SUPABASE_ANON_KEY);
  const neg4 = await callFunction('update-order-status', { order_id: fakeOrder.data.order.order_id, status: "ENTREGUE" }, ATTENDANT_JWT);
  if (neg4.status === 200) fail("Permitiu entregar pedido PENDING sem force_delivery do ADMIN");
  log("Negativo 4 (entregar pedido PENDING)", "Status 400", `Status ${neg4.status} e bloqueado com segurança`);
  await supabase.from('orders').update({status: 'CANCELADO'}).eq('id', fakeOrder.data.order.order_id); // Cleanup

  // 8. reprint-order
  const res8 = await callFunction('reprint-order', { order_id: orderId }, ATTENDANT_JWT);
  if (!res8.data.success) fail(`Falha no reprint-order: ${res8.data.error}`);
  log("Fluxo 8 (reprint-order CUSTOMER)", "printer_job CUSTOMER recriado", "Sucesso");

  // Negativo 5: reprint-order JUICE_POTATO em pedido sem suco
  // Cria pedido falso sem suco
  const payloadNoJuice = JSON.parse(JSON.stringify(payloadCreate));
  payloadNoJuice.items.pop(); // Remove o suco
  const fakeOrder2 = await callFunction('create-public-order', payloadNoJuice, SUPABASE_ANON_KEY);
  const neg5 = await callFunction('reprint-order', { order_id: fakeOrder2.data.order.order_id, copies: ['JUICE_POTATO'] }, ATTENDANT_JWT);
  if (neg5.status === 200) fail("Reimprimiu JUICE_POTATO num pedido sem itens JUICE_POTATO");
  log("Negativo 5 (reprint-order JUICE em pedido KITCHEN)", "Status 400", `Bloqueado com sucesso`);
  await supabase.from('orders').update({status: 'CANCELADO'}).eq('id', fakeOrder2.data.order.order_id); // Cleanup

  console.log("\n✅ BACKEND FLOW OK\n");
}

runTests();
