# Print worker

Serviço independente da aplicação Next. Leia [README.md](README.md) e o manifest
deste diretório antes de alterar o processo.

- Preserve claim atômico, tratamento de retry, idempotência e distinção entre
  `PRINTED`, `FAILED` e jobs ignorados. Reiniciar não deve duplicar tickets.
- Realtime é a via principal; polling é contingência. Não reintroduza consultas
  contínuas sem avaliar as reconexões e o custo no banco.
- Não inicie o serviço nem rode teste de impressora com credenciais reais sem
  autorização operacional. Build e verificação de tipos não imprimem.
- Valide a partir da raiz com `npm run typecheck --prefix print-worker` e
  `npm run build --prefix print-worker`. Testes existentes podem ser executados
  pelo Vitest da raiz, por exemplo `npm test -- print-worker/src/retry-policy.test.ts`.
- O PM2 executa `dist/`; alterações TypeScript precisam de build antes do restart.
  Não versione `dist/` nem imprima ou copie chaves de serviço.

Procedimento: [atualizações](../docs/development/updates.md).
