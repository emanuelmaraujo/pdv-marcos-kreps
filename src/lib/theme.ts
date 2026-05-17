"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pdv_theme";

/**
 * Lê o tema persistido (ou system) e aplica `data-theme` no <html>.
 * Use `useTheme()` em qualquer componente client. O `ThemeBootstrap`
 * script (em layout.tsx) já aplica o tema antes do React montar para
 * evitar flash branco no carregamento inicial.
 */
export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Theme | null;
    const initial: Theme = stored ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  };

  const toggle = () => setTheme(theme === "light" ? "dark" : "light");

  return { theme, toggle, setTheme };
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
}

/**
 * Script inline para aplicar o tema ANTES do React montar, evitando
 * flash do tema errado. Cole o `THEME_BOOTSTRAP_SCRIPT` em um
 * <script dangerouslySetInnerHTML> no <head> do layout raiz.
 */
export const THEME_BOOTSTRAP_SCRIPT = `
(function(){
  try {
    var k = "${STORAGE_KEY}";
    var stored = localStorage.getItem(k);
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {}
})();
`;
