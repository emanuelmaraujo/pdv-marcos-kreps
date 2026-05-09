# Prompt: Responsividade Completa — PDV Marcos Krep's

---

## Contexto do Sistema

Você está trabalhando no **PDV Marcos Krep's**, um sistema de ponto de venda para uma crepe
ria. A aplicação é um PWA (Progressive Web App) construído com:

- **Framework**: Next.js (App Router) com TypeScript
- **Estilização**: Tailwind CSS v4 com design tokens definidos em `src/app/globals.css`
- **Componentes de ícone**: lucide-react
- **Banco de dados/Auth**: Supabase

**Paleta de cores do sistema** (tokens disponíveis via Tailwind):
- `brand-red` (#E73335) — cor primária
- `brand-yellow` (#FFE11A) / `brand-amber` (#FACC15) — cor de destaque
- `brand-charcoal` (#2F2F31) — fundo escuro (TopBar)
- `brand-black` (#111111) — textos principais
- `bg-background` (#f4f4f5) — fundo das páginas

**Estrutura de layout atual** (`src/app/app/layout.tsx`):
- `TopBar` fixo no topo (altura: `h-11`, `pt-11` no body)
- `BottomNav` fixo na base (altura: `h-16`, `pb-20` no body)
- `<main>` centralizado com `max-w-md` — **este é o problema central**
- Suporte a safe-area via `pb-safe` (variável CSS definida em globals.css)

**Rotas principais**:
- `/app` — Dashboard com atalhos e resumo
- `/app/novo-pedido` — Tomada de pedido (fluxo crítico)
- `/app/pedidos` — Lista de pedidos do dia
- `/app/caixa` — Fechamento de caixa
- `/app/cardapio` — Gestão do cardápio (admin)
- `/app/configuracoes` — Configurações de impressora
- `/app/usuarios` — Gestão de usuários (admin)

---

## Problema a Resolver

O layout atual tem `max-w-md` (448px) aplicado globalmente no `<main>`, o que torna a aplicação
perfeita para celulares mas desperdiça todo o espaço horizontal em tablets e desktops. As páginas
parecem uma tira estreita no centro da tela em telas maiores.

**Não existe versão tablet ou desktop.** Tudo é tratado como mobile.

---

## Objetivo

Implementar uma estratégia de responsividade **mobile-first** que:

1. **Mantenha a experiência mobile intacta** (prioridade máxima — a maioria dos usuários usa celular na operação)
2. **Crie um layout de tablet** elegante e funcional (768px–1023px)
3. **Crie um layout de desktop** profissional e produtivo (1024px+)

---

## Breakpoints a Usar

Use os breakpoints padrão do Tailwind:

| Breakpoint | Prefixo Tailwind | Faixa           | Dispositivo alvo       |
|------------|-----------------|-----------------|------------------------|
| Mobile     | (base)          | 0–767px         | Celular operacional    |
| Tablet     | `md:`           | 768px–1023px    | Tablet no balcão       |
| Desktop    | `lg:`           | 1024px+         | Computador na cozinha  |

---

## Diretrizes de Design por Breakpoint

### Mobile (base) — Preservar como está

- BottomNav fixo na base com 6 itens
- TopBar compacto com logo + botão sair
- Conteúdo em coluna única
- Touch targets mínimos: 44×44px
- Fonte mínima: 14px (nunca abaixo)
- `safe-area-inset` respeitado para dispositivos com notch

### Tablet (`md:`) — Layout em duas colunas

**Layout geral:**
- Substituir `BottomNav` por uma **sidebar lateral esquerda** colapsável (largura: 220px)
- `TopBar` permanece no topo, mas agora ocupa toda a largura
- Conteúdo ocupa o restante da tela à direita da sidebar
- `max-w-md` removido do `<main>` — substituir por `max-w-none` com padding lateral

**Sidebar (tablet):**
- Fundo `brand-charcoal` com itens de navegação verticais
- Logo Marcos Krep's no topo da sidebar
- Itens: ícone + label, estado ativo com destaque em `brand-red`
- Fechada por padrão, aberta com toggle no TopBar (ícone hamburguer → X)
- Transição `transition-all duration-300`

**Páginas específicas (tablet):**
- **Dashboard**: Grid 3 colunas para atalhos + painel de resumo lateral
- **Novo Pedido**: Painel de categorias/produtos à esquerda, resumo do pedido à direita (split view 60/40)
- **Pedidos**: Lista à esquerda, detalhes do pedido selecionado à direita (master-detail)
- **Caixa**: Formulário centralizado com largura máxima 600px
- **Cardápio**: Tabela expandida com mais colunas visíveis

### Desktop (`lg:`) — Layout profissional completo

**Layout geral:**
- Sidebar **sempre visível** (não colapsável), largura 240px
- TopBar ocupa o restante da largura (à direita da sidebar)
- Área de conteúdo com padding generoso (`px-8 py-6`)
- Máximo de colunas nas grids

**Sidebar (desktop):**
- Sempre expandida e visível
- Sem toggle — estrutura permanente
- Pode incluir versão pequena do logo no topo
- Rodapé com versão e botão de sair

**Páginas específicas (desktop):**
- **Dashboard**: Grid 4 colunas para atalhos + dashboard com cards de métricas reais
- **Novo Pedido**: 3 painéis — categorias | produtos | resumo do pedido (33/33/33)
- **Pedidos**: Tabela com todas colunas visíveis (número, cliente, itens, valor, status, ações)
- **Caixa**: Layout de 2 colunas — formulário + histórico de transações lado a lado
- **Cardápio**: Tabela completa com ações inline (editar, excluir, reordenar)
- **Configurações**: Layout de formulário centrado com max-w-2xl

---

## Especificações Técnicas de Implementação

### 1. Refatorar `src/app/app/layout.tsx`

```tsx
// Estrutura alvo
<div className="min-h-screen bg-background">
  <TopBar />                          {/* topo, full-width */}
  <div className="flex pt-11">
    <Sidebar />                       {/* lateral — oculta em mobile */}
    <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
      {children}
    </main>
  </div>
  <BottomNav />                       {/* visível só em mobile */}
</div>
```

### 2. Criar `src/components/layout/Sidebar.tsx`

- Componente client com estado `isOpen` (para tablet)
- Em desktop (`lg:`): sempre visível com `translate-x-0`
- Em tablet (`md:`): controlado por estado, com overlay ao abrir
- Em mobile: `hidden md:block` — não renderiza
- Recebe os mesmos `navItems` do BottomNav (única fonte de verdade)

### 3. Atualizar `src/components/layout/BottomNav.tsx`

- Adicionar `md:hidden` no elemento raiz — some em tablet+
- Manter lógica idêntica

### 4. Atualizar `src/components/layout/TopBar.tsx`

- Em mobile: logo + nome + botão sair (como está)
- Em tablet: adicionar botão hamburguer à esquerda para toggle da sidebar
- Em desktop: botão hamburguer some (sidebar sempre visível)
- Remover `max-w-md` do container interno — usar `max-w-none`

### 5. Atualizar páginas individualmente

Para cada página, adicionar classes responsivas:
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` nas grids
- Remover limitações de largura (`max-w-md`) dentro das páginas
- Usar `p-4 md:p-6 lg:p-8` para padding progressivo
- Cards com `min-h-[44px]` para garantir touch targets

---

## Princípios de UX a Seguir

1. **Mobile-first**: Escreva o CSS base para mobile; use `md:` e `lg:` para ampliar
2. **Touch targets**: Todos elementos clicáveis ≥ 44px em mobile
3. **Legibilidade**: Mínimo 16px para corpo de texto em mobile (evita zoom automático no iOS)
4. **Hierarquia visual**: Use tamanho, peso e cor para guiar o olhar — não sobrecarregue com bordas
5. **Feedback imediato**: Mantenha estados `active:scale-[0.97]` e `transition-all` para toque
6. **Espaço em branco**: Desktop tem mais espaço — use-o; não estique os componentes mobile
7. **Consistência**: A mesma ação deve ter o mesmo visual em todos os breakpoints
8. **Sem layout quebrado**: Nenhum texto deve truncar sem `truncate`; nenhuma imagem deve distorcer

---

## Princípios de Código a Seguir

1. **Sem duplicação**: `navItems` deve ser definido uma única vez (ex: `src/lib/nav-items.ts`) e compartilhado entre `BottomNav` e `Sidebar`
2. **Componentes coesos**: `Sidebar` não depende de lógica de negócio — apenas recebe props de navegação
3. **Nenhum `!important`**: Use a hierarquia natural do Tailwind
4. **Sem pixel hardcoded**: Use as escalas do Tailwind (ex: `w-60` em vez de `width: 240px`)
5. **SSR seguro**: Componentes com estado de viewport devem usar `useEffect` para detectar tamanho, nunca `window` diretamente no render
6. **Acessibilidade**: `aria-expanded`, `aria-controls` no toggle da sidebar; `role="navigation"` nas navs

---

## O Que NÃO Mudar

- A lógica de autenticação (`src/app/app/layout.tsx` — `checkSession`, `onAuthStateChange`)
- Os tokens de cor definidos em `globals.css`
- A API do Supabase e queries existentes
- Os componentes de UI atômicos (`Button`, `Input`, `Card`, `Toast`, etc.)
- O comportamento do `safe-area-inset` (PWA)
- A estrutura de rotas do Next.js

---

## Critérios de Aceitação

- [ ] Em mobile (375px): idêntico ao estado atual
- [ ] Em tablet (768px): sidebar visível ao toggle, conteúdo sem `max-w-md`, BottomNav oculto
- [ ] Em desktop (1280px): sidebar sempre visível, grid expandido, sem elementos esticados artificialmente
- [ ] Nenhum erro de TypeScript (`tsc --noEmit`)
- [ ] Sem regressão nas funcionalidades existentes
- [ ] Transições de sidebar suaves (≤300ms)
- [ ] Overlay escuro ao abrir sidebar em tablet (clique fecha)
- [ ] Logo e nome visíveis na sidebar em tablet/desktop

---

## Referências Visuais de Padrão

- **Sidebar colapsável tablet**: similar ao Notion mobile/tablet
- **Split view no pedido**: similar ao WhatsApp Web (lista + detalhe)
- **Tabela de pedidos desktop**: similar ao Square POS desktop
- **Dashboard desktop**: cards de métricas com grid denso, similar ao Shopify Admin

---

*Stack: Next.js App Router · TypeScript · Tailwind CSS v4 · lucide-react · Supabase*
