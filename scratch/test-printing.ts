import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from print-worker
dotenv.config({ path: path.join(process.cwd(), 'print-worker', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('🚀 Iniciando teste de validação de impressão...');

  // 1. Buscar produtos reais
  const { data: products } = await supabase.from('products').select('*').limit(10);
  const krep = products?.find(p => p.sector === 'KITCHEN');
  const juice = products?.find(p => p.sector === 'JUICE_POTATO');

  if (!krep || !juice) {
    console.error('❌ Produtos necessários não encontrados no banco.');
    return;
  }

  // 2. Simular criação de pedido misto
  console.log('📝 Criando pedido de teste misto...');
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    customer_name: 'Teste QA Impressão',
    type: 'BALCAO',
    status: 'NA_FILA',
    total_amount: 50.00,
    payment_status: 'PAID',
    payment_method: 'PIX'
  }).select().single();

  if (orderErr) {
    console.error('❌ Erro ao criar pedido:', orderErr);
    return;
  }

  console.log(`✅ Pedido #${order.daily_number} criado (ID: ${order.id})`);

  // 3. Simular geração de jobs (Como faria a Edge Function)
  console.log('🖨️ Gerando printer_jobs...');
  const jobs = [
    {
      order_id: order.id,
      sector: 'KITCHEN',
      status: 'PENDING',
      content: { text: `MARCOS KREP'S\nPEDIDO #${order.daily_number}\nCOZINHA / KREP\n${krep.name}\n` }
    },
    {
      order_id: order.id,
      sector: 'JUICE_POTATO',
      status: 'PENDING',
      content: { text: `MARCOS KREP'S\nPEDIDO #${order.daily_number}\nSUCOS / BATATA\n${juice.name}\n` }
    }
  ];

  const { data: insertedJobs, error: jobsErr } = await supabase.from('printer_jobs').insert(jobs).select();
  if (jobsErr) {
    console.error('❌ Erro ao criar jobs:', jobsErr);
    return;
  }
  console.log(`✅ ${insertedJobs.length} jobs gerados com status PENDING.`);

  // 4. Simular falha de impressora (Requisito 11-12)
  console.log('⚠️ Simulando falha em um dos jobs...');
  const failJob = insertedJobs[0];
  await supabase.from('printer_jobs').update({
    status: 'FAILED',
    error_message: 'Printer not reachable (Simulated)'
  }).eq('id', failJob.id);
  console.log(`✅ Job ${failJob.id} marcado como FAILED.`);

  // 5. Simular sucesso de impressão (Requisito 13-14)
  console.log('✨ Simulando sucesso em outro job...');
  const successJob = insertedJobs[1];
  await supabase.from('printer_jobs').update({
    status: 'PRINTED',
    printed_at: new Date().toISOString()
  }).eq('id', successJob.id);
  console.log(`✅ Job ${successJob.id} marcado como PRINTED.`);

  // 6. Testar Adicional de Comanda (Requisito 7-8)
  console.log('➕ Testando ADICIONAL DE COMANDA...');
  const addonJob = {
    order_id: order.id,
    sector: 'KITCHEN',
    status: 'PENDING',
    content: { text: `MARCOS KREP'S\nADICIONAL DE COMANDA\nPEDIDO #${order.daily_number}\n+ 1x ${krep.name}\n` }
  };
  const { data: insertedAddon } = await supabase.from('printer_jobs').insert(addonJob).select().single();
  console.log(`✅ Job de ADICIONAL gerado: ${insertedAddon.id}`);

  // 7. Testar Reimpressão (Requisito 9-10)
  console.log('🔄 Testando REIMPRESSÃO...');
  const reprintJob = {
    order_id: order.id,
    sector: 'CUSTOMER',
    status: 'PENDING',
    content: { text: `*** REIMPRESSÃO ***\nMARCOS KREP'S\nPEDIDO #${order.daily_number}\nCLIENTE / SENHA\n` }
  };
  const { data: insertedReprint } = await supabase.from('printer_jobs').insert(reprintJob).select().single();
  console.log(`✅ Job de REIMPRESSÃO gerado: ${insertedReprint.id}`);

  console.log('\n🏁 Teste de fluxo concluído com sucesso!');
  console.log('Verifique a tabela printer_jobs no dashboard para confirmar os conteúdos e status.');
}

runTest();
