// Constantes e helpers compartilhados pelo checkout de pagamento do /pedir
// (MercadoPagoBrick, PixCheckout, PixResult).

export const PAYMENT_METHOD_CODE = "MERCADO_PAGO_PAYMENT_BRICK";
export const PIX_PAYMENT_METHOD_CODE = "PIX";
export const PIX_WAIT_MINUTES = 5;

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => {
      bricks: () => {
        create: (type: string, containerId: string, settings: Record<string, unknown>) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

export function loadMercadoPagoScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Erro ao carregar Mercado Pago.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Erro ao carregar Mercado Pago."));
    document.body.appendChild(script);
  });
}

export function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function cpfDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidCpf(value: string) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export function formatCpfInput(value: string) {
  const digits = cpfDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
