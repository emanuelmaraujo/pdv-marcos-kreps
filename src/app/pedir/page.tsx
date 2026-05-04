"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Package } from "lucide-react";
import { useCart } from "@/features/cart/useCart";

export default function PedirPublicPage() {
  const { items, getEstimatedSubtotal } = useCart();
  const [step, setStep] = useState<"MENU" | "CHECKOUT">("MENU");

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Public Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-center border-b border-border bg-background/90 px-4 backdrop-blur-md shadow-sm">
        <div className="flex items-center space-x-2 text-primary">
          <Package className="h-6 w-6" />
          <h1 className="text-lg font-bold tracking-tight text-foreground">Marcos Krep&apos;s</h1>
        </div>
      </header>
      
      <main className="p-4 space-y-6 mx-auto max-w-md">
        {step === "MENU" ? (
          <>
            {/* Categorias Públicas */}
            <section>
              <div className="flex space-x-3 overflow-x-auto pb-2 hide-scrollbar">
                <Button variant="default" size="sm" className="rounded-full">Todos</Button>
                <Button variant="outline" size="sm" className="rounded-full">Kreps</Button>
                <Button variant="outline" size="sm" className="rounded-full">Sucos</Button>
              </div>
            </section>

            {/* Produtos */}
            <section className="space-y-3">
              <Card>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">Krep de Frango</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">Frango, catupiry, milho, azeitona.</p>
                    <p className="font-bold mt-1">R$ 18,00</p>
                  </div>
                  <Button size="sm" variant="outline">Adicionar</Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">Suco de Laranja</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">Natural, 500ml.</p>
                    <p className="font-bold mt-1">R$ 8,00</p>
                  </div>
                  <Button size="sm" variant="outline">Adicionar</Button>
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Quase lá!</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seu Nome ou Apelido</label>
                  <Input placeholder="Como devemos te chamar?" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp (Opcional)</label>
                  <Input placeholder="(11) 99999-9999" type="tel" />
                  <p className="text-xs text-muted-foreground">Para enviarmos a via e te avisarmos quando estiver pronto.</p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Cart Summary Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border shadow-lg z-50">
        <div className="mx-auto max-w-md">
          {step === "MENU" ? (
            <Button 
              className="w-full" 
              onClick={() => setStep("CHECKOUT")}
              disabled={items.length === 0} // in this mockup it's always 0 unless state changes
            >
              Ver Carrinho (R$ {getEstimatedSubtotal().toFixed(2)})
            </Button>
          ) : (
            <div className="flex space-x-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("MENU")}>Voltar</Button>
              <Button className="flex-[2]">Enviar Pedido</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
