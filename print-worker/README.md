# PDV Marcos Krep's - Print Worker Local

Este é o serviço Node.js responsável por escutar os pedidos do Supabase (via Realtime e Polling) e enviá-los de forma instantânea para a impressora térmica local via Rede/Ethernet usando comandos ESC/POS.

A grande vantagem dessa arquitetura é que o Frontend (Mobile PWA) não se comunica diretamente com a impressora, mantendo a operação leve, assíncrona e 100% segura.

## Como funciona

1. Quando um pedido é criado, o Backend no Supabase insere linhas na tabela `printer_jobs` (com `status` = `PENDING`).
2. O **Print Worker** local está executando na loja e escuta imediatamente o evento via WebSockets (Supabase Realtime).
3. O serviço lê o payload, envia para a porta IP da impressora via protocolo ESC/POS.
4. Ao finalizar o corte de papel, o serviço altera a tabela `printer_jobs` para `status = PRINTED`. Se falhar, altera para `FAILED`.

## Requisitos
- [Node.js](https://nodejs.org) v18+ instalado.
- Impressora Térmica Ethernet conectada na mesma rede do computador que roda o serviço.

## Instalação

1. Acesse o diretório do worker:
```bash
cd print-worker
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Copie o arquivo de exemplo e edite com suas chaves locais e IP da impressora.
```bash
cp .env.example .env
```
*(⚠️ NUNCA exponha a `SUPABASE_SERVICE_ROLE_KEY` no Frontend, ela é exclusiva para este ambiente servidor local)*

## Como rodar em Desenvolvimento

```bash
npm run dev
```

Você verá os logs de inicialização e o worker começará a escutar os eventos do banco.

## Como testar

1. No painel do Supabase (ou rodando o PWA localmente), crie/re-imprima um pedido.
2. Certifique-se de que a linha gerada na tabela `printer_jobs` está com status `PENDING`.
3. Verifique o terminal deste projeto. Ele acusará o evento recebido e imprimirá o papel correspondente.

## Limitações conhecidas (MVP)
- Suporta ativamente apenas impressoras **Ethernet/Rede** com IP estático na porta 9100. (Impressão USB não está nativamente implementada sem hardcodar VendorID/ProductID).
- Não cria serviço nativo no Windows (ainda), o terminal precisa ficar aberto.
- Não refaz o design visual do cupom - o conteúdo precisa vir pré-mastigado em texto ou arranjos em `printer_jobs.content`.
