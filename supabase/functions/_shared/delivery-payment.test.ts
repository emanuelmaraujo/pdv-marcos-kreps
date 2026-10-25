import { describe, expect, it } from "vitest";
import { parsePublicPaymentOption } from "./delivery-payment";
describe("opção de pagamento público", () => {
  it("preserva contratos online antigos", () => expect(parsePublicPaymentOption({})).toEqual({timing:"ONLINE",method:null,change:null}));
  it.each(["CASH","PIX","DEBIT_CARD","CREDIT_CARD"])("aceita %s somente na entrega", method => {
    expect(parsePublicPaymentOption({payment_timing:"ON_DELIVERY",order_type:"ENTREGA",expected_payment_method:method}).method).toBe(method);
    expect(()=>parsePublicPaymentOption({payment_timing:"ON_DELIVERY",order_type:"VIAGEM",expected_payment_method:method})).toThrow();
  });
  it.each(["IFOOD","PENDING","COURTESY","fake",null])("recusa meio presencial %s", method => expect(()=>parsePublicPaymentOption({payment_timing:"ON_DELIVERY",order_type:"ENTREGA",expected_payment_method:method})).toThrow());
  it.each([NaN,Infinity,-1,12.345,"50",100001])("valida valor para troco %s", change => expect(()=>parsePublicPaymentOption({payment_timing:"ON_DELIVERY",order_type:"ENTREGA",expected_payment_method:"CASH",cash_change_for:change})).toThrow());
  it("não aceita troco em cartão ou opção presencial em online", () => {
    expect(()=>parsePublicPaymentOption({payment_timing:"ON_DELIVERY",order_type:"ENTREGA",expected_payment_method:"DEBIT_CARD",cash_change_for:50})).toThrow();
    expect(()=>parsePublicPaymentOption({expected_payment_method:"CASH"})).toThrow();
  });
});
