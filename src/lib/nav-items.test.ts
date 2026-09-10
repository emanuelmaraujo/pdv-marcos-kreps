import { describe, expect, it } from "vitest";
import { isNavItemActive, isNavItemVisible, navItems } from "./nav-items";

const byHref = (href: string) => navItems.find((item) => item.href === href)!;

describe("isNavItemActive", () => {
  it("Início só acende na raiz do app", () => {
    const inicio = byHref("/app");
    expect(isNavItemActive(inicio, "/app")).toBe(true);
    expect(isNavItemActive(inicio, "/app/pedidos")).toBe(false);
  });

  it("item normal acende também nas sub-rotas", () => {
    const configuracoes = byHref("/app/configuracoes");
    expect(isNavItemActive(configuracoes, "/app/configuracoes/filiais")).toBe(true);
    expect(isNavItemActive(configuracoes, "/app/configuracoes/filiais/123")).toBe(true);
  });

  it("entregas e histórico do motoboy não acendem juntos", () => {
    const entregas = byHref("/app/motoboy");
    const historico = byHref("/app/motoboy/historico");

    expect(isNavItemActive(entregas, "/app/motoboy")).toBe(true);
    expect(isNavItemActive(entregas, "/app/motoboy/historico")).toBe(false);
    expect(isNavItemActive(historico, "/app/motoboy/historico")).toBe(true);
    expect(isNavItemActive(historico, "/app/motoboy")).toBe(false);
  });

  it("não acende por prefixo parcial de nome de rota", () => {
    expect(isNavItemActive(byHref("/app/pedidos"), "/app/pedidos-antigos")).toBe(false);
  });

  it("barra móvel mantém cardápio e configurações acessíveis para administradores", () => {
    const visible = navItems.filter((item) => item.showInBottomNav && isNavItemVisible(item, "ADMIN"));
    expect(visible).toHaveLength(6);
    expect(visible.map((item) => item.href)).toContain("/app/cardapio");
    expect(visible.at(-1)?.href).toBe("/app/configuracoes");
  });
});

describe("isNavItemVisible", () => {
  it("motoboy vê apenas as duas telas dele", () => {
    const visible = navItems.filter((item) => isNavItemVisible(item, "COURIER")).map((i) => i.href);
    expect(visible).toEqual(["/app/motoboy", "/app/motoboy/historico"]);
  });

  it("equipe da loja não vê as telas do motoboy", () => {
    for (const role of ["ADMIN", "ATTENDANT"] as const) {
      const visible = navItems.filter((item) => isNavItemVisible(item, role)).map((i) => i.href);
      expect(visible).not.toContain("/app/motoboy");
      expect(visible).not.toContain("/app/motoboy/historico");
    }
  });
});
