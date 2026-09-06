import { describe, expect, it } from 'vitest';
import {
  MAX_PRINT_ATTEMPTS,
  decideRetry,
  isRetryableError,
  nextAttemptAt,
  retryDelayMs,
} from './retry-policy';

describe('isRetryableError', () => {
  it('trata erro de transporte da impressora como transitório', () => {
    const transitorios = [
      'Impressora offline ou inalcancavel em 192.168.0.50:9100',
      'connect ECONNREFUSED 192.168.0.50:9100',
      'read ECONNRESET',
      'connect EHOSTUNREACH 192.168.0.77:9100',
      'connect ETIMEDOUT',
      'socket hang up',
      'getaddrinfo EAI_AGAIN impressora.local',
    ];
    for (const message of transitorios) {
      expect(isRetryableError(message), message).toBe(true);
    }
  });

  it('não repete erro que daria exatamente o mesmo resultado', () => {
    expect(isRetryableError('Cannot read properties of undefined')).toBe(false);
    expect(isRetryableError('conteudo do ticket vazio')).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('cresce exponencialmente a partir de 2s', () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(2)).toBe(4_000);
    expect(retryDelayMs(3)).toBe(8_000);
    expect(retryDelayMs(4)).toBe(16_000);
  });

  it('trava em 60s pra impressora que volta ser reencontrada rápido', () => {
    expect(retryDelayMs(10)).toBe(60_000);
    expect(retryDelayMs(999)).toBe(60_000);
  });

  it('aceita contagem inválida sem estourar', () => {
    expect(retryDelayMs(0)).toBe(2_000);
    expect(retryDelayMs(Number.NaN)).toBe(2_000);
  });
});

describe('decideRetry', () => {
  it('devolve pra fila com atraso quando a impressora está inalcançável', () => {
    const decision = decideRetry('Impressora offline ou inalcancavel em 192.168.0.50:9100', 3);
    expect(decision.status).toBe('PENDING');
    // O atraso é o que impede o poll de reivindicar sempre os mesmos jobs
    // mortos e nunca alcançar os pedidos novos.
    expect(decision.delayMs).toBe(8_000);
  });

  it('falha na hora quando repetir não adiantaria', () => {
    const decision = decideRetry('sector desconhecido', 1);
    expect(decision.status).toBe('FAILED');
    expect(decision.delayMs).toBe(0);
  });

  it('desiste depois do teto de tentativas pra fila drenar', () => {
    const decision = decideRetry('connect ECONNREFUSED', MAX_PRINT_ATTEMPTS);
    expect(decision.status).toBe('FAILED');
    expect(decision.errorMessage).toContain(`${MAX_PRINT_ATTEMPTS} tentativas`);
  });

  it('ainda tenta na última tentativa antes do teto', () => {
    expect(decideRetry('connect ECONNREFUSED', MAX_PRINT_ATTEMPTS - 1).status).toBe('PENDING');
  });

  it('nunca grava mensagem vazia', () => {
    expect(decideRetry('', 1).errorMessage).toBe('Erro desconhecido na impressao');
  });
});

describe('nextAttemptAt', () => {
  it('agenda o instante futuro em ISO', () => {
    const now = Date.parse('2026-09-06T12:00:00.000Z');
    expect(nextAttemptAt(8_000, now)).toBe('2026-09-06T12:00:08.000Z');
  });

  it('não agenda pro passado', () => {
    const now = Date.parse('2026-09-06T12:00:00.000Z');
    expect(nextAttemptAt(-5_000, now)).toBe('2026-09-06T12:00:00.000Z');
  });
});
