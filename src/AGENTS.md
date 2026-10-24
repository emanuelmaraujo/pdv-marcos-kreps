# Frontend

As regras da raiz continuam valendo. Antes de alterar Next/React, leia o guia
correspondente em `../node_modules/next/dist/docs/`, resolvido a partir deste diretório.

- Use App Router e preserve a fronteira servidor/cliente; adicione `use client`
  somente onde houver interatividade ou APIs do browser. Não importe segredos em UI.
- Siga os componentes e tokens existentes. Interface em pt-BR, com estados de
  carregamento, vazio, erro e prevenção de ações duplicadas.
- Trate operações financeiras, autorização e regras de preço no servidor.
  Preserve isolamento por filial e os contratos dos adaptadores em `lib/api/`.
- Ao alterar pedidos, confira sincronização, concorrência de refresh e reconciliação
  após mutações; preserve os testes em `lib/utils/`.
- Valide com testes da área, `npm run typecheck` e lint. Para mudanças visuais,
  verifique o fluxo afetado em viewport mobile e desktop e relate limitações.

Mapa: [arquitetura](../docs/architecture/overview.md).
