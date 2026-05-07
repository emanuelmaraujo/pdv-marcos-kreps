# PDV Marcos Krep's

Sistema de Ponto de Venda (PDV) mobile-first desenvolvido para a Marcos Krep's, focado em agilidade no atendimento e gestão de produção (cozinha/sucos).

## 🚀 Tecnologias
- **Frontend**: Next.js 15 (App Router), TailwindCSS, Shadcn/UI.
- **Backend**: Supabase (Auth, Database, Edge Functions, Realtime).
- **Impressão**: Node.js Local Worker (ESC/POS via TCP/IP).
- **Notificações**: WhatsApp Cloud API (Meta).

## 📁 Estrutura do Projeto
- `/src`: Aplicação principal Next.js.
- `/supabase`: Configurações de banco, RLS e Edge Functions.
- `/print-worker`: Worker local para comunicação com impressoras térmicas.
- `/docs`: Documentação operacional e guias de setup.

## 🛠️ Como Rodar

### 1. Aplicação Web
```bash
npm install
npm run dev
```

### 2. Print Worker (Local)
1. Configure o `.env` na pasta `print-worker` com as chaves do Supabase.
2. Execute:
```bash
cd print-worker
npm install
npm run dev
```

## 📖 Documentação Adicional
- [Walkthrough Geral](walkthrough.md): Detalhes da arquitetura e fluxos.
- [Plano de Teste Operacional](docs/mvp-operational-test.md): Checklist para validação do MVP.
- [Guia WhatsApp](docs/whatsapp-cloud-setup.md): Configuração da API de notificações.

## 🔒 Segurança
- **RLS (Row Level Security)**: Garantia de que Atendentes não alteram o cardápio e que usuários públicos apenas consultam status.
- **Trust-no-client**: Toda lógica de precificação e validação de regras de negócio ocorre nas Edge Functions.
