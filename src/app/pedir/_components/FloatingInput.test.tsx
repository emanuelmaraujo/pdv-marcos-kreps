import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FloatingInput } from "./FloatingInput";

const base: ComponentProps<typeof FloatingInput> = {
  label: "WhatsApp com DDD (opcional)", value: "", onChange: () => {},
};
const render = (overrides: Partial<typeof base>) => renderToStaticMarkup(createElement(FloatingInput, { ...base, ...overrides }));
const attr = (html: string, name: string) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1];

describe("campo do checkout público", () => {
  it("associa o rótulo ao input e repassa autocomplete/teclado", () => {
    const html = render({ autoComplete: "tel", type: "tel", inputMode: "tel", name: "tel" });
    const id = attr(html, "id");
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('autoComplete="tel"');
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain('type="tel"');
  });

  it("liga ajuda e erro ao campo por aria-describedby", () => {
    const html = render({ help: "Usamos para avisos do pedido.", error: "Número incompleto." });
    const describedBy = attr(html, "aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    for (const ref of describedBy) expect(html).toContain(`id="${ref}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
  });

  it("não marca inválido nem cria região de erro sem erro", () => {
    const html = render({ error: null });
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain('role="alert"');
  });
});
