import { FileQuestion, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Ícone Lucide específico do contexto. Default: FileQuestion. */
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon: Icon = FileQuestion,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
      <div className="rounded-full bg-[var(--bg-subtle)] p-4">
        <Icon className="h-7 w-7 text-[var(--text-muted)]" strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
        {description && <p className="text-sm text-[var(--text-secondary)]">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
