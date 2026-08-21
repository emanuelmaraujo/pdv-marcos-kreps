"use client";

/** Input com floating label estilo Material 3 — label sobe quando há valor ou foco. */
export function FloatingInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  help?: string;
}) {
  const filled = value.length > 0;
  return (
    <label className="block">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={filled ? placeholder : ""}
          type={type}
          inputMode={inputMode}
          className="peer w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 pt-6 pb-2 text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
          style={{ height: 56 }}
        />
        <span
          className={`pointer-events-none absolute left-4 text-[var(--text-secondary)] transition-all ${
            filled
              ? "top-2 text-caption font-medium"
              : "top-4 text-sm peer-focus:top-2 peer-focus:text-caption peer-focus:font-medium"
          }`}
        >
          {label}
        </span>
      </div>
      {help && (
        <span className="mt-1 block text-caption leading-relaxed text-[var(--text-muted)]">
          {help}
        </span>
      )}
    </label>
  );
}
