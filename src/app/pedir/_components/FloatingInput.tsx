"use client";

import { useId } from "react";

/**
 * Input com floating label estilo Material 3 — label sobe quando há valor ou foco.
 * `help` e `error` ficam ligados ao campo por `aria-describedby`, para o leitor
 * de tela anunciar o motivo/erro junto do rótulo.
 */
export function FloatingInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  name,
  help,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  name?: string;
  help?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(" ") || undefined;
  const filled = value.length > 0;
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={filled ? placeholder : ""}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`peer w-full rounded-xl border bg-[var(--bg-subtle)] px-4 pt-6 pb-2 text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10 disabled:opacity-60 ${
            error ? "border-[var(--status-danger)]" : "border-[var(--border)]"
          }`}
          style={{ height: 56 }}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-4 text-[var(--text-secondary)] transition-all motion-reduce:transition-none ${
            filled
              ? "top-2 text-caption font-medium"
              : "top-4 text-sm peer-focus:top-2 peer-focus:text-caption peer-focus:font-medium"
          }`}
        >
          {label}
        </label>
      </div>
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs font-semibold text-[var(--status-danger)]">
          {error}
        </span>
      )}
      {help && (
        <span id={helpId} className="mt-1 block text-caption leading-relaxed text-[var(--text-muted)]">
          {help}
        </span>
      )}
    </div>
  );
}
