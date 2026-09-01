import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithAbortTimeout } from "./abort-timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("runWithAbortTimeout", () => {
  it("aborta uma consulta que ultrapassa o prazo e expõe uma mensagem acionável", async () => {
    vi.useFakeTimers();
    const timeoutMessage = "A consulta demorou demais. Tente novamente.";
    const request = runWithAbortTimeout(
      (signal) => new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
      8_000,
      timeoutMessage,
    );
    const assertion = expect(request).rejects.toThrow(timeoutMessage);

    await vi.advanceTimersByTimeAsync(8_000);

    await assertion;
  });

  it("preserva a falha original quando a chamada não expirou", async () => {
    const originalError = new Error("Servidor indisponível");

    await expect(
      runWithAbortTimeout(async () => {
        throw originalError;
      }, 8_000, "A consulta demorou demais. Tente novamente."),
    ).rejects.toBe(originalError);
  });
});
