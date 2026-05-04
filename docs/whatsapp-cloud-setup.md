# Configuração do WhatsApp Cloud API

Este documento detalha o processo de configuração e integração da WhatsApp Cloud API oficial da Meta para o PDV Marcos Krep's. 
A arquitetura é focada em enviar mensagens transacionais automáticas (Ex: "Pedido Pronto") usando o Supabase Database Webhook acoplado a uma Edge Function.

> **Importante sobre os Custos da Meta**:
> O WhatsApp Cloud API disponibiliza **1.000 conversas de serviço gratuitas por mês** (ideal para pequenos negócios).
> Uma "conversa de serviço" é iniciada quando você envia um template de utilidade e dura 24h. Após as 1.000 gratuitas, a cobrança é baseada na tabela vigente da Meta (varia por país e categoria). Sempre classifique suas mensagens de notificação como `Utility/Serviço`.

---

## 1. Como Criar e Configurar na Meta

1. Acesse o [Meta for Developers](https://developers.facebook.com/).
2. Faça login e acesse **Meus Aplicativos**.
3. Clique em **Criar Aplicativo**, selecione a opção **Outros** e depois o tipo **Empresa (Business)**.
4. Defina o nome do App (ex: `PDV Marcos Kreps`).
5. Na tela principal do App, role até **WhatsApp** e clique em **Configurar**.
6. Vincule a uma Conta Empresarial do Facebook (Business Manager) ou crie uma na hora.
7. O painel te dará um número de teste e um token de teste (válido por 24h). 

Para operação real, você deve cadastrar um número de telefone da loja no painel em **Gerenciador do WhatsApp > Ferramentas > Telefones**.

---

## 2. Obtendo Credenciais Permanentes

Para o servidor, precisaremos de 2 chaves:

1. **WHATSAPP_PHONE_ID**: Dentro do menu WhatsApp > Configuração da API. Procure por "Identificação do número de telefone".
2. **WHATSAPP_CLOUD_TOKEN**: Não use o token temporário. Acesse `Configurações do Negócio` > `Usuários` > `Usuários do Sistema`. Crie um "Usuário de Sistema", gere um token para ele concedendo as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.

---

## 3. Criando o Template de Mensagem

No painel do WhatsApp Manager, crie um **Modelo de Mensagem (Template)**:

- **Categoria**: Utilidade (Utility)
- **Nome**: `pedido_pronto_kreps`
- **Idioma**: Português (Brasil) - `pt_BR`
- **Corpo (Body)**:
  ```text
  Olá, {{1}}! Seu pedido #{{2}} no Marcos Krep's está pronto para retirada no balcão.
  ```

Aguarde a aprovação da Meta (costuma levar menos de 5 minutos).

---

## 4. Configurando Variáveis no Supabase

Com as credenciais em mãos, vá ao [Painel do Supabase](https://app.supabase.com) > **Project Settings** > **Edge Functions** (ou use a CLI do Supabase localmente) e adicione os seguintes "Secrets":

```bash
WHATSAPP_CLOUD_TOKEN="seu_token_permanente_aqui"
WHATSAPP_PHONE_ID="seu_phone_id_aqui"
WHATSAPP_TEMPLATE_NAME="pedido_pronto_kreps"
WHATSAPP_TEMPLATE_LANGUAGE="pt_BR"
```

---

## 5. Configurando o Database Webhook (O "Gatilho")

Para que a função de disparo rode no exato segundo em que o pedido fica pronto (sem afetar a tela do garçom):

1. Vá em **Database** > **Webhooks** no painel do Supabase.
2. Clique em **Create Webhook**.
3. **Name**: `Disparo WhatsApp`.
4. **Table**: `whatsapp_messages`.
5. **Events**: Marque `Insert`.
6. **Type**: `Supabase Edge Function`.
7. **Method**: `POST`.
8. Selecione a Edge Function `send-whatsapp`.
9. Clique em **Save**.

Dessa forma, sempre que `update-order-status` inserir um "PENDING", o banco de dados invocará a função de forma 100% isolada e assíncrona.

> **Nota sobre o Payload:** A Edge Function aceita dois formatos:
> - **Webhook do Supabase** (padrão): Envia `{ "type": "INSERT", "table": "whatsapp_messages", "record": { "id": "...", ... } }`. A função extrai `record.id` automaticamente.
> - **Chamada direta** (testes/cURL): Envie `{ "whatsapp_message_id": "..." }`.
>
> Não é necessário nenhum mapeamento customizado no webhook.

---

## 6. Como Verificar Sucesso ou Falha

Você não precisa abrir a Edge Function toda hora.
A tabela `whatsapp_messages` no Supabase registra tudo:
- Se `status = SENT`, a mensagem chegou no servidor do WhatsApp. A coluna `provider_message_id` terá o ID rastreável da Meta.
- Se `status = FAILED`, leia a coluna `error_message`. Causas comuns: 
  - Token expirado
  - Telefone incorreto/falta de nono dígito
  - Cliente bloqueou envio
  - Template reprovado

---

## 7. Como testar localmente na sua máquina

Certifique-se de que a CLI do Supabase está rodando (`supabase start`).

Crie um arquivo `env.local` na raiz com:
```text
WHATSAPP_CLOUD_TOKEN=teste
WHATSAPP_PHONE_ID=teste
```

Inicie as funções localmente:
```bash
supabase functions serve send-whatsapp --env-file env.local
```

Via cURL ou Postman, dispare para `http://localhost:54321/functions/v1/send-whatsapp` um payload:
```json
{
  "whatsapp_message_id": "id-do-banco-aqui"
}
```
*Atenção*: a linha no banco deve estar como `PENDING`. Se o Token for inválido, a resposta voltará erro na requisição e o banco ficará marcado como `FAILED`.
