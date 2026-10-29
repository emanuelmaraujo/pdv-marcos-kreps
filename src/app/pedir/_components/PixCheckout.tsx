"use client";

import { useEffect, useState } from "react";
import { FloatingInput } from "./FloatingInput";
import { QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pdvApi, CreatePublicOrderResponse, MercadoPagoPaymentResponse } from "@/lib/api/pdv-api";
import { PIX_PAYMENT_METHOD_CODE, cpfDigits, formatCpfInput, isValidCpf, isValidEmail } from "./payment-helpers";
import { PixResult } from "./PixResult";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";

export function PixCheckout({
  order,
  payerEmail,
  onPayerEmailChange,
  onPayerEmailCommit,
  onPaid,
}: {
  order: CreatePublicOrderResponse["order"];
  payerEmail: string;
  onPayerEmailChange: (email: string) => void;
  /** Chamado quando o cliente termina de digitar (blur) — é o momento de
   * persistir, em vez de a cada tecla. */
  onPayerEmailCommit?: (email: string) => void;
  onPaid: () => void;
}) {
  const [payment, setPayment] = useState<MercadoPagoPaymentResponse | null>(null);
  const [waitExpiresAt, setWaitExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [pixIdempotencyKey, setPixIdempotencyKey] = useState(() => crypto.randomUUID());
  const [now, setNow] = useState(() => Date.now());
  const [payerCpf, setPayerCpf] = useState("");

  useEffect(() => {
    if (!payment) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [payment]);

  const hasActivePix = !!payment?.transaction?.qr_code && !!waitExpiresAt && new Date(waitExpiresAt).getTime() > now;

  const handleGeneratePix = async () => {
    if (isGenerating || hasActivePix) return;
    setError("");
    if (!isValidEmail(payerEmail)) {
      setError("Informe um e-mail valido para gerar o Pix pelo Mercado Pago.");
      return;
    }
    if (payerCpf.trim() && !isValidCpf(payerCpf)) {
      setError("Informe um CPF valido para gerar o Pix pelo Mercado Pago.");
      return;
    }

    setIsGenerating(true);
    const requestIdempotencyKey = payment && !hasActivePix ? crypto.randomUUID() : pixIdempotencyKey;
    if (requestIdempotencyKey !== pixIdempotencyKey) setPixIdempotencyKey(requestIdempotencyKey);

    try {
      const formData: Record<string, unknown> = {
        payment_method_id: "pix",
        email: payerEmail.trim(),
      };
      if (isValidCpf(payerCpf)) {
        formData.identificationType = "CPF";
        formData.identificationNumber = cpfDigits(payerCpf);
      }

      const response = await pdvApi.createMercadoPagoPayment({
        order_id: order.order_id,
        public_token: order.public_token,
        payment_method_code: PIX_PAYMENT_METHOD_CODE,
        direct_payment_method: "pix",
        form_data: formData,
        idempotency_key: requestIdempotencyKey,
      });

      setPayment(response);
      setWaitExpiresAt(response.transaction?.expires_at ?? null);

      if (!response.success) {
        setError(response.error || "Não foi possível gerar o Pix.");
        setPixIdempotencyKey(crypto.randomUUID());
        return;
      }
      if (response.payment?.status === "approved" || response.already_paid) {
        onPaid();
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Não conseguimos gerar o Pix agora. Tente novamente."));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)]">
          <QrCode className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">Pix copia e cola</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            Gere o código, pague pelo app do banco e deixe esta tela aberta. A confirmação aparece automaticamente.
          </p>
        </div>
      </div>

      <FloatingInput
        label="E-mail para o Pix"
        name="email"
        autoComplete="email"
        type="email"
        inputMode="email"
        value={payerEmail}
        onChange={onPayerEmailChange}
        onBlur={() => onPayerEmailCommit?.(payerEmail)}
        disabled={!!payment}
        help="O Mercado Pago exige um e-mail para gerar o Pix."
      />
      <FloatingInput
        label="CPF (opcional)"
        name="cpf"
        inputMode="numeric"
        value={payerCpf}
        onChange={(value) => setPayerCpf(formatCpfInput(value))}
        disabled={!!payment}
        help="Só é usado se o Mercado Pago pedir."
      />

      {!payment && (
        <Button className="w-full gap-2" loading={isGenerating} onClick={handleGeneratePix}>
          <QrCode className="h-4 w-4" />
          Gerar Pix copia e cola
        </Button>
      )}

      {payment && <PixResult payment={payment} waitExpiresAt={waitExpiresAt} />}

      {payment && !hasActivePix && (
        <Button variant="outline" className="w-full gap-2" loading={isGenerating} onClick={handleGeneratePix}>
          <RefreshCw className="h-4 w-4" />
          Gerar novo Pix
        </Button>
      )}

      {error && (
        <div className="rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: "var(--status-danger)", backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)" }}>
          {error}
        </div>
      )}
    </section>
  );
}
