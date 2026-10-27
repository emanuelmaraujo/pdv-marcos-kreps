import { describe, expect, it } from "vitest";
import { parseFunnelInput, funnelSource, readFunnelJson } from "./public-funnel";
const base={consent:true,event_id:"f2210000-0000-4000-8000-000000000001",event_name:"menu_view",branch_slug:"fixture-cod-a",order_type:"ENTREGA",device:"MOBILE",source:"DIRECT"};
describe("funil público sem campos pessoais",()=>{
 it("aceita somente contrato mínimo com consentimento",()=>{expect(parseFunnelInput(base)).toEqual(base);expect(()=>parseFunnelInput({...base,consent:false})).toThrow();});
 it.each(["phone","customer_name","address","postal_code","public_token","url","utm_campaign","error_message"])("recusa campo livre %s",field=>expect(()=>parseFunnelInput({...base,[field]:"conteúdo privado"})).toThrow());
 it.each(["order_created","payment_approved","cod_order_confirmed","cod_payment_received"])("cliente não pode forjar %s",event_name=>expect(()=>parseFunnelInput({...base,event_name})).toThrow());
 it("categoriza origem sem transmitir UTM livre",()=>{expect(funnelSource("?utm_source=instagram")).toBe("INSTAGRAM");expect(funnelSource("?utm_source=person@example.invalid")).toBe("OTHER");expect(funnelSource("?utm_campaign=nome-telefone")).toBe("DIRECT");expect(funnelSource("?utm_medium=qrcode")).toBe("QR");});
 it("nega enums e identificadores arbitrários",()=>{expect(()=>parseFunnelInput({...base,device:"390x844"})).toThrow();expect(()=>parseFunnelInput({...base,error_category:"telefone inválido"})).toThrow();expect(()=>parseFunnelInput({...base,product_id:"free text"})).toThrow();});
});

it("limita corpos em bytes mesmo sem Content-Length",async()=>{
 const request=new Request("http://127.0.0.1",{method:"POST",body:JSON.stringify({text:"x".repeat(3000)})});
 await expect(readFunnelJson(request)).rejects.toBeInstanceOf(RangeError);
});
