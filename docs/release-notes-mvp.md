# Release Candidate 1 (RC1) — PDV Marcos Krep’s

Este documento resume as alterações técnicas e o estado atual do sistema para o início da bateria de testes operacionais (Homologação).

## 🚀 O que há de novo no RC1

### 1. Arquitetura "Trust-no-client" (Segurança)
Toda a lógica crítica de preços, cálculos de total, taxas e descontos foi movida para as **Edge Functions**. O frontend agora envia apenas os IDs dos produtos e adicionais, e o servidor recalcula tudo consultando os preços reais no banco de dados.
- **Functions Atualizadas:** `create-public-order`, `create-attendant-order`, `add-items-to-order`.

### 2. Gestão de Taxa de Embalagem
- Implementada configuração centralizada no banco de dados.
- Nova interface na tela de **Configurações** para definir o valor da taxa e se ela deve ser aplicada automaticamente em pedidos "Para Viagem".
- Sincronização automática entre o banco de dados e as Edge Functions.

### 3. WhatsApp Integration (Beta)
- Sistema de mensageria assíncrona via fila (`whatsapp_messages`).
- Endpoint `send-whatsapp` agora suporta ações de teste e processamento de fila.
- Dashboard de monitoramento adicionado na tela de Configurações (Pendentes, Enviadas, Falhas).

### 4. Relatório Gerencial Avançado
- O `cash-report` foi refatorado para fornecer **Strategic Insights**:
    - Horário de pico.
    - Concentração de receita (Pareto).
    - Preferências por categoria em horários específicos (ex: madrugada).
    - Produtos com baixa saída.

### 5. Estabilidade Operacional
- Vias de impressão agora são configuráveis (Cliente, Cozinha, Sucos/Batata).
- Logs de auditoria (`audit_logs`) implementados em todas as operações de criação e confirmação de pedidos.
- Bloqueio de usuários inativos em nível de Edge Function.

## 🛠️ Configurações Necessárias (Checklist)

Antes de iniciar os testes, verifique no painel Administrativo:
1. **Configurações > Taxa de Embalagem:** Defina o valor (ex: R$ 1,00) e ative a cobrança se desejar.
2. **Configurações > Impressora:** Verifique o IP da impressora local (usando o Print-Worker).
3. **Configurações > Vias de Impressão:** Ative as vias que sua operação utiliza.

## ⚠️ Known Issues / Observações
- O Print-Worker local deve estar rodando e apontando para o projeto `feotsdzkwbikmcnzgsnh`.
- O WhatsApp requer que os Secrets (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) estejam configurados no projeto Supabase.

---
**Status:** Pronto para Homologação Operacional.
