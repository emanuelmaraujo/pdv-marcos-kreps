# Prompt mestre — auditoria e redesenho de usuários, filiais e configurações

> Este é o prompt normalizado a partir da solicitação original e usado como roteiro do estudo em `docs/estudo-configuracoes-usuarios-filiais-taxas.md`.

## Papel

Atue como arquiteto de software sênior, especialista em sistemas de PDV multiunidade, Next.js, Supabase/PostgreSQL, segurança de aplicações, autorização por filial, experiência mobile-first e conciliação financeira de meios de pagamento.

## Contexto

O sistema é um PDV para uma rede com várias filiais. Hoje existem configurações globais e configurações por filial, mas a separação de escopo é pouco clara, o gerenciamento é fragmentado e as regras de acesso não representam corretamente a operação desejada.

O sistema usa Next.js App Router no frontend e Supabase para Auth, PostgreSQL, RLS e Edge Functions. A aplicação é usada principalmente em dispositivos móveis e em ambiente operacional de loja.

Decisão confirmada pelo responsável: `emanuel-morais@outlook.com` será o administrador global da rede. A solução deve manter essa distinção separada do administrador de filial e aplicá-la no frontend, Edge Functions, banco e RLS.

## Objetivo

Realize uma auditoria completa da implementação atual e proponha uma arquitetura profissional, segura, prática e mobile-first para:

1. usuários, papéis, permissões e vínculos com filiais;
2. configurações globais e configurações específicas de cada filial;
3. taxas de cartão de crédito e débito por filial;
4. auditoria, versionamento, validação e segurança das alterações;
5. experiência de uso e prevenção de erros operacionais.

Não faça uma análise genérica. Toda conclusão deve ser confrontada com o código, banco, migrações, funções, documentação e fluxos existentes.

## Regras de negócio obrigatórias

- Um atendente pode trabalhar em uma ou mais filiais.
- Um administrador de filial deve pertencer a exatamente uma filial.
- Um entregador deve pertencer a exatamente uma filial.
- Deve existir uma função global restrita — proprietário ou administrador da rede — para operações que realmente abrangem todas as filiais.
- A central “Configurações” deve aparecer no menu lateral e na barra inferior móvel; Usuários e Filiais devem ser subáreas dessa central, junto das taxas de pagamento.
- O acesso aos dados deve ser limitado pela filial e pelas capacidades do papel, inclusive no banco e nas operações executadas com credenciais privilegiadas.
- A filial principal de um usuário deve ser explícita e deve pertencer ao conjunto de filiais autorizadas.
- Taxas de débito e crédito podem variar por filial, adquirente, canal, bandeira, número de parcelas, prazo de recebimento e período de vigência.
- Alterar uma taxa não pode mudar retroativamente pagamentos históricos.
- O sistema deve distinguir custo da adquirente, acréscimo cobrado do cliente e taxa de entrega/embalagem.
- Alterações financeiras ou de segurança devem ter autor, data, motivo, valores anterior e novo e versão.

## Trabalho obrigatório

### 1. Preparação e entendimento

- Leia as instruções do repositório e a documentação local antes de propor alterações.
- Verifique a versão real do framework e consulte a documentação instalada correspondente.
- Crie uma branch de trabalho com prefixo `codex/`.
- Mapeie entidades, rotas, hooks, APIs, Edge Functions, migrações, políticas RLS, funções `SECURITY DEFINER`, auditoria e fluxos de interface relacionados ao escopo.
- Registre limitações de validação, como ausência de variáveis de ambiente ou serviços locais.

### 2. Usuários e autorização

- Compare o comportamento atual de administrador, atendente e entregador com as regras obrigatórias.
- Verifique criação, edição, ativação, desativação, exclusão e troca de papel.
- Verifique transações, validação de filial, coerência entre perfil e cadastro operacional do entregador e prevenção de autoelevação de privilégios.
- Analise autorização em quatro camadas: navegação/interface, Server Actions/Route Handlers/Edge Functions, banco/RLS e operações com `service_role`.
- Proponha uma matriz de papéis e capacidades, invariantes de cardinalidade e regras para um gestor nunca conceder acesso superior ao próprio.

### 3. Configurações globais e por filial

- Inventarie todas as configurações, onde são armazenadas e como ocorre a herança.
- Identifique duplicidade de lógica, ambiguidades entre valor herdado e valor explícito, chaves com nomes divergentes, configuração pública indevida e gravações parciais.
- Proponha uma hierarquia clara: padrão da rede, substituição por filial e valor efetivo.
- Desenhe uma arquitetura de configuração por domínio, com tipos fortes para dados críticos, validação no servidor, alterações atômicas, controle de concorrência e histórico consultável.

### 4. Taxas de pagamento

- Mapeie métodos, transações, relatórios e integrações de pagamento existentes.
- Modele taxas com vigência e regras sem sobreposição.
- Inclua percentual, valor fixo, parcelas, antecipação, prazo de liquidação e adquirente quando aplicável.
- Proponha snapshot da regra aplicada em cada pagamento, valor bruto, custo estimado, custo efetivo, valor líquido e situação de conciliação.
- Proponha simulador por filial e validações que impeçam regras ausentes, inválidas ou conflitantes.
- Permita diferenciar o custo da maquininha por tipo de pedido e origem operacional. Em particular, uma venda para viagem feita pelo atendente pode ter taxa diferente de uma venda online, sem confundir custo da adquirente com acréscimo ao cliente.

### 4.1 Comunicação e impressão por contexto

- Permita habilitar cada evento de WhatsApp por filial, tipo de pedido e origem. Exemplo: não notificar pedido consumido no local e notificar entrega.
- Permita rotear as vias de cozinha, produção e cliente por filial, tipo e origem do pedido.
- Trate a via do cliente como decisão explícita, inclusive em retirada, entrega, atendimento presencial, app, QR Code e WhatsApp.
- Mantenha compatibilidade com filiais sem filtros cadastrados, considerando todos os contextos até que uma regra seja explicitamente salva.
- Garanta que a decisão efetiva aconteça no servidor a partir do pedido persistido, e não de parâmetros controlados pelo navegador.

### 5. Segurança

- Avalie RLS, privilégios SQL, políticas públicas, DTOs, funções privilegiadas, segredo de integrações, trilha de auditoria e registro de eventos.
- Use como referências as práticas atuais do Supabase, o princípio de menor privilégio e o OWASP ASVS.
- Considere o cliente sempre não confiável.
- Proponha testes automatizados positivos e negativos de autorização para cada papel e filial.

### 6. UX mobile-first

- Analise navegação, densidade, áreas de toque, teclado móvel, salvamento, estados de carregamento/erro, alterações não salvas e clareza do escopo editado.
- Proponha uma central de configurações orientada a tarefas, com seletor de escopo sempre visível, pesquisa, status de saúde, valor efetivo e origem da configuração.
- Trate ações destrutivas e alterações globais/financeiras com confirmação proporcional ao risco.
- Use WCAG 2.2 como referência de acessibilidade.

### 7. Benchmark

- Compare padrões relevantes de produtos multiunidade e pagamentos, usando fontes oficiais quando disponíveis.
- Extraia princípios aplicáveis ao sistema, sem copiar interfaces ou assumir que o modelo de outro produto serve sem adaptação.

## Entregáveis

Produza um documento em português com:

1. resumo executivo e recomendação principal;
2. mapa do estado atual;
3. achados priorizados por severidade, com evidências do repositório;
4. matriz-alvo de papéis, filiais e capacidades;
5. arquitetura-alvo de autorização e configurações;
6. modelo de dados proposto para taxas e conciliação;
7. proposta de experiência mobile-first;
8. plano de segurança e testes;
9. plano de implementação incremental, migração, rollback e critérios de aceite;
10. decisões recomendadas e itens explicitamente fora de escopo;
11. links das referências externas utilizadas;
12. matriz de WhatsApp e impressão por tipo/origem de pedido, com critérios de aceite.

Não implemente a remodelagem completa durante a fase de estudo. Primeiro produza uma base arquitetural verificável e um plano que permita implementação incremental sem interromper a operação do PDV.
