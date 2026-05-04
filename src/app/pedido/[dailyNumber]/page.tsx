import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Package, Clock } from "lucide-react";

export default function PedidoStatusPage({ params }: { params: { dailyNumber: string } }) {
  // In a real implementation we would fetch order details via pdvApi.getPublicOrderStatus
  
  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-24">
      <div className="mx-auto max-w-md space-y-6 pt-8">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-2">
            <Package className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Pedido #{params.dailyNumber}</h1>
          <Badge variant="warning" className="text-base py-1 px-4">
            Na Fila de Preparo
          </Badge>
          <p className="text-muted-foreground text-sm mt-2">Aguarde, seu pedido já está sendo preparado.</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold border-b border-border pb-2">Resumo</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">1x Krep de Frango</p>
                  <p className="text-xs text-muted-foreground">Sem milho</p>
                </div>
                <p className="font-medium text-muted-foreground">R$ 18,00</p>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">1x Suco Laranja</p>
                </div>
                <p className="font-medium text-muted-foreground">R$ 8,00</p>
              </div>
            </div>
            
            <div className="border-t border-border pt-3 mt-3 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg text-primary">R$ 26,00</span>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Fique de olho no painel ou nesta tela para retirar.</span>
        </div>
      </div>
    </div>
  );
}
