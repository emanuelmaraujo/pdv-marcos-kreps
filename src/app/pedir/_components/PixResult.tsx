"use client";

import { useEffect, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MercadoPagoPaymentResponse } from "@/lib/api/pdv-api";
import { PIX_WAIT_MINUTES, formatCountdown } from "./payment-helpers";

export function PixResult({
  payment,
  waitExpiresAt,
}: {
  payment: MercadoPagoPaymentResponse;
  waitExpiresAt?: string | null;
}) {
  const transaction = payment.transaction;
  const qrBase64 = transaction?.qr_code_base64;
  const qrCode = transaction?.qr_code;
  const ticketUrl = transaction?.ticket_url;
  const [copied, setCopied] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!waitExpiresAt) return PIX_WAIT_MINUTES * 60 * 1000;
    return new Date(waitExpiresAt).getTime() - Date.now();
  });

  useEffect(() => {
    if (!waitExpiresAt) return;
    const updateRemaining = () => setRemainingMs(new Date(waitExpiresAt).getTime() - Date.now());
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [waitExpiresAt]);

  if (!qrBase64 && !qrCode && !ticketUrl) return null;

  const isExpired = remainingMs <= 0;

  return (
    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--status-info)", backgroundColor: "var(--status-info-bg)" }}>
      <div className="flex items-center justify-between gap-3" style={{ color: "var(--status-info)" }}>
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-widest">Pix gerado</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-black"
          style={isExpired
            ? { backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)" }
            : { backgroundColor: "var(--bg-surface)", color: "var(--status-info)" }}
        >
          {isExpired ? "Tempo esgotado" : formatCountdown(remainingMs)}
        </span>
      </div>
      <p className="text-sm font-semibold leading-relaxed text-[var(--text-secondary)]">
        Copie o codigo Pix ou escaneie o QR Code. Mantenha esta tela aberta enquanto conferimos a aprovacao.
      </p>
      {qrBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${qrBase64}`}
          alt="QR Code Pix"
          className="mx-auto h-56 w-56 rounded-xl bg-white p-2"
        />
      )}
      {qrCode && (
        <Button
          variant="outline"
          className="w-full gap-2"
          style={{ borderColor: "var(--status-info)", color: "var(--status-info)" }}
          onClick={async () => {
            await navigator.clipboard.writeText(qrCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Copy className="h-4 w-4" />
          {copied ? "Codigo copiado" : "Copiar Pix copia e cola"}
        </Button>
      )}
      {ticketUrl && (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl bg-brand-red px-4 py-3 text-center text-sm font-black uppercase tracking-wide text-white hover:bg-brand-red-dark"
        >
          Abrir Pix no Mercado Pago
        </a>
      )}
    </div>
  );
}
