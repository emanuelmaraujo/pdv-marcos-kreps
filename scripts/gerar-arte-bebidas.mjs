/**
 * Gera as ilustrações do cardápio público em public/cardapio/.
 *
 * - bebidas/*.svg: sucos, refrigerantes e água. Os nomes de arquivo são os mesmos
 *   gravados em products.image_url pela migration 20260905120000_bebidas_foto_padrao,
 *   então regerar troca a arte sem mexer no banco.
 * - fallback/*.svg: krep salgado, krep doce e porção de batata, usados pela UI só
 *   quando o produto não tem foto cadastrada (não vão para o banco).
 *
 * Família visual aprovada na #235 (docs/archive/studies/proposta-pedir-issue-235.md):
 * canvas quadrado, fundo bege radial, vermelho da marca em canudo, luva e caixa.
 * Por que arte própria em vez de foto de banco de imagem: arquivos da mesma origem
 * nunca quebram por hotlink ou link expirado. Trocar por foto de verdade continua
 * sendo só colar o link no cadastro do produto.
 *
 * Rode com: node scripts/gerar-arte-bebidas.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "cardapio");

const BRAND = "#E73335";
const LEAF = "#4F7A35";

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="480" height="480" role="img">\n${body}\n</svg>\n`;

// Fundo comum: mesma "assinatura" bege em todos os cards.
const backdrop = `<defs>
    <radialGradient id="bg" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#FFF9F0"/><stop offset=".6" stop-color="#F6EAD8"/><stop offset="1" stop-color="#EEDDC5"/></radialGradient>
    <radialGradient id="shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1E1008" stop-opacity=".22"/><stop offset="1" stop-color="#1E1008" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="120" height="120" fill="url(#bg)"/>`;

const shadow = (rx = 24) => `<ellipse cx="60" cy="109" rx="${rx}" ry="3.8" fill="url(#shadow)"/>`;

// ── Guarnições da borda do copo ───────────────────────────────────────────────
const garnishes = {
  none: () => "",
  citrus: ({ fruit, fruitIn }) => `<circle cx="84" cy="27" r="13" fill="${fruit}"/><circle cx="84" cy="27" r="10" fill="${fruitIn}"/>
  <g stroke="${fruit}" stroke-width="1.3" opacity=".8"><path d="M84 17 V37"/><path d="M74 27 H94"/><path d="M77 20 L91 34"/><path d="M91 20 L77 34"/></g><circle cx="84" cy="27" r="2" fill="${fruit}"/>`,
  berry: ({ fruit }) => `<g transform="translate(84 25) rotate(20)"><path d="M0 12 C-9 4 -9 -6 0 -6 C9 -6 9 4 0 12 Z" fill="${fruit}"/><path d="M-5 -6 L-1.5 -10 L0 -6 L1.5 -10 L5 -6 Z" fill="${LEAF}"/>
  <g fill="#FFE08A"><circle cx="-3" cy="-1" r=".9"/><circle cx="2.5" cy="0" r=".9"/><circle cx="-.5" cy="5" r=".9"/><circle cx="3" cy="-3.5" r=".8"/></g></g>`,
  round: ({ fruit, fruitIn }) => `<circle cx="80" cy="28" r="6.5" fill="${fruit}"/><circle cx="90" cy="31" r="5.8" fill="${fruitIn}"/>
  <circle cx="78" cy="26" r="1.8" fill="#fff" opacity=".55"/><circle cx="88" cy="29" r="1.6" fill="#fff" opacity=".55"/><path d="M83 21 C86 16 92 15 96 18 C92 22 87 22 83 21 Z" fill="${LEAF}"/>`,
  grapes: ({ fruit, fruitIn }) => `<g fill="${fruit}"><circle cx="80" cy="22" r="4"/><circle cx="88" cy="22" r="4"/><circle cx="84" cy="28" r="4"/><circle cx="92" cy="28" r="3.6" fill="${fruitIn}"/><circle cx="88" cy="34" r="3.6"/></g>
  <path d="M84 18 C86 13 92 12 95 15" stroke="${LEAF}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  passion: () => `<circle cx="84" cy="27" r="13" fill="#7A3E6A"/><circle cx="84" cy="27" r="10.5" fill="#F7C62F"/>
  <g fill="#3B2410"><circle cx="80" cy="24" r="1.6"/><circle cx="86" cy="22" r="1.6"/><circle cx="88" cy="28" r="1.6"/><circle cx="83" cy="30" r="1.6"/><circle cx="78" cy="29" r="1.4"/><circle cx="85" cy="34" r="1.4"/></g>`,
  mango: () => `<path d="M73 30 C72 18 84 12 94 18 C99 24 96 36 84 38 C78 38 74 35 73 30 Z" fill="#F59E0B"/>
  <g stroke="#FDE68A" stroke-width="1.4" fill="none"><path d="M78 20 L92 34"/><path d="M84 16 L96 28"/><path d="M90 18 L76 32"/><path d="M95 22 L81 37"/></g>`,
  pineapple: () => `<path d="M72 34 L92 16 L98 36 Z" fill="#F7D74A"/><path d="M92 16 L98 36 L101 35 L95 14 Z" fill="#B7791F"/>
  <g stroke="#E3B62F" stroke-width="1"><path d="M80 31 L95 22"/><path d="M84 34 L96 27"/></g>
  <path d="M74 32 C66 26 68 16 78 14 C81 22 80 29 74 32 Z" fill="#5E9B45"/><path d="M74 32 C76 25 77 19 78 14" stroke="#3F7A2E" stroke-width="1.1" fill="none"/>`,
  leaf: () => `<path d="M76 34 C68 26 72 14 84 14 C86 24 84 32 76 34 Z" fill="#5E9B45"/><path d="M76 34 C78 26 81 20 84 14" stroke="#3F7A2E" stroke-width="1.2" fill="none"/>
  <path d="M82 36 C88 30 96 32 98 40 C90 44 84 42 82 36 Z" fill="#6FAE52"/>`,
};

/** Copo de suco: líquido na cor do sabor, gelo, canudo listrado e fruta na borda. */
function glass({ juice, top, second = null, garnish = "none", fruit = juice, fruitIn = top }) {
  const liquid = second
    ? `<linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${juice}"/><stop offset=".55" stop-color="${second}"/><stop offset="1" stop-color="${second}"/></linearGradient>`
    : `<linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${juice}"/><stop offset="1" stop-color="${juice}"/></linearGradient>`;
  return svg(`${backdrop}
  <defs>${liquid}
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".18" stop-color="#fff" stop-opacity=".45"/><stop offset=".32" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
  </defs>
  ${shadow()}
  <path d="M71 8 L61 70" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <path d="M71 8 L61 70" stroke="${BRAND}" stroke-width="5" stroke-dasharray="5 5"/>
  <path d="M40.5 46 L45.5 102.5 Q46.3 106 50 106 L70 106 Q73.7 106 74.5 102.5 L79.5 46 Z" fill="url(#liq)"/>
  <ellipse cx="60" cy="46" rx="19.5" ry="3.2" fill="${top}"/>
  <rect x="47" y="47" width="11" height="10" rx="2.5" fill="#fff" opacity=".42" transform="rotate(-14 52 52)"/>
  <rect x="61" y="51" width="10" height="9" rx="2.5" fill="#fff" opacity=".35" transform="rotate(12 66 55)"/>
  <path d="M37 28 L44 103 Q45 108.5 50 108.5 L70 108.5 Q75 108.5 76 103 L83 28 Z" fill="url(#shine)" stroke="#D8CDBF" stroke-width="1.4"/>
  <ellipse cx="60" cy="28" rx="23" ry="3.4" fill="#FFFFFF" fill-opacity=".5" stroke="#D8CDBF" stroke-width="1.4"/>
  ${garnishes[garnish]({ fruit, fruitIn })}`);
}

/** Lata 350 ml, no mesmo enquadramento dos copos. */
function can({ body, bodyDark, band, text }) {
  return svg(`${backdrop}
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E949B"/><stop offset=".35" stop-color="#EEF1F4"/><stop offset="1" stop-color="#9AA1A8"/></linearGradient>
    <linearGradient id="bodyg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${bodyDark}"/><stop offset=".32" stop-color="${body}"/><stop offset=".52" stop-color="${body}"/><stop offset="1" stop-color="${bodyDark}"/></linearGradient>
  </defs>
  ${shadow(22)}
  <path d="M40 26 h40 v74 a5 5 0 0 1 -3 4.5 c-6 2.5 -28 2.5 -34 0 a5 5 0 0 1 -3 -4.5 Z" fill="url(#bodyg)"/>
  <path d="M40 26 h40 v6 c-6 3 -34 3 -40 0 Z" fill="url(#metal)"/>
  <ellipse cx="60" cy="26" rx="20" ry="4.6" fill="url(#metal)"/>
  <ellipse cx="60" cy="26" rx="15.5" ry="3.3" fill="#B9C0C7"/>
  <path d="M53 25 q7 -3.4 14 .8" stroke="#8E949B" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <rect x="40" y="52" width="40" height="22" fill="${band}"/>
  <path d="M40 52 c12 6 28 -6 40 0 v6 c-12 -6 -28 6 -40 0 Z" fill="${text}" opacity=".9"/>
  <rect x="45" y="32" width="5" height="70" fill="#FFFFFF" opacity=".22"/>
  <rect x="72" y="32" width="3" height="70" fill="#000000" opacity=".12"/>`);
}

/** Garrafa PET 600 ml, no mesmo enquadramento dos copos. */
function bottle({ liquid, liquidDark, label, labelDark, cap }) {
  const outline = "M52 18 h16 v9 c0 4.5 6 6.5 6 13.5 v58 c0 5.5 -5 8.5 -14 8.5 c-9 0 -14 -3 -14 -8.5 v-58 c0 -7 6 -9 6 -13.5 Z";
  return svg(`${backdrop}
  <defs>
    <linearGradient id="liqb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${liquidDark}"/><stop offset=".3" stop-color="${liquid}"/><stop offset=".55" stop-color="${liquid}"/><stop offset="1" stop-color="${liquidDark}"/></linearGradient>
    <linearGradient id="lbl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${labelDark}"/><stop offset=".32" stop-color="${label}"/><stop offset=".55" stop-color="${label}"/><stop offset="1" stop-color="${labelDark}"/></linearGradient>
    <clipPath id="btl"><path d="${outline}"/></clipPath>
  </defs>
  ${shadow(20)}
  <g clip-path="url(#btl)">
    <rect x="44" y="16" width="32" height="94" fill="url(#liqb)"/>
    <rect x="44" y="16" width="32" height="15" fill="#FFFFFF" opacity=".28"/>
    <rect x="44" y="58" width="32" height="30" fill="url(#lbl)"/>
    <path d="M44 63 c10 6 22 -6 32 0 v4 c-10 -6 -22 6 -32 0 Z" fill="#FFFFFF" opacity=".85"/>
    <rect x="51" y="20" width="4" height="88" fill="#FFFFFF" opacity=".3"/>
  </g>
  <path d="${outline}" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-opacity=".75"/>
  <rect x="51" y="10" width="18" height="9" rx="2.2" fill="${cap}"/>
  <rect x="51" y="10" width="18" height="9" rx="2.2" fill="#FFFFFF" opacity=".15"/>`);
}

// ── Kreps e batata (fallback sem foto) ────────────────────────────────────────
const coneDefs = `<linearGradient id="crepe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D9A055"/><stop offset=".45" stop-color="#F6D597"/><stop offset="1" stop-color="#CE9147"/></linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9B66A"/><stop offset="1" stop-color="#B97B36"/></linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#EFE6DA"/><stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6DACB"/></linearGradient>`;
const coneBack = `<path d="M29 38 A31 5.5 0 0 1 91 38" fill="#C98A40" stroke="#B97B36" stroke-width="2"/>`;
const cone = `<ellipse cx="60" cy="110" rx="22" ry="4" fill="url(#shadow)"/>
  <path d="M29 38 L60 108 L91 38 Z" fill="url(#crepe)"/>
  <path d="M33 46 C48 52 70 50 86 44" fill="none" stroke="#B97B36" stroke-width="1.3" opacity=".5"/>
  <path d="M38 57 C52 62 68 61 81 55" fill="none" stroke="#B97B36" stroke-width="1.2" opacity=".45"/>
  <circle cx="47" cy="49" r="2.2" fill="#B97B36" opacity=".28"/><circle cx="72" cy="52" r="1.8" fill="#B97B36" opacity=".28"/><circle cx="58" cy="44" r="1.5" fill="#B97B36" opacity=".25"/>
  <path d="M41 64 L60 108 L79 64 C67 69 53 69 41 64 Z" fill="url(#paper)"/>
  <path d="M44.5 72 C55 76 65 76 75.5 72 L73.6 76.4 C64 80 56 80 46.4 76.4 Z" fill="${BRAND}"/>
  <path d="M49 84 C56 86.5 64 86.5 71 84" fill="none" stroke="${BRAND}" stroke-width="1.2" opacity=".55"/>
  <path d="M41 64 C53 69 67 69 79 64" fill="none" stroke="#D8CBBB" stroke-width="1"/>`;
const coneFront = `<path d="M29 38 A31 5.5 0 0 0 91 38" fill="none" stroke="url(#rim)" stroke-width="3" stroke-linecap="round"/>`;

const berry = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 9 C-7 3 -7 -5 0 -5 C7 -5 7 3 0 9 Z" fill="#DC2F3A"/><path d="M-4 -5 L-1 -8 L0 -5 L1 -8 L4 -5 Z" fill="${LEAF}"/>
  <g fill="#FFE08A"><circle cx="-2.5" cy="-1" r=".7"/><circle cx="2" cy="0" r=".7"/><circle cx="-.5" cy="3.5" r=".7"/><circle cx="2.5" cy="-3" r=".6"/></g></g>`;

const krepSalgado = svg(`${backdrop}
  <defs>${coneDefs}<linearGradient id="cheese" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4D2"/><stop offset="1" stop-color="#F2D891"/></linearGradient></defs>
  ${coneBack}
  <path d="M30 38 C34 22 50 18 60 22 C70 17 87 22 90 38 Z" fill="url(#cheese)"/>
  <path d="M38 30 c2-5 9-5 10 0" fill="#F2D891"/><path d="M66 27 c3-5 10-4 10 1" fill="#F2D891"/>
  <ellipse cx="45" cy="31" rx="5.2" ry="4" fill="#B23A2B"/><ellipse cx="45" cy="31" rx="2.6" ry="1.8" fill="#D2604E"/>
  <ellipse cx="63" cy="26" rx="5.2" ry="4" fill="#B23A2B"/><ellipse cx="63" cy="26" rx="2.6" ry="1.8" fill="#D2604E"/>
  <ellipse cx="78" cy="33" rx="4.6" ry="3.6" fill="#B23A2B"/>
  <path d="M53 33 q3-4 6 0" stroke="${LEAF}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M70 36 q2-3 5 0" stroke="${LEAF}" stroke-width="2" fill="none" stroke-linecap="round"/>
  ${cone}
  ${coneFront}`);

const krepDoce = svg(`${backdrop}
  <defs>${coneDefs}<linearGradient id="choc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A3418"/><stop offset="1" stop-color="#3B1A0B"/></linearGradient></defs>
  ${coneBack}
  <path d="M30 38 C33 24 47 19 60 23 C73 18 88 24 90 38 Z" fill="url(#choc)"/>
  ${berry(48, 20, -18)}${berry(70, 20, 16)}
  <g fill="#FFF"><circle cx="55" cy="30" r="1.1"/><circle cx="74" cy="31" r="1.1"/><circle cx="40" cy="33" r="1.1"/><circle cx="62" cy="34" r="1.1"/></g>
  ${cone}
  <path d="M33 42 C36 50 40 44 43 51 C46 57 49 47 52 52" fill="none" stroke="#3B1A0B" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M74 43 C77 51 81 45 84 50" fill="none" stroke="#3B1A0B" stroke-width="2.4" stroke-linecap="round"/>
  ${coneFront}`);

const fries = [[36, 24, 7, 44, -16], [44, 16, 7, 50, -9], [52, 8, 7, 58, -3], [60, 13, 7, 53, 4], [68, 9, 7, 57, 8], [76, 20, 7, 46, 15], [48, 26, 6.5, 40, -22], [64, 22, 6.5, 44, 19], [56, 18, 6.5, 48, -12], [71, 28, 6.5, 38, 26]]
  .map(([x, y, w, h, r]) => `<g transform="rotate(${r} ${x + w / 2} ${y + h / 2 + 18})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#fry)"/><rect x="${x}" y="${y}" width="${w}" height="3.5" rx="1.5" fill="#D99A2B" opacity=".75"/></g>`)
  .join("");
const stripes = [0, 1, 2, 3, 4]
  .map((i) => `<path d="M${(35 + i * 11.6).toFixed(1)} 58 L${(39.4 + i * 11.6).toFixed(1)} 58 L${(45.6 + i * 6.8).toFixed(1)} 106 L${(43.4 + i * 6.8).toFixed(1)} 106 Z"/>`)
  .join("");
const batata = svg(`${backdrop}
  <defs>
    <linearGradient id="fry" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9A93A"/><stop offset=".25" stop-color="#F8D670"/><stop offset="1" stop-color="#F3C653"/></linearGradient>
    <clipPath id="box"><path d="M32 58 L43 106 L77 106 L88 58 C72 65 48 65 32 58 Z"/></clipPath>
  </defs>
  ${shadow(28)}
  ${fries}
  <path d="M32 58 L43 106 L77 106 L88 58 C72 65 48 65 32 58 Z" fill="#FFFFFF"/>
  <g clip-path="url(#box)" fill="${BRAND}">${stripes}</g>
  <path d="M32 58 C48 65 72 65 88 58 L87 62 C72 69 48 69 33 62 Z" fill="#F1E8DC"/>
  <path d="M32 58 L43 106 L77 106 L88 58" fill="none" stroke="#D8CBBB" stroke-width="1.2"/>
  <path d="M32 58 C48 65 72 65 88 58" fill="none" stroke="#C9B9A6" stroke-width="1.6"/>`);

const bebidas = {
  // Refrigerantes e água
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
  "suco-laranja.svg": glass({ juice: "#F59324", top: "#FBB454", garnish: "citrus", fruit: "#F97316", fruitIn: "#FDBA74" }),
  "suco-limao.svg": glass({ juice: "#C9DE7A", top: "#DDEBA6", garnish: "citrus", fruit: "#7CB342", fruitIn: "#DCEDC8" }),
  "suco-morango.svg": glass({ juice: "#E04A5F", top: "#EF7A8A", garnish: "berry", fruit: "#DC2F3A" }),
  "suco-acerola.svg": glass({ juice: "#E8552F", top: "#F27F5E", garnish: "round", fruit: "#C62828", fruitIn: "#E53935" }),
  "suco-caju.svg": glass({ juice: "#F6C445", top: "#FAD77A", garnish: "round", fruit: "#E8452F", fruitIn: "#F28C28" }),
  "suco-caja.svg": glass({ juice: "#F5A83A", top: "#F9C06C", garnish: "round", fruit: "#F0A030", fruitIn: "#F6BE52" }),
  "suco-manga.svg": glass({ juice: "#F7B32B", top: "#FBCB64", garnish: "mango" }),
  "suco-maracuja.svg": glass({ juice: "#F5C431", top: "#FADB70", garnish: "passion" }),
  "suco-abacaxi-hortela.svg": glass({ juice: "#F1DC6B", top: "#F7E99E", garnish: "pineapple" }),
  "suco-cupuacu.svg": glass({ juice: "#EFE0C2", top: "#F7EEDB", garnish: "leaf" }),
  "suco-acai.svg": glass({ juice: "#5B2A73", top: "#7D4A96", garnish: "grapes", fruit: "#3E1A52", fruitIn: "#5B2A73" }),
  "suco-uva.svg": glass({ juice: "#7B3A8C", top: "#9A5CAB", garnish: "grapes", fruit: "#5A1E73", fruitIn: "#8E4AA6" }),
  "suco-goiaba.svg": glass({ juice: "#EE7A73", top: "#F49D97", garnish: "leaf" }),
  "suco-laranja-morango.svg": glass({ juice: "#F59324", second: "#E04A5F", top: "#FBB454", garnish: "berry", fruit: "#DC2F3A" }),
  "suco-laranja-acerola.svg": glass({ juice: "#F59324", second: "#E8552F", top: "#FBB454", garnish: "citrus", fruit: "#F97316", fruitIn: "#FDBA74" }),
  "soda-italiana.svg": glass({ juice: "#8ED9F6", second: "#E8609F", top: "#B5E6F9", garnish: "citrus", fruit: "#E8609F", fruitIn: "#FFB3CE" }),
  "suco-natural.svg": glass({ juice: "#F6B23A", top: "#FAC96C", garnish: "leaf" }),
};

const fallback = {
  "krep-salgado.svg": krepSalgado,
  "krep-doce.svg": krepDoce,
  "batata.svg": batata,
};

let total = 0;
for (const [dir, files] of [["bebidas", bebidas], ["fallback", fallback]]) {
  mkdirSync(resolve(ROOT, dir), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(resolve(ROOT, dir, name), content);
    total += 1;
  }
}
console.log(`${total} ilustrações geradas em ${ROOT}`);
