import { describe, expect, it } from "vitest";
import type { Order, OrderItem } from "@/types/pdv";
import { getCodSelectionAmount } from "./delivery-payment";
const items=[{id:"a",total_price:20,status:"PENDING",payment_status:"PENDING"},{id:"b",total_price:20,status:"PENDING",payment_status:"PENDING"}] as OrderItem[];
const order={total_amount:35,discount_amount:10,cod_received_amount:0} as Order;
describe("prévia de recebimento presencial",()=>{
 it("inclui desconto no total, mantendo o frete na última parcela",()=>{expect(getCodSelectionAmount(order,items,new Set(["a"]))).toBe(15);expect(getCodSelectionAmount(order,items,new Set(["a","b"]))).toBe(35);});
 it("usa saldo registrado ao quitar restante, sem cobrar taxa duas vezes",()=>{const partiallyPaid=items.map(item=>item.id==="a"?{...item,payment_status:"PAID" as const}:item);expect(getCodSelectionAmount({...order,cod_received_amount:15},partiallyPaid,new Set(["b"]))).toBe(20);});
 it("nunca cobra seleção vazia nem item já pago",()=>{expect(getCodSelectionAmount(order,items,new Set())).toBe(0);expect(getCodSelectionAmount(order,items.map(item=>({...item,payment_status:"PAID"})),new Set(["a"]))).toBe(0);});
 it("fecha diferenças de arredondamento na última parcela",()=>{const thirds=[...items,{...items[0],id:"c"}];expect(getCodSelectionAmount({...order,total_amount:55,discount_amount:5},thirds,new Set(["a"]))).toBe(18.33);expect(getCodSelectionAmount({...order,total_amount:55,cod_received_amount:36.66},thirds.map(item=>item.id!=="c"?{...item,payment_status:"PAID"}:item),new Set(["c"]))).toBe(18.34);});
});
