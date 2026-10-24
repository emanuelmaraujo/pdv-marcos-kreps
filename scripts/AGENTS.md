# Scripts

- Leia o script e identifique os destinos antes de executá-lo. Os scripts de
  integração podem escrever pedidos, usuários e pagamentos em serviços externos.
- Use caminhos relativos à localização do script, preserve códigos de saída e
  encerre em caso de falha. Ferramentas locais devem funcionar no Windows.
- `check-docs.mjs` deve permanecer sem dependências e sem acesso à rede.
- `update-local.mjs` só pode buscar Git e atualizar por fast-forward: não deve
  limpar alterações, resolver conflitos, aplicar stash, publicar ou reiniciar serviços.
- Teste mudanças no atualizador em repositórios temporários, com remote local,
  sem usar a cópia de trabalho do usuário como fixture.
