"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { pdvApi, CreatePublicOrderResponse, MercadoPagoPaymentResponse } from "@/lib/api/pdv-api";
import { PAYMENT_METHOD_CODE, loadMercadoPagoScript } from "./payment-helpers";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";

export function MercadoPagoBrick({
  order,
  onResult,
  onPaid,
}: {
  order: CreatePublicOrderResponse["order"];
  onResult: (result: MercadoPagoPaymentResponse) => void;
  onPaid: () => void;
}) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

  useEffect(() => {
    let controller: { unmount: () => void } | null = null;
    let cancelled = false;

    async function renderBrick() {
      if (!publicKey) return;

      try {
        await loadMercadoPagoScript();
        if (cancelled || !window.MercadoPago) return;

        const mercadoPago = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mercadoPago.bricks();
        controller = await bricksBuilder.create("payment", "public-payment-brick", {
          initialization: {
            amount: Number(order.total_amount),
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              prepaidCard: "all",
              debitCard: "all",
            },
          },
          callbacks: {
            onReady: () => setIsReady(true),
            onSubmit: ({ formData }: { selectedPaymentMethod: string; formData: Record<string, unknown> }) => {
              return new Promise<void>((resolve, reject) => {
                const idempotencyKey = crypto.randomUUID();
                pdvApi.createMercadoPagoPayment({
                  order_id: order.order_id,
                  public_token: order.public_token,
                  payment_method_code: PAYMENT_METHOD_CODE,
                  form_data: formData,
                  idempotency_key: idempotencyKey,
                })
                  .then((response) => {
                    onResult(response);
                    if (!response.success) {
                      setError(response.error || "Nao foi possivel processar o pagamento.");
                      reject();
                      return;
                    }
                    if (response.payment?.status === "approved" || response.already_paid) {
                      onPaid();
                    }
                    resolve();
                  })
                  .catch((err) => {
                    setError(getFriendlyErrorMessage(err, "Não conseguimos processar o pagamento."));
                    reject();
                  });
              });
            },
            onError: (err: unknown) => {
              console.error("[MercadoPagoBrick] error", JSON.stringify(err, null, 2), err);
              setError("O checkout do Mercado Pago nao carregou corretamente.");
            },
          },
        });
      } catch (err) {
        setError(getFriendlyErrorMessage(err, "Não conseguimos iniciar o Mercado Pago."));
      }
    }

    renderBrick();

    return () => {
      cancelled = true;
      if (controller) controller.unmount();
    };
  }, [onPaid, onResult, order.order_id, order.public_token, order.total_amount, publicKey]);

  if (!publicKey) {
    return (
      <div className="rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: "var(--status-warning)", backgroundColor: "var(--status-warning-bg)", color: "var(--status-warning)" }}>
        Configure `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` para habilitar o pagamento no checkout.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--status-success)", backgroundColor: "var(--status-success-bg)", color: "var(--status-success)" }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <p className="text-sm font-black">Pagamento protegido pelo Mercado Pago</p>
        </div>
        <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">
          Cartao de credito, debito e outros meios aparecem conforme disponibilidade do Mercado Pago.
        </p>
      </div>
      {!isReady && !error && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm font-bold text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-brand-red" />
          Carregando pagamento seguro...
        </div>
      )}
      {error && (
        <div className="rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: "var(--status-danger)", backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)" }}>
          {error}
        </div>
      )}
      <div id="public-payment-brick" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3" />
    </div>
  );
}
