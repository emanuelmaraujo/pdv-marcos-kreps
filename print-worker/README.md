# PDV Marcos Krep's - Print Worker Local

Este é o serviço Node.js responsável por escutar os pedidos do Supabase (via Realtime e Polling) e enviá-los de forma instantânea para a impressora térmica local via Rede/Ethernet usando comandos ESC/POS.

A grande vantagem dessa arquitetura é que o Frontend (Mobile PWA) não se comunica diretamente com a impressora, mantendo a operação leve e assíncrona. A segurança depende das credenciais, políticas e validações do backend.

> Revisado em 2026-10-24. Para sincronizar o repositório, consulte o [guia de atualizações](../docs/development/updates.md).

## Como funciona

1. Quando um pedido é criado, o Backend no Supabase insere linhas na tabela `printer_jobs` (com `status` = `PENDING`).
2. O **Print Worker** local escuta eventos via Supabase Realtime. Polling de contingência é ativado quando a conexão falha; com Realtime saudável, permanece desligado.
3. O serviço lê o payload, envia para a porta IP da impressora via protocolo ESC/POS.
4. Ao finalizar o corte de papel, o serviço altera a tabela `printer_jobs` para `status = PRINTED`. Se falhar, altera para `FAILED`.

## Requisitos
- [Node.js](https://nodejs.org) 20.9 ou superior instalado (mesmo requisito do projeto principal).
- Impressora Térmica Ethernet conectada na mesma rede do computador que roda o serviço.

## Instalação

1. Acesse o diretório do worker:
```bash
cd print-worker
```

2. Instale as dependências:
```bash
npm ci
```

3. Configure as variáveis de ambiente:
Copie o arquivo de exemplo e edite com suas chaves locais e IP da impressora.
```powershell
Copy-Item .env.example .env
```

Não sobrescreva um `.env` existente. Preencha com o ambiente de teste antes de iniciar o serviço.
*(⚠️ NUNCA exponha a `SUPABASE_SERVICE_ROLE_KEY` no Frontend, ela é exclusiva para este ambiente servidor local)*

## Como rodar em Desenvolvimento

```bash
npm run dev
```

Você verá os logs de inicialização e o worker começará a escutar os eventos do banco.

## Validação sem impressão

Na raiz do repositório:

```powershell
npm run typecheck --prefix print-worker
npm run build --prefix print-worker
npm test -- print-worker/src/retry-policy.test.ts
```

## Teste operacional com impressora

Execute somente em ambiente e fila de teste preparados; esses passos criam jobs e imprimem papel.

1. No painel do Supabase (ou rodando o PWA localmente), crie/re-imprima um pedido.
2. Certifique-se de que a linha gerada na tabela `printer_jobs` está com status `PENDING`.
3. Verifique o terminal deste projeto. Ele acusará o evento recebido e imprimirá o papel correspondente.

## Atualizar somente o worker

O worker roda a partir de `dist/`, não do TypeScript. **`git pull` sozinho não
muda nada** — sem `npm run build` o pm2 continua executando o build antigo, e é
fácil achar que atualizou quando não atualizou.

```bash
cd ~/pdv-marcos-kreps
npm run update:local             # exige checkout limpo e fast-forward
npm ci --prefix print-worker    # inclui ferramentas necessárias ao build
npm run typecheck --prefix print-worker
npm run build --prefix print-worker
pm2 restart pdv-print-worker
pm2 logs pdv-print-worker --lines 30
```

Se `ecosystem.config.js` mudou (restart, backoff, cwd), `pm2 restart` **não**
aplica: ele reusa a configuração salva no pm2. Nesse caso:

```bash
pm2 delete pdv-print-worker
pm2 start print-worker/ecosystem.config.js
pm2 save
```

Conferir que subiu de verdade, do lado do banco:

```sql
SELECT value AS ultimo_heartbeat, now() - updated_at AS silencio
  FROM settings WHERE key = 'print_worker_last_seen_at';
```

O heartbeat é gravado a cada dois minutos; uma gravação recente indica atividade, mas não comprova qual versão está em execução. Nos logs do Supabase, o worker
atualizado aparece chamando `/rest/v1/rpc/claim_printer_jobs`; se ainda aparecer
`GET /rest/v1/printer_jobs` a cada 3s, o `dist/` não foi regenerado.

## Quando parar de imprimir (runbook)

O sintoma "a impressora parou" quase sempre é **o worker fora do ar**, não a
impressora. Diagnostique na ordem — o primeiro passo já separa os dois casos.

### 1. O worker está vivo?

Em `Configurações → Impressão` o painel mostra "Online/Offline" a partir do
heartbeat (o worker grava em `settings` a cada dois minutos; considere esse
intervalo ao avaliar a última atualização). Pelo banco:

```sql
SELECT value AS ultimo_heartbeat, now() - updated_at AS silencio
  FROM settings WHERE key = 'print_worker_last_seen_at';
```

Se a última atualização estiver muito além do intervalo de dois minutos, confira
o processo no Raspberry e a conexão com o banco antes de reiniciar o serviço.

```bash
ssh pi@<ip-do-raspberry>          # o IP fica em settings.print_worker_ip
pm2 status                        # pdv-print-worker deve estar "online"
pm2 restart pdv-print-worker
pm2 logs pdv-print-worker --lines 100
```

Se o `pm2 status` vier vazio (Raspberry reiniciou e o pm2 não voltou):

```bash
cd ~/pdv-marcos-kreps/print-worker
pm2 start ecosystem.config.js
pm2 save                          # grava a lista de processos
pm2 startup                       # imprime o comando que registra o pm2 no boot
```

> ⚠️ Sem `pm2 save` + `pm2 startup`, qualquer queda de energia deixa a loja sem
> impressão até alguém reiniciar o serviço na mão.

Nada se perde enquanto o worker está fora: os jobs permanecem na fila, sujeitos às regras de retenção, retry e descarte.
Ao voltar, o worker reivindica e processa os jobs elegíveis; confira a fila e os logs.

### 2. O worker está vivo mas nada sai?

Aí o problema é do job ou da impressora. A fila conta a história:

```sql
SELECT status, count(*), max(error_message) AS ultimo_erro
  FROM printer_jobs
 WHERE created_at > now() - interval '2 hours'
 GROUP BY status;
```

- `attempt_count = 0` e `locked_by IS NULL` → o worker nunca reivindicou: volte ao passo 1.
- `PENDING` com `error_message` e `next_attempt_at` no futuro → falha transitória, já reagendado com backoff (2s→60s). Confira IP/porta da impressora.
- `FAILED` → desistiu; `error_message` diz o motivo. Reimprima pela tela de Impressão.
- Fila vazia com pedidos entrando → ninguém está criando job: veja `printing_enabled` e os flags `print_*_copy` em `settings`, e o override por filial em `branches.printer_config`.

## Limitações conhecidas (MVP)
- Suporta ativamente apenas impressoras **Ethernet/Rede** com IP estático na porta 9100. (Impressão USB não está nativamente implementada sem hardcodar VendorID/ProductID).
- Não cria serviço nativo no Windows (ainda), o terminal precisa ficar aberto.
- Não refaz o design visual do cupom - o conteúdo precisa vir pré-mastigado em texto ou arranjos em `printer_jobs.content`.
