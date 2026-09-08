import { describe, expect, it } from "vitest";
import { parseBranchPrinterConfig, shouldPrint } from "./branch-print-cfg";

describe("branch print context", () => {
  it("mantém compatibilidade quando a filial não possui filtros de contexto", () => {
    const config = parseBranchPrinterConfig({ customer: { enabled: true } });
    expect(shouldPrint(true, config, "customer", "BALCAO", "APP")).toBe(true);
  });

  it("filtra por tipo e origem do pedido", () => {
    const config = parseBranchPrinterConfig({
      customer: {
        enabled: true,
        order_types: ["ENTREGA"],
        order_sources: ["ATTENDANT", "APP"],
      },
    });

    expect(shouldPrint(true, config, "customer", "ENTREGA", "ATTENDANT")).toBe(true);
    expect(shouldPrint(true, config, "customer", "BALCAO", "ATTENDANT")).toBe(false);
    expect(shouldPrint(true, config, "customer", "ENTREGA", "QR_CODE")).toBe(false);
  });

  it("respeita bloqueios globais e da filial", () => {
    expect(shouldPrint(false, {}, "kitchen", "VIAGEM", "ATTENDANT")).toBe(false);
    expect(shouldPrint(true, { kitchen: { enabled: false } }, "kitchen", "VIAGEM", "ATTENDANT")).toBe(false);
  });
});
