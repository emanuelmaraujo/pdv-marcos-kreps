export function StatPill({
  label,
  value,
  tone = "neutral",
  light = false,
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "red";
  light?: boolean;
}) {
  if (light) {
    // Light variant for use inside white content panels
    const styles = {
      neutral: { card: "border-[var(--border)] bg-[var(--bg-subtle)]", value: "text-[var(--text-secondary)]", dot: "bg-[var(--text-muted)]", label: "text-[var(--text-muted)]" },
      green:   { card: "border-[var(--status-success)]/25 bg-[var(--status-success-bg)]", value: "text-[var(--status-success)]", dot: "bg-[var(--status-success)]", label: "text-[var(--status-success)]" },
      red:     { card: "border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)]", value: "text-[var(--status-danger)]", dot: "bg-[var(--status-danger)]", label: "text-[var(--status-danger)]" },
    }[tone];
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${styles.card}`}>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
          <p className={`text-sm font-black leading-none ${styles.value}`}>{value}</p>
        </div>
        <p className={`mt-1 text-[10px] font-medium truncate ${styles.label}`}>{label}</p>
      </div>
    );
  }

  // Dark sidebar variant
  const dot = { neutral: "bg-zinc-500", green: "bg-emerald-400", red: "bg-red-400" }[tone];
  const valueColor = { neutral: "text-zinc-200", green: "text-emerald-300", red: "text-red-300" }[tone];

  return (
    <div className="rounded-xl bg-white/8 px-3 py-2.5 border border-white/10">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className={`text-xs font-black leading-none ${valueColor}`}>{value}</p>
      </div>
      <p className="mt-1 text-[10px] font-medium text-zinc-500 truncate">{label}</p>
    </div>
  );
}
