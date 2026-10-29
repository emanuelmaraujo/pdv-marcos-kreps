import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Order, OrderItem, HandoffUnit } from "@/types/pdv";
import { OrderCard } from "./OrderCard";

const baseOrder: Order = {
  id: "order-1",
  daily_number: 12,
  branch_id: "branch-1",
  public_token: "token",
  type: "BALCAO",
  source: "ATTENDANT",
  status: "NA_FILA",
  payment_status: "PAID",
  payment_method: "PIX",
  discount_amount: 0,
  discount_percentage: 0,
  packing_fee: 0,
  delivery_fee: 0,
  total_amount: 25,
  created_at: "2026-09-13T12:00:00.000Z",
  updated_at: "2026-09-13T12:00:00.000Z",
  items: [],
};

function renderOrder(order: Order) {
  return renderToStaticMarkup(
    <OrderCard
      order={order}
      now={new Date("2026-09-13T12:05:00.000Z").getTime()}
      onClick={vi.fn()}
      onQuickAction={vi.fn()}
      onMarkDelivered={vi.fn()}
    />,
  );
}

describe("OrderCard actions", () => {
  it("shows direct delivery beside mark ready for counter and takeout orders", () => {
    const counterMarkup = renderOrder(baseOrder);
    const takeoutMarkup = renderOrder({ ...baseOrder, type: "VIAGEM" });

    for (const markup of [counterMarkup, takeoutMarkup]) {
      expect(markup).toContain("Entregar");
      expect(markup).toContain("Marcar pronto");
    }
  });

  it("does not allow direct delivery for delivery orders", () => {
    const markup = renderOrder({ ...baseOrder, type: "ENTREGA" });

    expect(markup).not.toContain("Entregar");
    expect(markup).toContain("Marcar pronto");
  });
});

const fixtureItem: OrderItem = {
 id:'item-1',order_id:'order-1',product_id:'product',product_name_snapshot:'Crepe teste',
 product_price_snapshot:25,quantity:3,total_price:75,production_sector:'KITCHEN',
 status:'PENDING',payment_status:'PENDING',payment_method:'PENDING',
};
const fixtureUnit: HandoffUnit = {
 id:'unit-1',order_id:'order-1',order_item_id:'item-1',unit_no:1,version:1,revision:1,
 sector:'KITCHEN',state:'PENDING',confirmed:false,mode:'MANUAL',enabled:true,can_manage:false,
 confirmed_at:null,actor_name:'',printed_at:null,job_status:null,job_id:null,history:[],
};
describe('quadro de repasse e preparo por unidade',()=>{
 it('prioriza nome e mantém controles de repasse e preparo por unidade no pronto parcial',()=>{
  const html=renderOrder({...baseOrder,customer_name:'Ana',status:'PRONTO_PARCIAL',items:[fixtureItem],handoffs:[fixtureUnit,{...fixtureUnit,id:'u-ready',unit_no:2,prep_status:'READY' as const}]});
  expect(html.indexOf('Ana</button>')).toBeLessThan(html.indexOf('#012'));
  expect(html).toContain('Anotado e repassado');
  expect(html).toContain('Unidade 1/3');
  expect(html).toContain('Aguardando preparo');
  expect(html).toContain('Preparar');
  expect(html).toContain('Marcar pronto');
  expect(html).toContain('Aguardando anotar / repassar');
  expect(html).toContain('Entregar prontos');
 });
 it('oferece botão de entrega individual para unidade pronta no balcão e motoboy na entrega',()=>{
  const readyUnit = { ...fixtureUnit, prep_status: 'READY' as const };
  const counterHtml = renderOrder({ ...baseOrder, items: [fixtureItem], handoffs: [readyUnit] });
  expect(counterHtml).toContain('Entregar unidade');

  const deliveryHtml = renderOrder({ ...baseOrder, type: 'ENTREGA', items: [fixtureItem], handoffs: [readyUnit] });
  expect(deliveryHtml).toContain('Pronto p/ motoboy');
  expect(deliveryHtml).not.toContain('Entregar unidade');
 });
 it('exibe ações em lote quando há múltiplas unidades',()=>{
  const unit2 = { ...fixtureUnit, id: 'unit-2', unit_no: 2 };
  const html = renderOrder({ ...baseOrder, items: [fixtureItem], handoffs: [fixtureUnit, unit2] });
  expect(html).toContain('Todas prontas (2)');
 });
 it('mantém unidade entregue visível no cartão com horário',()=>{
  const deliveredUnit = { ...fixtureUnit, prep_status: 'DELIVERED' as const, delivered_at: '2026-10-28T12:00:00Z' };
  const html = renderOrder({ ...baseOrder, items: [fixtureItem], handoffs: [deliveredUnit] });
  // Recolhida num resumo expansível: sem botões, com horário e histórico acessíveis.
  expect(html).toMatch(/<details[^>]*>[\s\S]*Entregue[\s\S]*Unidade 1\/3[\s\S]*entregue \d{2}:\d{2}/);
  expect(html).not.toContain('Entregar unidade');
  expect(html).toContain('Crepe teste');
 });
 it('não repete entrega no cartão nem libera ações após despacho',()=>{
  const ready = (n:number)=>({ ...fixtureUnit, id:`u${n}`, unit_no:n, prep_status:'READY' as const });
  const parcial = renderOrder({ ...baseOrder, status:'PRONTO_PARCIAL', items:[fixtureItem], handoffs:[ready(1),ready(2)] });
  expect(parcial.match(/Entregar prontas/g) ?? []).toHaveLength(0);
  expect(parcial.match(/Entregar prontos/g) ?? []).toHaveLength(1);
  const soEntregues = renderOrder({ ...baseOrder, status:'PRONTO_PARCIAL', items:[fixtureItem], handoffs:[{ ...ready(1), prep_status:'DELIVERED' as const }, { ...ready(2), prep_status:'PENDING' as const }] });
  expect(soEntregues).not.toContain('Entregar prontos');
  const despachado = renderOrder({ ...baseOrder, type:'ENTREGA', status:'SAIU_PARA_ENTREGA', items:[fixtureItem], handoffs:[ready(1)] });
  expect(despachado).not.toMatch(/Marcar pronto|Preparar|Anotado e repassado|Todas prontas/);
  expect(despachado).toContain('Crepe teste');
 });
 it('não oferece confirmação quando a consulta falha e não oculta os itens',()=>{
  const html=renderOrder({...baseOrder,items:[fixtureItem]});
  expect(html).toContain('Não foi possível consultar o repasse');
  expect(html).toContain('Crepe teste');
  expect(html).not.toContain('Anotado e repassado');
 });
 it('separa recuperação manual de falha do job',()=>{
  const html=renderOrder({...baseOrder,items:[fixtureItem],handoffs:[{...fixtureUnit,state:'CONFIRMED',mode:'PRINTER',confirmed:true,confirmed_at:'2026-10-27T12:00:00Z',actor_name:'Maria',job_status:'FAILED'}]});
  expect(html).toContain('Recuperação manual confirmada');
  expect(html).toContain('Falha no job mais recente');
 });
});

it('não reatribui confirmação manual quando o setor muda para impressora',()=>{
 const html=renderOrder({...baseOrder,items:[fixtureItem],handoffs:[{...fixtureUnit,state:'CONFIRMED',confirmed:true,mode:'PRINTER',confirmation_origin:'MANUAL'}]});
 expect(html).toContain('Anotado e repassado');
 expect(html).not.toContain('Recuperação manual confirmada');
});

it('bloqueia repasse offline e mantém os itens carregados visíveis',()=>{
 const html=renderToStaticMarkup(<OrderCard order={{...baseOrder,items:[fixtureItem],handoffs:[fixtureUnit]}} now={0} onClick={vi.fn()} handoffOffline />);
 expect(html).toContain('confirmação de repasse bloqueada');
 expect(html).toContain('Crepe teste');
 expect(html).toMatch(/disabled=""[^>]*>Anotado e repassado/);
});
