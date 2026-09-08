"use client";

/**
 * Página pública de filiais: /pedir/filiais.
 *
 * Tem duas ações primárias:
 *   1. Escolher uma filial para pedir
 *   2. Acompanhar um pedido existente (cola o link/token)
 *
 * Já foi a landing de /pedir (sem slug). Hoje /pedir abre direto no
 * cardápio da filial principal — o material divulgado (QR Code) aponta
 * pra lá — e esta tela é o "hub" pra quem quer ver as outras unidades.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  Clock,
  Loader2,
  MapPin,
  ShoppingBag,
  Store,
  Tent,
} from "lucide-react";
import { pdvApi, PublicBranch } from "@/lib/api/pdv-api";
import { AcompanharPedido } from "./_components/AcompanharPedido";

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

export function PedirLanding() {
  const router = useRouter();
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loading, setLoading] = useState(true);
  /** Slug da filial que o cliente acabou de tocar — mostra spinner no botão
   * em vez de deixar a tela "travada" enquanto a rota da filial carrega. */
  const [navigatingSlug, setNavigatingSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdvApi.getPublicBranches()
      .then((res) => {
        if (cancelled) return;
        const loadedBranches = res.branches ?? [];
        setBranches(loadedBranches);
        // Prefetch das rotas de filial — ao tocar, a navegação já está pronta.
        loadedBranches.forEach((branch) => router.prefetch(`/pedir/${branch.slug}`));
      })
      // `getPublicBranches` já trata os erros que conhece e devolve lista
      // vazia; este catch é a garantia de que o skeleton não fica pra sempre
      // se ela um dia passar a propagar alguma falha.
      .catch(() => { if (!cancelled) setBranches([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectBranch(slug: string) {
    if (navigatingSlug) return;
    setNavigatingSlug(slug);
    router.push(`/pedir/${slug}`);
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
            Filiais Marcos Krep&apos;s
          </h1>
          <p className="text-sm text-white/70 max-w-sm">
            Escolha a unidade onde quer pedir ou acompanhe um pedido em andamento.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-md px-4 -mt-6 space-y-4 relative">

        {/* ── Acompanhar pedido (acima das filiais — é a ação mais urgente) ── */}
        <AcompanharPedido />

        {/* ── Lista de filiais ───────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Filiais</h2>
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
                const isNavigating = navigatingSlug === branch.slug;
                return (
                  <li key={branch.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectBranch(branch.slug)}
                      disabled={!!navigatingSlug}
                      aria-busy={isNavigating}
                      className="w-full text-left flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)] transition-[box-shadow,opacity] duration-150 hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] active:scale-[0.99] disabled:opacity-60"
                    >
                      {/* Avatar com cor estável por filial */}
                      <div
                        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {isNavigating ? (
                          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
                        ) : (
                          <>
                            <span className="text-micro font-medium opacity-80">{branch.code}</span>
                            <Icon className="h-4 w-4 mt-0.5" strokeWidth={1.75} />
                          </>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {branch.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-caption text-[var(--text-secondary)]">
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
                          <p className="mt-0.5 flex items-center gap-1 text-caption text-[var(--text-muted)] truncate">
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
        <p className="px-2 pt-2 text-center text-caption text-[var(--text-muted)] leading-relaxed">
          <ShoppingBag className="inline h-3 w-3 mr-1 align-text-bottom" strokeWidth={1.75} />
          Pagamento seguro via PIX ou cartão. Notificação por WhatsApp quando o pedido ficar pronto.
        </p>
      </main>
    </div>
  );
}
