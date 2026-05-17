import { Badge, BadgeVariant } from "@/components/ui/Badge";

const MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "Pendente", variant: "warning" },
  PRINTED: { label: "Impresso", variant: "success" },
  FAILED:  { label: "Falha",    variant: "destructive" },
};

export function PrintStatusBadge({ status }: { status: string }) {
  const config = MAP[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
