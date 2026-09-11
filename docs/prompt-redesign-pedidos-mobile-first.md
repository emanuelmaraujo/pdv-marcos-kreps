# Análise e prompt — detalhes de pedidos mobile-first

## Contexto do sistema

O PDV Marcos Krep's usa Next.js 16, React 19, Tailwind CSS 4 e Supabase. O quadro
`/app/pedidos` recebe atualizações por Realtime, polling e retorno de visibilidade.
O pedido aberto não pode ser substituído silenciosamente durante uma operação.
Pagamento, impressão, edição de item, transições de status e despacho já possuem
regras próprias e devem ser preservados.

O detalhe do pedido usa uma única superfície responsiva (`BottomSheet`):

- mobile: folha que sobe do rodapé, respeita teclado, navegação fixa e safe area;
- tablet: diálogo centralizado e mais largo, com uma única área de rolagem;
- desktop: diálogo centralizado com largura operacional de até `2xl`.

## Diagnóstico de UX

1. O endereço existia, mas o número competia visualmente com rua, bairro,
   complemento e referência. Em uma entrega, rua e número são dados operacionais
   críticos e precisam aparecer antes de qualquer expansão.
2. O nome do cliente aparecia no cabeçalho, porém telefone e e-mail não estavam
   disponíveis no mesmo contexto. O atendente precisava procurar dados fora do
   fluxo principal.
3. Informações completas de entrega eram exibidas de forma extensa ou ausente,
   sem uma camada progressiva. Isso aumenta o scroll no mobile e reduz a leitura
   rápida no tablet.
4. Faltavam atalhos diretos para ligar, abrir WhatsApp, copiar o endereço e abrir
   rota. Essas tarefas são frequentes e não devem exigir transcrição manual.
5. A busca do quadro só aceitava número do pedido e nome. Em atendimento real,
   telefone, rua, número e bairro também são chaves naturais de localização.
6. O card de entrega mostrava apenas o bairro. Isso não diferenciava rapidamente
   dois pedidos próximos ou dois clientes do mesmo bairro.

## Hierarquia recomendada

Ao abrir um pedido, a ordem deve ser:

1. identidade: número, cliente, origem, status, pagamento, itens e total;
2. cliente e atendimento: rua e número sempre visíveis em entrega;
3. ação operacional atual: confirmar, preparar, despachar ou receber;
4. observações que alteram o preparo;
5. itens e cobrança;
6. ajustes secundários: adicionar, alterar pagamento, reimprimir e cancelar;
7. histórico e métricas sob demanda.

O bloco “Cliente e entrega” deve usar divulgação progressiva:

- fechado: nome, telefone, rua, número destacado, bairro e ações rápidas;
- aberto: e-mail, complemento, referência, CEP, cidade/UF e entregador;
- endereço sem número: mostrar “Sem número” em tom de atenção, nunca ocultar;
- campos ausentes: mostrar um vazio explícito, sem inventar informação.

## Regras responsivas

### Mobile — 320 a 599 px

- uma coluna e leitura vertical;
- ações com altura mínima de 44 px;
- ação principal fixa no rodapé e acima da navegação/safe area;
- rua flexível e número em selo sem truncamento;
- detalhes completos fechados por padrão para antecipar itens;
- no máximo três ações curtas na mesma linha: “Ligar”, “Rota”, “Ver mais”.

### Tablet — 600 a 1023 px

- diálogo centralizado até `2xl`, sem painéis com rolagens concorrentes;
- dados expandidos em duas colunas: contato e entrega;
- mesma ordem mental do mobile, evitando uma interface tablet separada;
- ação principal continua fixa e sempre alcançável.

### Desktop — 1024 px ou mais

- preservar a mesma estrutura e contratos do mobile;
- aproveitar largura para duas colunas apenas dentro de agrupamentos;
- não criar uma segunda implementação do detalhe.

## Critérios de aceite

- [ ] Rua e número aparecem sem tocar em “Ver mais”.
- [ ] “Sem número” é visível quando o dado estiver ausente.
- [ ] “Ver mais” revela contato, complemento, referência, CEP e entregador.
- [ ] Ligar, WhatsApp, rota e copiar endereço funcionam quando há dados.
- [ ] Todos os alvos principais têm no mínimo 44 px.
- [ ] O detalhe funciona em 320, 360, 390, 768 e 1024 px sem overflow lateral.
- [ ] A ação principal permanece visível com scroll e teclado aberto.
- [ ] A busca encontra pedido por número, nome sem acento, telefone, rua, número,
      bairro e cidade.
- [ ] Cards de entrega mostram rua e número antes do bairro.
- [ ] Polling e Realtime não reinicializam o pedido aberto.
- [ ] Nenhuma regra de preço, pagamento, impressão, banco ou status é alterada.
- [ ] ESLint, testes Vitest e build de produção passam.

## Prompt reutilizável

> Atue como product designer sênior e engenheiro front-end responsável pelo PDV
> Marcos Krep's. Analise e melhore a tela `/app/pedidos` e o detalhe aberto ao
> clicar em um pedido. O projeto usa Next.js 16 App Router, React 19, Tailwind CSS
> 4 e Supabase. Preserve as regras existentes de Realtime, polling, impressão,
> pagamento por itens, edição, despacho e transição de status.
>
> Crie uma experiência mobile-first, prática e objetiva. No detalhe, priorize:
> identidade do pedido; cliente; endereço de entrega; ação operacional atual;
> observações; itens; cobrança; ações secundárias. Para entregas, rua e número
> devem ficar visíveis imediatamente, com o número destacado e um alerta claro
> quando estiver ausente. Inclua uma opção “Ver mais” para revelar telefone,
> e-mail, complemento, bairro, cidade/UF, CEP, referência e entregador.
>
> Disponibilize atalhos de um toque para ligar ao cliente, abrir WhatsApp, copiar
> o endereço e iniciar rota no Google Maps. Use alvos de toque de pelo menos
> 44 px, foco visível, rótulos acessíveis, feedback ao copiar e estados vazios
> explícitos. Não esconda dados críticos dentro da expansão.
>
> No mobile, use uma coluna, sheet de rodapé e CTA principal fixo acima da safe
> area. No tablet, use diálogo centralizado largo, dados expandidos em duas
> colunas e apenas uma área de rolagem. No desktop, mantenha o mesmo componente
> responsivo, sem duplicar implementações.
>
> Melhore também o card de entrega para mostrar rua, número e bairro, torne o
> card acessível por teclado e amplie a busca para número do pedido, nome,
> telefone, rua, número, bairro e cidade. Não altere schema, preços, taxas,
> métodos de pagamento, impressão ou permissões. Adicione testes para formatação
> de endereço, CEP, links de rota e busca. Entregue código, análise das decisões,
> critérios de aceite e evidência de lint, testes e build.
