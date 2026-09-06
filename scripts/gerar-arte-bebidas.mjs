/**
 * Gera as ilustrações de bebida em public/cardapio/bebidas/.
 *
 * Por que arte própria em vez de foto de banco de imagem: são arquivos servidos
 * pelo próprio site (mesma origem), então nunca quebram por hotlink, host fora
 * do ar ou link de compartilhamento expirado — que é justamente o que derrubava
 * as fotos coladas por URL. Trocar por foto de verdade continua sendo só colar
 * o link no cadastro do produto.
 *
 * Rode com: node scripts/gerar-arte-bebidas.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "cardapio", "bebidas");

// Fundo comum: mantém todas as artes com a mesma "assinatura" no cardápio.
const backdrop = (tint) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FBF7F3"/>
      <stop offset="1" stop-color="#EDE4DA"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.45" r="0.5">
      <stop offset="0" stop-color="${tint}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${tint}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" fill="url(#bg)"/>
  <circle cx="200" cy="140" r="150" fill="url(#halo)"/>`;

const shadow = `<ellipse cx="200" cy="266" rx="74" ry="12" fill="#3A2A1E" opacity="0.16"/>`;

/**
 * O card do cardápio corta a arte em quadrado (56x56). Ampliar o objeto em
 * volta do centro faz a bebida ocupar o recorte em vez de virar um pontinho.
 */
const zoom = (scale, art) =>
  `<g transform="translate(200,150) scale(${scale}) translate(-200,-150)">${art}</g>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img">${body}\n</svg>\n`;

/** Copo de suco: líquido, brilho, canudo e enfeite na borda. */
function glass({ light, dark, garnish = "none", second = null, garnishLight = null, garnishDark = null }) {
  const gl = garnishLight ?? light;
  const gd = garnishDark ?? dark;
  const liquid = second
    ? `<linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.52" stop-color="${second}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`
    : `<linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;

  const garnishArt =
    garnish === "citrus"
      ? `<g transform="translate(246,86)">
      <circle r="24" fill="#FFF6E2" stroke="${gd}" stroke-width="4"/>
      <circle r="17" fill="${gl}"/>
      <g stroke="#FFF6E2" stroke-width="2.4" stroke-linecap="round">
        <path d="M0 0 L0 -16"/><path d="M0 0 L14 -8"/><path d="M0 0 L14 8"/>
        <path d="M0 0 L0 16"/><path d="M0 0 L-14 8"/><path d="M0 0 L-14 -8"/>
      </g>
    </g>`
      : garnish === "leaf"
        ? `<g transform="translate(243,84) rotate(-18)">
      <path d="M0 0 C 22 -22 48 -18 52 -2 C 40 16 12 18 0 0 Z" fill="#3E9B4F"/>
      <path d="M2 -1 C 20 -8 38 -6 50 -2" stroke="#2A6E37" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    </g>`
        : garnish === "berry"
          ? `<g transform="translate(248,88)">
      <path d="M0 -18 C 18 -18 26 -4 20 12 C 14 26 -14 26 -20 12 C -26 -4 -18 -18 0 -18 Z" fill="${gd}"/>
      <path d="M-3 -18 l-13 -9 l16 -1 l3 -10 l6 10 l15 2 l-13 8 Z" fill="#3E9B4F"/>
      <g fill="#FFF6E2" opacity="0.75"><circle cx="-6" cy="-2" r="1.8"/><circle cx="6" cy="3" r="1.8"/><circle cx="-2" cy="11" r="1.8"/><circle cx="9" cy="-8" r="1.8"/></g>
    </g>`
          : "";

  return svg(`${backdrop(light)}
  <defs>
    ${liquid}
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.55"/>
    </linearGradient>
    <clipPath id="cup"><path d="M150 74 L250 74 L238 246 C 237 256 228 262 200 262 C 172 262 163 256 162 246 Z"/></clipPath>
  </defs>
  ${zoom(1.18, `${shadow}
  <!-- canudo -->
  <path d="M214 46 L236 44 L244 66 L226 68 Z" fill="#E4573D" opacity="0.9"/>
  <path d="M214 46 L204 150" stroke="#E4573D" stroke-width="11" stroke-linecap="round"/>
  <path d="M150 74 L250 74 L238 246 C 237 256 228 262 200 262 C 172 262 163 256 162 246 Z" fill="#FFFFFF" opacity="0.55"/>
  <g clip-path="url(#cup)">
    <rect x="150" y="104" width="100" height="160" fill="url(#liq)"/>
    <ellipse cx="200" cy="105" rx="50" ry="9" fill="#FFFFFF" opacity="0.35"/>
    <rect x="150" y="74" width="100" height="188" fill="url(#glass)"/>
    <path d="M166 118 L176 118 L172 238 L162 238 Z" fill="#FFFFFF" opacity="0.45"/>
  </g>
  <path d="M150 74 L250 74 L238 246 C 237 256 228 262 200 262 C 172 262 163 256 162 246 Z" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.9"/>
  <ellipse cx="200" cy="74" rx="50" ry="10" fill="#FFFFFF" opacity="0.9"/>
  ${garnishArt}`)}`);
}

/** Lata 350ml. */
function can({ body, bodyDark, band, text }) {
  return svg(`${backdrop(body)}
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8E949B"/><stop offset="0.35" stop-color="#EEF1F4"/><stop offset="1" stop-color="#9AA1A8"/>
    </linearGradient>
    <linearGradient id="bodyg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${bodyDark}"/><stop offset="0.32" stop-color="${body}"/>
      <stop offset="0.52" stop-color="${body}"/><stop offset="1" stop-color="${bodyDark}"/>
    </linearGradient>
  </defs>
  ${zoom(1.22, `${shadow}
  <path d="M152 76 h96 v150 a10 10 0 0 1 -6 9 c -12 5 -72 5 -84 0 a10 10 0 0 1 -6 -9 Z" fill="url(#bodyg)"/>
  <path d="M152 76 h96 v14 c -12 6 -84 6 -96 0 Z" fill="url(#metal)"/>
  <ellipse cx="200" cy="76" rx="48" ry="11" fill="url(#metal)"/>
  <ellipse cx="200" cy="76" rx="38" ry="8" fill="#B9C0C7"/>
  <path d="M182 74 q18 -8 34 2" stroke="#8E949B" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="152" y="128" width="96" height="46" fill="${band}"/>
  <path d="M152 128 c 30 14 66 -14 96 0 v 12 c -30 -14 -66 14 -96 0 Z" fill="${text}" opacity="0.9"/>
  <rect x="164" y="90" width="12" height="140" fill="#FFFFFF" opacity="0.22"/>
  <rect x="228" y="90" width="7" height="140" fill="#000000" opacity="0.12"/>
  <path d="M152 226 c 12 8 84 8 96 0 v 4 a10 10 0 0 1 -6 9 c -12 5 -72 5 -84 0 a10 10 0 0 1 -6 -9 Z" fill="url(#metal)" opacity="0.8"/>`)}`);
}

/** Garrafa PET 600ml. */
function bottle({ liquid, liquidDark, label, labelDark, cap }) {
  return svg(`${backdrop(label)}
  <defs>
    <linearGradient id="liq" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${liquidDark}"/><stop offset="0.3" stop-color="${liquid}"/>
      <stop offset="0.55" stop-color="${liquid}"/><stop offset="1" stop-color="${liquidDark}"/>
    </linearGradient>
    <linearGradient id="lbl" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${labelDark}"/><stop offset="0.32" stop-color="${label}"/>
      <stop offset="0.55" stop-color="${label}"/><stop offset="1" stop-color="${labelDark}"/>
    </linearGradient>
    <clipPath id="btl"><path d="M182 44 h36 v20 c 0 10 12 14 12 30 v152 c 0 12 -10 20 -30 20 c -20 0 -30 -8 -30 -20 V94 c 0 -16 12 -20 12 -30 Z"/></clipPath>
  </defs>
  ${zoom(1.12, `${shadow}
  <g clip-path="url(#btl)">
    <rect x="160" y="40" width="80" height="230" fill="url(#liq)"/>
    <rect x="160" y="40" width="80" height="34" fill="#FFFFFF" opacity="0.28"/>
    <rect x="150" y="134" width="100" height="76" fill="url(#lbl)"/>
    <path d="M150 148 c 26 16 74 -16 100 0 v 10 c -26 -16 -74 16 -100 0 Z" fill="#FFFFFF" opacity="0.85"/>
    <rect x="176" y="46" width="9" height="222" fill="#FFFFFF" opacity="0.3"/>
    <rect x="224" y="46" width="6" height="222" fill="#000000" opacity="0.12"/>
  </g>
  <path d="M182 44 h36 v20 c 0 10 12 14 12 30 v152 c 0 12 -10 20 -30 20 c -20 0 -30 -8 -30 -20 V94 c 0 -16 12 -20 12 -30 Z" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-opacity="0.75"/>
  <rect x="178" y="28" width="44" height="22" rx="5" fill="${cap}"/>
  <rect x="178" y="28" width="44" height="22" rx="5" fill="#FFFFFF" opacity="0.15"/>`)}`);
}

const files = {
  // Refrigerantes
  "refri-cola-lata.svg": can({ body: "#D81E36", bodyDark: "#7E0B1A", band: "#FFFFFF", text: "#D81E36" }),
  "refri-cola-lata-zero.svg": can({ body: "#23272B", bodyDark: "#0B0D0F", band: "#D81E36", text: "#FFFFFF" }),
  "refri-guarana-lata.svg": can({ body: "#12925A", bodyDark: "#075436", band: "#FFFFFF", text: "#12925A" }),
  "refri-guarana-lata-zero.svg": can({ body: "#12361F", bodyDark: "#06180E", band: "#12925A", text: "#FFFFFF" }),
  "refri-cola-600.svg": bottle({ liquid: "#4A2418", liquidDark: "#22100A", label: "#D81E36", labelDark: "#7E0B1A", cap: "#D81E36" }),
  "refri-cola-600-zero.svg": bottle({ liquid: "#4A2418", liquidDark: "#22100A", label: "#23272B", labelDark: "#0B0D0F", cap: "#23272B" }),
  "refri-guarana-600.svg": bottle({ liquid: "#D08A34", liquidDark: "#8B5316", label: "#12925A", labelDark: "#075436", cap: "#12925A" }),
  "refri-guarana-600-zero.svg": bottle({ liquid: "#D08A34", liquidDark: "#8B5316", label: "#12361F", labelDark: "#06180E", cap: "#12361F" }),
  "agua-saborizada.svg": bottle({ liquid: "#CBE9F7", liquidDark: "#8FC9E4", label: "#2E9BD6", labelDark: "#17679A", cap: "#2E9BD6" }),
  // Sucos
  "suco-laranja.svg": glass({ light: "#FFA935", dark: "#EF6C0C", garnish: "citrus" }),
  "suco-limao.svg": glass({ light: "#D7EE86", dark: "#6FB53A", garnish: "citrus" }),
  "suco-morango.svg": glass({ light: "#FF8FA6", dark: "#DC2A4C", garnish: "berry" }),
  "suco-acerola.svg": glass({ light: "#FF7A61", dark: "#CC2020", garnish: "berry" }),
  "suco-caju.svg": glass({ light: "#FFD35C", dark: "#EFA010", garnish: "none" }),
  "suco-caja.svg": glass({ light: "#FFBE55", dark: "#E5851B", garnish: "leaf" }),
  "suco-manga.svg": glass({ light: "#FFC65A", dark: "#F5871F", garnish: "leaf" }),
  "suco-maracuja.svg": glass({ light: "#FFDD63", dark: "#E9A008", garnish: "leaf" }),
  "suco-abacaxi-hortela.svg": glass({ light: "#FFE873", dark: "#E7B303", garnish: "leaf" }),
  "suco-cupuacu.svg": glass({ light: "#FFF3DC", dark: "#DCC49A", garnish: "none" }),
  "suco-acai.svg": glass({ light: "#8E5BC8", dark: "#43206E", garnish: "berry" }),
  "suco-uva.svg": glass({ light: "#9B5BC0", dark: "#5A1E73", garnish: "berry" }),
  "suco-goiaba.svg": glass({ light: "#FF9E8C", dark: "#DC4A38", garnish: "leaf" }),
  "suco-laranja-morango.svg": glass({ light: "#FFB13C", second: "#FF7E7E", dark: "#DC2A4C", garnish: "citrus" }),
  "suco-laranja-acerola.svg": glass({ light: "#FFB13C", second: "#FF8A5B", dark: "#CC2020", garnish: "citrus" }),
  "soda-italiana.svg": glass({ light: "#8ED9F6", second: "#C79BE8", dark: "#E8609F", garnish: "citrus", garnishLight: "#FFB3CE", garnishDark: "#E8609F" }),
  "suco-natural.svg": glass({ light: "#FFCB5E", dark: "#F08A1D", garnish: "leaf" }),
};

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  writeFileSync(resolve(OUT, name), content);
}
console.log(`${Object.keys(files).length} ilustrações geradas em ${OUT}`);
