import { Badge } from "@/components/ui/Badge";

export function PrintStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
    PENDING: { label: "Pendente", variant: "default" },
    FAILED: { label: "Falha", variant: "destructive" },
    PRINTED: { label: "Impresso", variant: "outline" },
  };

  const config = map[status] || { label: status, variant: "outline" };
  const customClass = status === 'PENDING' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : '';
  
  return <Badge variant={config.variant} className={customClass}>{config.label}</Badge>;
}
