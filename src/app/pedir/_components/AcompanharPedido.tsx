"use client";

/**
 * Bloco público de "acompanhar pedido": o cliente digita o WhatsApp ou cola
 * o link/token e cai em /pedido/[token]. Quando o telefone tem 2+ pedidos
 * ativos, mostra um picker em vez de adivinhar qual abrir.
 *
 * Nasceu inline na PedirLanding (/pedir/filiais). Virou componente porque a
 * ação precisa existir em TODAS as telas públicas: quem chega pelo QR Code
 * cai direto no cardápio da filial (/pedir e /pedir/[slug]) e nunca passa
 * pelo hub de filiais — sem isso, perder o link significava perder o pedido.
 *
 *   variant="card"      bloco sempre aberto (hub de filiais, onde acompanhar
 *                       é uma das duas ações primárias)
 *   variant="collapsed" linha discreta que abre ao toque (cardápio, onde a
 *                       ação primária é montar o pedido)
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, Loader2, Package } from "lucide-react";
import { pdvApi, PublicOrderLookupItem } from "@/lib/api/pdv-api";
import { extractOrderToken, looksLikePhone } from "./order-tracking-helpers";

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  AGUARDANDO_CONFIRMACAO: "Em confirmação",
  NA_FILA: "Em preparo",
  PRONTO_PARCIAL: "Pronto parcial",
  PRONTO: "Pronto pra retirada",
};

/** Rota de acompanhamento, preservando a filial quando o lookup a conhece. */
function trackingHref(token: string, branchSlug?: string | null): string {
  const base = `/pedido/${encodeURIComponent(token)}`;
  return branchSlug ? `${base}?branch=${encodeURIComponent(branchSlug)}` : base;
}

export function AcompanharPedido({
  variant = "card",
  className = "",
}: {
  variant?: "card" | "collapsed";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(variant === "card");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /** Quando lookup por telefone retorna 2+ pedidos, mostramos picker. */
  const [matches, setMatches] = useState<PublicOrderLookupItem[] | null>(null);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMatches(null);
    const value = input.trim();
    if (!value) return;

    // 1) Tenta extrair token de URL/código primeiro (caso o cliente colou link)
    const token = extractOrderToken(value);
    if (token) {
      router.push(trackingHref(token));
      return;
    }

    // 2) Se parece telefone, faz lookup
    if (looksLikePhone(value)) {
      setLoading(true);
      try {
        const res = await pdvApi.lookupPublicOrdersByPhone(value);
        if (!res.success) {
          setError(res.error || "WhatsApp inválido. Use DDD + número.");
          return;
        }
        if (res.orders.length === 0) {
          setError("Nenhum pedido ativo encontrado nas últimas 4h para esse WhatsApp.");
          return;
        }
        if (res.orders.length === 1) {
          const onlyMatch = res.orders[0];
          router.push(trackingHref(onlyMatch.public_token, onlyMatch.branch_slug));
          return;
        }
        // 2+ pedidos → mostra picker
        setMatches(res.orders);
      } catch {
        // Idem: a pdvApi já converte falha em `success: false`, mas sem este
        // catch uma exceção inesperada deixaria o botão sem resposta nenhuma.
        setError("Não conseguimos buscar agora. Tente de novo em instantes.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setError("Use o WhatsApp (DDD + número) ou cole o link do pedido.");
  }

  const body = matches ? (
    // Picker: cliente tem 2+ pedidos ativos, escolhe qual acompanhar
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-secondary)]">
        Encontrei {matches.length} pedidos ativos. Escolha qual abrir:
      </p>
      <ul className="space-y-1.5">
        {matches.map((order) => (
          <li key={order.public_token}>
            <button
              type="button"
              onClick={() => router.push(trackingHref(order.public_token, order.branch_slug))}
              className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5 text-left hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)] active:scale-[0.99]"
            >
              <span
                className="flex h-9 min-w-9 px-1.5 items-center justify-center rounded-lg text-xs font-bold text-white tabular-nums"
                style={{ backgroundColor: "var(--bg-inverse)" }}
              >
                #{String(order.daily_number).padStart(3, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {STATUS_LABEL[order.status] ?? order.status}
                </p>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {order.branch_name ?? "Marcos Krep's"} · {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => { setMatches(null); setInput(""); }}
        className="text-xs text-[var(--text-muted)] underline hover:text-[var(--text-secondary)] mt-1"
      >
        Voltar e procurar de novo
      </button>
    </div>
  ) : (
    <form onSubmit={handleTrack} className="space-y-2">
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(""); }}
        placeholder="(11) 99999-9999 ou link do pedido"
        inputMode="tel"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-red focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {error && <p className="text-xs text-[var(--status-danger)]">{error}</p>}
      <button
        type="submit"
        disabled={!input.trim() || loading}
        className="w-full flex items-center justify-center gap-1.5 rounded-full bg-[var(--bg-inverse)] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
        style={{ height: 44 }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <>
            Acompanhar pedido
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </>
        )}
      </button>
      <p className="flex items-center gap-1 text-caption text-[var(--text-muted)] pt-0.5">
        <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
        Busca apenas pedidos ativos das últimas 4h
      </p>
    </form>
  );

  if (variant === "collapsed") {
    return (
      <section
        className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] ${className}`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--status-info-bg)]">
            <Package className="h-4 w-4" strokeWidth={1.75} style={{ color: "var(--status-info, #2563EB)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Já fez um pedido?</p>
            <p className="text-xs text-[var(--text-secondary)]">Acompanhe pelo WhatsApp ou pelo link</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.75}
          />
        </button>
        {open && <div className="px-4 pb-4">{body}</div>}
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-md)] ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--status-info-bg)]">
          <Package className="h-4 w-4" strokeWidth={1.75} style={{ color: "var(--status-info, #2563EB)" }} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Já fez um pedido?</h2>
          <p className="text-xs text-[var(--text-secondary)]">Use seu WhatsApp ou cole o link</p>
        </div>
      </div>
      {body}
    </section>
  );
}
