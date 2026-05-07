import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PrintStatusBadge } from "./PrintStatusBadge";
import { pdvApi } from "@/lib/api/pdv-api";
import { useState } from "react";
import { PrinterJob } from "@/types/pdv";

interface Props {
  job: PrinterJob;
  onJobUpdated: () => void;
}

export function PrinterJobCard({ job, onJobUpdated }: Props) {
  const [isReprinting, setIsReprinting] = useState(false);
  
  const handleReprint = async () => {
    setIsReprinting(true);
    try {
      await pdvApi.reprintOrder({
        orderId: job.order_id,
        copies: [job.sector]
      });
      alert('Reimpressão solicitada! Novo job foi gerado na fila.');
      onJobUpdated();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Erro ao reimprimir');
      }
    } finally {
      setIsReprinting(false);
    }
  };

  return (
    <Card className={`p-4 mb-3 ${job.status === 'FAILED' ? 'border-red-500 border-2 bg-red-50' : job.status === 'PENDING' ? 'border-amber-400 border-2' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-bold text-lg">Pedido #{job.order?.daily_number}</span>
          <span className="text-xs text-muted-foreground ml-2">Via: {job.sector}</span>
        </div>
        <PrintStatusBadge status={job.status} />
      </div>

      <div className="text-sm space-y-1 mb-3">
        <p><strong>Cliente:</strong> {job.order?.customer_name || 'N/A'}</p>
        <p><strong>Total:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(job.order?.total_amount || 0)}</p>
        <p><strong>Criado em:</strong> {new Date(job.created_at).toLocaleTimeString()}</p>
        {job.printed_at && <p><strong>Impresso em:</strong> {new Date(job.printed_at).toLocaleTimeString()}</p>}
      </div>

      {job.status === 'FAILED' && job.error_message && (
        <div className="text-sm text-red-600 bg-red-100 p-2 rounded mb-3 font-medium">
          Erro: {job.error_message}
        </div>
      )}

      {/* Content preview */}
      <div className="bg-muted p-2 rounded text-xs font-mono overflow-hidden h-16 text-ellipsis whitespace-pre-wrap opacity-70 mb-3">
        {JSON.stringify(job.content)}
      </div>

      <Button 
        variant="outline" 
        className="w-full" 
        onClick={handleReprint}
        disabled={isReprinting}
      >
        {isReprinting ? "Solicitando..." : "Reimprimir esta Via"}
      </Button>
    </Card>
  );
}
