import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

// Tabela responsiva genérica para telas admin: tabela real em desktop, cards
// em mobile (via renderCard), paginação e estados de loading/vazio embutidos.
// Paginação é client-driven pelo caller (page/onPageChange) — funciona tanto
// para dados já paginados no servidor quanto para uma lista paginada em
// memória com useClientPagination.
export function DataTable<T>({
  columns,
  data,
  keyField,
  renderCard,
  loading = false,
  emptyMessage = "Nenhum registro encontrado.",
  page,
  pageSize,
  total,
  onPageChange,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyField: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const skeletonRows = Math.min(pageSize, 5);

  return (
    <div>
      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: skeletonRows }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))
        ) : data.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          data.map((item) => <div key={keyField(item)}>{renderCard(item)}</div>)
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)] ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, index) => (
                <tr key={index}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  <EmptyState message={emptyMessage} />
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={keyField(item)} className="transition-colors hover:bg-[var(--bg-subtle)]/60">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 align-middle ${col.className ?? ""}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text-secondary)]">
          <p>
            {startIndex}–{endIndex} de {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Próxima página"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Inbox className="h-8 w-8 text-[var(--text-muted)]" />
      <p className="text-sm font-semibold text-[var(--text-muted)]">{message}</p>
    </div>
  );
}
