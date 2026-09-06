"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Loader2, ShieldCheck } from "lucide-react";
import { pdvApi, CreatePublicOrderResponse } from "@/lib/api/pdv-api";
import { PAYMENT_METHOD_CODE, loadMercadoPagoScript, mapMercadoPagoStatus } from "./payment-helpers";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";

export function MercadoPagoBrick({
  order,
  onPaid,
}: {
  order: CreatePublicOrderResponse["order"];
  onPaid: () => void;
}) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  /** Pagamento aceito mas em análise (pending/in_process) — não é erro, mas o
   * cliente precisa saber que deve continuar esperando nesta tela. */
  const [notice, setNotice] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

  // Callbacks acessados via ref (não entram nas deps do efeito abaixo): o pai
  // (`/pedir`) passa arrow functions inline, recriadas a cada render dele. Se
  // entrassem nas deps, qualquer re-render do pai remontava o Brick inteiro,
  // apagando os dados de cartão que o cliente já tinha digitado no iframe.
  const onPaidRef = useRef(onPaid);
  useEffect(() => { onPaidRef.current = onPaid; }, [onPaid]);

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
        const created = await bricksBuilder.create("payment", "public-payment-brick", {
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
                    setNotice("");
                    if (!response.success) {
                      setError(response.error || "Nao foi possivel processar o pagamento.");
                      reject();
                      return;
                    }
                    if (response.already_paid) {
                      setError("");
                      onPaidRef.current();
                      resolve();
                      return;
                    }

                    // Recusa por risco volta como HTTP 200 + status "rejected",
                    // ou seja success: true. Sem ler o status aqui, a recusa
                    // mais comum não gerava nenhuma mensagem na tela.
                    const result = mapMercadoPagoStatus(
                      response.payment?.status,
                      response.payment?.status_detail,
                    );
                    if (result.kind === "approved") {
                      setError("");
                      onPaidRef.current();
                      resolve();
                      return;
                    }
                    if (result.kind === "pending") {
                      // Pedido segue válido; o polling da tela de pagamento leva
                      // pra confirmação quando o Mercado Pago aprovar.
                      setError("");
                      setNotice(result.message);
                      resolve();
                      return;
                    }
                    // reject() mantém o formulário do Brick preenchido pra nova
                    // tentativa — e cada submit gera um idempotency_key novo,
                    // então não há risco de reaproveitar a tentativa recusada.
                    setError(result.message);
                    reject();
                  })
                  .catch((err) => {
                    setNotice("");
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

        // O cleanup pode ter rodado enquanto o create() estava pendente — nesse
        // caso `controller` ainda era null quando ele checou, e sem isto o brick
        // recém-criado ficaria no DOM sem ninguém pra desmontar.
        if (cancelled) {
          created.unmount();
          return;
        }
        controller = created;
      } catch (err) {
        setError(getFriendlyErrorMessage(err, "Não conseguimos iniciar o Mercado Pago."));
      }
    }

    renderBrick();

    return () => {
      cancelled = true;
      if (controller) controller.unmount();
    };
  }, [order.order_id, order.public_token, order.total_amount, publicKey]);

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
        <div
          role="alert"
          className="rounded-2xl border p-4 text-sm font-bold"
          style={{ borderColor: "var(--status-danger)", backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)" }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border p-4 text-sm font-bold"
          style={{ borderColor: "var(--status-info)", backgroundColor: "var(--status-info-bg)", color: "var(--status-info)" }}
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {notice}
        </div>
      )}
      <div id="public-payment-brick" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3" />
    </div>
  );
}
