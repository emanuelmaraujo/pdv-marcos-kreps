"use client";

import { useEffect, useState } from "react";
import { QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pdvApi, CreatePublicOrderResponse, MercadoPagoPaymentResponse } from "@/lib/api/pdv-api";
import { PIX_PAYMENT_METHOD_CODE, cpfDigits, formatCpfInput, isValidCpf, isValidEmail } from "./payment-helpers";
import { PixResult } from "./PixResult";

export function PixCheckout({
  order,
  payerEmail,
  onPayerEmailChange,
  onPaid,
}: {
  order: CreatePublicOrderResponse["order"];
  payerEmail: string;
  onPayerEmailChange: (email: string) => void;
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
        setError(response.error || "Nao foi possivel gerar o Pix.");
        setPixIdempotencyKey(crypto.randomUUID());
        return;
      }
      if (response.payment?.status === "approved" || response.already_paid) {
        onPaid();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar Pix.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--status-info)", backgroundColor: "var(--status-info-bg)", color: "var(--status-info)" }}>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          <p className="text-sm font-black">Pix copia e cola</p>
        </div>
        <p className="mt-1 text-xs font-semibold leading-relaxed opacity-90">
          Gere o codigo, pague pelo banco e deixe esta tela aberta. A confirmacao aparece automaticamente.
        </p>
      </div>

      <input
        value={payerEmail}
        onChange={(event) => onPayerEmailChange(event.target.value)}
        placeholder="E-mail exigido pelo Mercado Pago para Pix"
        type="email"
        disabled={!!payment}
        className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 text-base font-bold text-[var(--text-primary)] outline-none focus:border-brand-red disabled:opacity-60"
      />
      <input
        value={payerCpf}
        onChange={(event) => setPayerCpf(formatCpfInput(event.target.value))}
        placeholder="CPF opcional, usado se o Mercado Pago exigir"
        type="text"
        inputMode="numeric"
        disabled={!!payment}
        className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 text-base font-bold text-[var(--text-primary)] outline-none focus:border-brand-red disabled:opacity-60"
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
