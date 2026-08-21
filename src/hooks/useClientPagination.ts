import { useMemo, useState } from "react";

// Pagina uma lista já filtrada em memória (uso: Usuários/Filiais, volumes
// pequenos — dezenas a poucas centenas de linhas). Não busca página nenhuma
// do servidor; o caller filtra/ordena `items` antes de passar aqui.
export function useClientPagination<T>(items: T[], pageSize = 10) {
  const [rawPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Se o filtro encolheu a lista e a página guardada ficou fora do range
  // (ex: usuário estava na página 3 e um filtro deixou só 1 página), exibe
  // a última página válida em vez de uma página vazia — sem precisar
  // sincronizar de volta pro estado via efeito.
  const page = Math.min(rawPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    pageItems,
    totalPages,
    total: items.length,
  };
}
