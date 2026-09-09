"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

const HOLD_DURATION_MS = 1_200;

interface HoldToConfirmDeliveryProps {
  orderNumber: number;
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => Promise<void>;
}

export function HoldToConfirmDelivery({
  orderNumber,
  disabled = false,
  loading = false,
  onConfirm,
}: HoldToConfirmDeliveryProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const [isHolding, setIsHolding] = useState(false);
  const [showAccessibleConfirmation, setShowAccessibleConfirmation] = useState(false);

  const clearHold = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsHolding(false);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const finish = async () => {
    if (completedRef.current || disabled || loading) return;
    completedRef.current = true;
    clearHold();
    try {
      navigator.vibrate?.([60, 40, 100]);
    } catch {
      // Vibração é apenas feedback adicional.
    }
    try {
      await onConfirm();
    } finally {
      completedRef.current = false;
      setShowAccessibleConfirmation(false);
    }
  };

  const startHold = () => {
    if (disabled || loading || timerRef.current) return;
    setIsHolding(true);
    try {
      navigator.vibrate?.(25);
    } catch {
      // Vibração é apenas feedback adicional.
    }
    timerRef.current = setTimeout(() => void finish(), HOLD_DURATION_MS);
  };

  const cancelHold = () => {
    if (!completedRef.current) clearHold();
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || loading}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          startHold();
        }}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") cancelHold();
        }}
        className="relative flex min-h-14 w-full touch-none select-none items-center justify-center overflow-hidden rounded-2xl border border-emerald-700 bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-900/15 outline-none transition focus-visible:ring-4 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
        aria-describedby={`hold-help-${orderNumber}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 origin-left bg-emerald-800 transition-transform ease-linear motion-reduce:transition-none"
          style={{
            transform: isHolding ? "scaleX(1)" : "scaleX(0)",
            transitionDuration: isHolding ? `${HOLD_DURATION_MS}ms` : "120ms",
          }}
        />
        <span className="relative flex items-center gap-2">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          {loading ? "Confirmando..." : isHolding ? "Continue segurando..." : "Segure para confirmar a entrega"}
        </span>
      </button>

      <p id={`hold-help-${orderNumber}`} className="text-center text-[11px] font-medium text-[var(--text-muted)]" aria-live="polite">
        A entrega só será concluída após manter o botão pressionado.
      </p>

      {!showAccessibleConfirmation ? (
        <button
          type="button"
          onClick={() => setShowAccessibleConfirmation(true)}
          disabled={disabled || loading}
          className="mx-auto block min-h-11 px-3 text-xs font-semibold text-[var(--text-secondary)] underline underline-offset-4"
        >
          Usar confirmação acessível
        </button>
      ) : (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3" role="group" aria-label="Confirmação acessível de entrega">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            O pedido #{orderNumber} foi entregue ao cliente?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowAccessibleConfirmation(false)}
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-bold text-[var(--text-secondary)]"
            >
              Ainda não
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={loading}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> Sim, foi entregue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
