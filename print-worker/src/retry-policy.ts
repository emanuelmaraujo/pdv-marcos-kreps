// Política de retry da fila de impressão.
//
// Módulo puro (sem Supabase, sem impressora) pra poder ser testado direto.
// A regra que ele codifica existe por causa de dois problemas reais:
//
//   1. Job que falha por impressora inalcançável voltava pra PENDING na hora,
//      sem nenhum atraso. Como claim_printer_jobs pega os mais antigos primeiro
//      (ORDER BY created_at LIMIT 10), bastavam 10 jobs de uma impressora
//      offline pra que TODO poll reivindicasse sempre os mesmos 10 e nunca
//      chegasse nos pedidos novos — a fila inteira parava, inclusive pras
//      filiais com impressora funcionando.
//   2. Não havia teto de tentativas: job de impressora que nunca volta ficava
//      girando na fila pra sempre, sem nunca aparecer em "Falhas" pro operador.
//
// Agora cada nova tentativa é adiada (backoff exponencial com teto), e depois
// de MAX_PRINT_ATTEMPTS o job vira FAILED pra fila drenar.

export const MAX_PRINT_ATTEMPTS = 60;

const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

// Impressora térmica em rede: praticamente todo erro de transporte é
// transitório (equipamento desligado, cabo caído, Wi-Fi oscilando). Só o que
// não casa aqui — payload inválido, setor inexistente, erro do driver — é que
// vira falha definitiva, porque tentar de novo daria exatamente o mesmo erro.
const RETRYABLE_HINTS = [
  'offline',
  'inalcancavel',
  'unreachable',
  'econnrefused',
  'econnreset',
  'econnaborted',
  'ehostunreach',
  'ehostdown',
  'enetunreach',
  'enetdown',
  'etimedout',
  'epipe',
  'eai_again',
  'getaddrinfo',
  'timeout',
  'connect',
  'socket',
  'network',
];

export function isRetryableError(message: string): boolean {
  const normalized = String(message ?? '').toLowerCase();
  return RETRYABLE_HINTS.some((hint) => normalized.includes(hint));
}

/** Backoff exponencial (2s, 4s, 8s, ...) com teto de 60s. */
export function retryDelayMs(attemptCount: number): number {
  const attempt = Number.isFinite(attemptCount) && attemptCount > 0 ? Math.floor(attemptCount) : 1;
  const exponent = Math.min(attempt - 1, 30);
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
}

export interface RetryDecision {
  status: 'PENDING' | 'FAILED';
  delayMs: number;
  errorMessage: string;
}

/**
 * Decide o destino de um job que acabou de falhar.
 * `attemptCount` é o valor já incrementado por claim_printer_jobs.
 */
export function decideRetry(errorMessage: string, attemptCount: number): RetryDecision {
  const message = String(errorMessage ?? '').trim() || 'Erro desconhecido na impressao';

  if (!isRetryableError(message)) {
    return { status: 'FAILED', delayMs: 0, errorMessage: message };
  }

  if (attemptCount >= MAX_PRINT_ATTEMPTS) {
    return {
      status: 'FAILED',
      delayMs: 0,
      errorMessage: `${message} (desistindo apos ${attemptCount} tentativas)`,
    };
  }

  return { status: 'PENDING', delayMs: retryDelayMs(attemptCount), errorMessage: message };
}

/** Instante em que o job pode ser reivindicado de novo, em ISO. */
export function nextAttemptAt(delayMs: number, now: number = Date.now()): string {
  return new Date(now + Math.max(0, delayMs)).toISOString();
}
