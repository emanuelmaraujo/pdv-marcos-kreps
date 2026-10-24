# Configuração do WhatsApp Cloud API

Este guia detalha como configurar a integração do WhatsApp Cloud API para o PDV Marcos Krep's.

## 1. Meta for Developers

1.  Crie uma conta em [Meta for Developers](https://developers.facebook.com/).
2.  Crie um novo App do tipo **Business**.
3.  Adicione o produto **WhatsApp** ao seu App.
4.  No painel do WhatsApp, selecione um número de telefone para teste ou configure um número real.
5.  **Templates**: Vá em "Configuração do WhatsApp" -> "Modelos de mensagem" e crie um template.
    *   Exemplo de nome: `pedido_ready`
    *   Corpo sugerido: `Olá, {{1}}! Seu pedido #{{2}} está pronto para retirada. Marcos Krep's agradece sua preferência.`
    *   Variáveis: `{{1}}` é o nome do cliente, `{{2}}` é o número diário do pedido.

## 2. Secrets no Supabase

Configure as seguintes variáveis de ambiente (Secrets) no seu projeto Supabase (via Dashboard ou CLI):

| Secret | Descrição | Exemplo |
| :--- | :--- | :--- |
| `WHATSAPP_ACCESS_TOKEN` | Token de Acesso Permanente (ou Temporário para testes) | `EAAG...` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do Número de Telefone | `123456789012345` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da Conta de Negócio | `987654321098765` |
| `WHATSAPP_API_VERSION` | Versão da API da Graph Meta | `v19.0` |
| `WHATSAPP_DEFAULT_TEMPLATE_READY` | Nome do template para pedido pronto | `pedido_ready` |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Idioma padrão do template | `pt_BR` |

## 3. Configuração no PDV

1.  Acesse o painel administrativo do PDV em `/app/configuracoes`.
2.  Na seção **WhatsApp Cloud API**:
    *   Ative a integração.
    *   Confirme o nome do template e o idioma.
    *   Informe um **Telefone de Teste** (formato: `5561999999999`).
    *   Clique em **Salvar Configurações**.
3.  Use o botão **Enviar Teste** para validar se as credenciais estão corretas.

## 4. Funcionamento Técnico

*   **Asíncrono**: Quando um pedido é marcado como `PRONTO`, o sistema apenas adiciona um registro na tabela `whatsapp_messages` com status `PENDING`. Isso garante que o PDV não trave se a API do Meta estiver lenta ou fora do ar.
*   **Fila**: A fila é processada através da Edge Function `send-whatsapp`. No momento, o processamento pode ser disparado manualmente pelo Admin via botão "Processar Fila" ou via automação (Cron Job).
*   **Segurança**: Tokens e segredos nunca são expostos no frontend. Toda a comunicação com a Meta acontece dentro da infraestrutura segura do Supabase.
*   **Duplicidade**: O sistema evita enviar a mesma notificação de "Pronto" mais de uma vez para o mesmo pedido.

## 5. Resolução de Problemas

*   **Status FAILED**: Verifique o campo `error_message` na tabela `whatsapp_messages` ou no painel administrativo. Erros comuns incluem tokens expirados ou templates não aprovados.
*   **Mensagem não chega**: Verifique se o número de destino está formatado corretamente (DDI + DDD + Número) e se o template está aprovado na Meta.
