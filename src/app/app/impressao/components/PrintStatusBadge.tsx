import { Badge, BadgeVariant } from "@/components/ui/Badge";

const MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING:    { label: "Pendente",   variant: "warning" },
  PROCESSING: { label: "Imprimindo", variant: "warning" },
  PRINTED:    { label: "Impresso",   variant: "success" },
  FAILED:     { label: "Falha",      variant: "destructive" },
  SKIPPED:    { label: "Pulado",     variant: "neutral" },
};

export function PrintStatusBadge({ status }: { status: string }) {
  const config = MAP[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
