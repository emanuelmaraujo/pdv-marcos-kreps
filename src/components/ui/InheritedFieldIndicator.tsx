import { RotateCcw } from "lucide-react";
import type { ConfigSource } from "@/lib/config/effective-branch-config";

// Selo usado em campos de Filial que podem herdar o padrão global (Impressão,
// WhatsApp). "global" = a filial não customizou, está usando o padrão da
// rede; "branch" = esta filial tem um valor próprio, com botão pra resetar.
export function InheritedFieldIndicator({
  source,
  onReset,
}: {
  source: ConfigSource;
  onReset?: () => void;
}) {
  if (source === "global") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] ring-1 ring-[var(--border)]">
        Herdado do padrão
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-warning-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--status-warning)] ring-1 ring-[var(--status-warning)]/25">
      Customizado nesta filial
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-0.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[var(--status-warning)] transition-colors hover:bg-[var(--status-warning)]/15"
          title="Voltar a usar o padrão global"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
