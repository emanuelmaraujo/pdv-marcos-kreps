"use client";

/**
 * Landing pública de /pedir (sem slug).
 *
 * Mostrado quando o cliente acessa /pedir sem escolher uma filial.
 * Tem duas ações primárias:
 *   1. Escolher uma filial para pedir
 *   2. Acompanhar um pedido existente (cola o link/token)
 *
 * Esta página é o "hub" da marca — facilita divulgar uma URL única
 * (/pedir) e deixar o cliente decidir.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  Clock,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  Tent,
} from "lucide-react";
import { pdvApi, PublicBranch } from "@/lib/api/pdv-api";

const BRANCH_TYPE_META: Record<string, { label: string; icon: typeof Store }> = {
  STORE: { label: "Loja",   icon: Store },
  POPUP: { label: "Pop-up", icon: Tent },
  FAIR:  { label: "Feira",  icon: Tent },
};

/**
 * Cor estável de avatar derivada do slug — mesma filial sempre recebe
 * a mesma cor. Sem preto (não compete com brand) e sem brand-red puro.
 */
const AVATAR_PALETTE = ["#2563EB", "#0891B2", "#0F766E", "#16A34A", "#CA8A04", "#EA580C", "#9333EA", "#0D9488"];

function avatarColorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

/** Extrai o token do que o usuário colou (URL completa ou apenas o token). */
function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Suporta /pedido/{token}, pedido/{token} ou só o token
  const match = trimmed.match(/(?:pedido\/)?([a-f0-9]{32})/i);
  return match ? match[1] : null;
}

export function PedirLanding() {
  const router = useRouter();
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingInput, setTrackingInput] = useState("");
  const [trackingError, setTrackingError] = useState("");

  useEffect(() => {
    let cancelled = false;
    pdvApi.getPublicBranches().then((res) => {
      if (cancelled) return;
      setBranches(res.branches ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const token = extractToken(trackingInput);
    if (!token) {
      setTrackingError("Cole o link completo ou o código do pedido (32 caracteres).");
      return;
    }
    setTrackingError("");
    router.push(`/pedido/${token}`);
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "var(--bg-base)" }}>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden text-white px-5 pt-8 pb-10 sm:px-8"
        style={{ backgroundColor: "var(--bg-inverse)" }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-red/20 blur-3xl" />
        <div className="pointer-events-none absolute right-12 bottom-0 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-2xl" />

        <div className="relative mx-auto max-w-md flex flex-col items-center text-center gap-3">
          <Image
            src="/logo.png"
            alt="Marcos Krep's"
            width={64}
            height={64}
            className="h-14 w-14 rounded-full ring-2 ring-white/15"
            priority
          />
          <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Bem-vindo ao Marcos Krep&apos;s
          </h1>
          <p className="text-sm text-white/70 max-w-sm">
            Escolha onde pedir ou acompanhe um pedido em andamento.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-md px-4 -mt-6 space-y-4 relative">

        {/* ── Acompanhar pedido (acima das filiais — é a ação mais urgente) ── */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--status-info-bg)]">
              <Package className="h-4 w-4" strokeWidth={1.75} style={{ color: "var(--status-info, #2563EB)" }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Já fez um pedido?</h2>
              <p className="text-xs text-[var(--text-secondary)]">Cole o link ou o código pra acompanhar</p>
            </div>
          </div>

          <form onSubmit={handleTrack} className="space-y-2">
            <input
              type="text"
              value={trackingInput}
              onChange={(e) => { setTrackingInput(e.target.value); setTrackingError(""); }}
              placeholder="Link do pedido ou código"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {trackingError && (
              <p className="text-xs text-[var(--status-danger)]">{trackingError}</p>
            )}
            <button
              type="submit"
              disabled={!trackingInput.trim()}
              className="w-full flex items-center justify-center gap-1.5 rounded-full bg-[var(--bg-inverse)] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ height: 44 }}
            >
              Acompanhar pedido
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
        </section>

        {/* ── Lista de filiais ───────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Onde quer pedir?</h2>
            {branches.length > 0 && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {branches.length} {branches.length === 1 ? "unidade" : "unidades"}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                Nenhuma unidade está recebendo pedidos online no momento.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {branches.map((branch) => {
                const meta = BRANCH_TYPE_META[branch.type] ?? BRANCH_TYPE_META.STORE;
                const Icon = meta.icon;
                const avatarColor = avatarColorFor(branch.id || branch.slug);
                return (
                  <li key={branch.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/pedir/${branch.slug}`)}
                      className="w-full text-left flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] active:scale-[0.99]"
                    >
                      {/* Avatar com cor estável por filial */}
                      <div
                        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: avatarColor }}
                      >
                        <span className="text-[10px] font-medium opacity-80">{branch.code}</span>
                        <Icon className="h-4 w-4 mt-0.5" strokeWidth={1.75} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {branch.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                          <span className="inline-flex items-center gap-0.5">
                            <span>{meta.label}</span>
                          </span>
                          {branch.ordering_start_time && branch.ordering_end_time && (
                            <>
                              <span className="text-[var(--text-muted)]">·</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Clock className="h-3 w-3" strokeWidth={1.75} />
                                {branch.ordering_start_time}–{branch.ordering_end_time}
                              </span>
                            </>
                          )}
                        </div>
                        {branch.address && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)] truncate">
                            <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{branch.address}</span>
                          </p>
                        )}
                      </div>

                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Bullet de ajuda ─────────────────────────────────────── */}
        <p className="px-2 pt-2 text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
          <ShoppingBag className="inline h-3 w-3 mr-1 align-text-bottom" strokeWidth={1.75} />
          Pagamento seguro via PIX ou cartão. Notificação por WhatsApp quando o pedido ficar pronto.
        </p>
      </main>
    </div>
  );
}
