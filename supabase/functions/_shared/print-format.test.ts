import { describe, expect, it } from "vitest";
import { buildCustomerReceipt } from "./print-format";

const items = [{ quantity: 2, product_name_snapshot: "Krep", product_price_snapshot: 20, production_sector: "KITCHEN" }];
const base = { daily_number: 7, type: "ENTREGA", total_amount: 45, delivery_fee: 5, payment_method: "PIX", payment_status: "PENDING" };

describe("via do cliente com pagamento na entrega", () => {
  it("orienta a cobrança do saldo sem sugerir pagamento online", () => {
    const text = buildCustomerReceipt({ ...base, payment_timing: "ON_DELIVERY", expected_payment_method: "CASH", cash_change_for: 50, cod_received_amount: 0 }, items);
    expect(text).toContain("PAGAMENTO NA ENTREGA - NAO PAGO");
    expect(text).toMatch(/COBRAR NA ENTREGA: R\$\s?45,00/);
    expect(text).toContain("Forma combinada: Dinheiro");
    expect(text).toMatch(/Troco para: R\$\s?50,00/);
    expect(text).not.toMatch(/Forma: PIX|PENDING|CASH/);
  });
  it("cobra só o saldo após recebimento parcial e marca quitado depois", () => {
    expect(buildCustomerReceipt({ ...base, payment_timing: "ON_DELIVERY", expected_payment_method: "PIX", cod_received_amount: 15 }, items)).toMatch(/COBRAR NA ENTREGA: R\$\s?30,00/);
    const paid = buildCustomerReceipt({ ...base, payment_timing: "ON_DELIVERY", expected_payment_method: "PIX", payment_status: "PAID" }, items);
    expect(paid).toContain("recebido na entrega");
    expect(paid).not.toContain("COBRAR");
  });
  it("mantém o texto do pagamento online", () => {
    expect(buildCustomerReceipt({ ...base, payment_status: "PAID" }, items)).toContain("Forma: PIX");
  });
});
