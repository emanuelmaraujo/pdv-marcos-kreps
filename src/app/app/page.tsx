"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  BookOpen,
  Building2,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  Clock,
  ListChecks,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useBranch } from "@/contexts/BranchContext";
import { ordersApi } from "@/lib/api/orders-api";
import { Order } from "@/types/pdv";
import { Skeleton } from "@/components/ui/Skeleton";

/* ── Atalhos ──────────────────────────────────────────────────────────────
   `tone` decide a cor do ícone/fundo do ícone (semântica, não decorativa):
   brand = ação primária, info = leitura, neutral = catálogo, success = $$
   ──────────────────────────────────────────────────────────────────────── */
type ShortcutTone = "brand" | "info" | "neutral" | "success" | "warning";

interface Shortcut {
  title: string;
  href: string;
  icon: React.ElementType;
  tone: ShortcutTone;
}

const toneStyles: Record<ShortcutTone, { bg: string; fg: string }> = {
  brand:   { bg: "bg-[var(--status-danger-bg)]",  fg: "text-brand-red" },
  info:    { bg: "bg-[var(--status-info-bg)]",    fg: "text-[var(--status-info)]" },
  neutral: { bg: "bg-[var(--bg-subtle)]",         fg: "text-[var(--text-secondary)]" },
  success: { bg: "bg-[var(--status-success-bg)]", fg: "text-[var(--status-success)]" },
  warning: { bg: "bg-[var(--status-warning-bg)]", fg: "text-[var(--status-warning)]" },
};

const shortcuts: Shortcut[] = [
  { title: "Novo Pedido",  href: "/app/novo-pedido", icon: CirclePlus,     tone: "brand" },
  { title: "Pedidos hoje", href: "/app/pedidos",     icon: ClipboardList,  tone: "info" },
  { title: "Cardápio",     href: "/app/cardapio",    icon: BookOpen,       tone: "neutral" },
  { title: "Caixa",        href: "/app/caixa",       icon: Banknote,       tone: "success" },
];

const adminShortcuts: Shortcut[] = [
  { title: "Usuários",      href: "/app/usuarios",                 icon: Users,              tone: "info" },
  { title: "Filiais",       href: "/app/configuracoes/filiais",    icon: Building2,          tone: "neutral" },
  { title: "Configurações", href: "/app/configuracoes",            icon: SlidersHorizontal,  tone: "neutral" },
];

export default function AppDashboard() {
  const { isAdmin, user } = useUser();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return ordersApi.getTodayOrders(currentBranchId);
      })
      .then((data) => { if (!cancelled) setOrders(data || []); })
      .catch(() => { if (!cancelled) setOrders([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentBranchId]);

  const counts = useMemo(() => ({
    waiting: orders.filter((o) => o.status === "AGUARDANDO_CONFIRMACAO").length,
    queued:  orders.filter((o) => o.status === "NA_FILA").length,
    ready:   orders.filter((o) => o.status === "PRONTO" || o.status === "PRONTO_PARCIAL").length,
  }), [orders]);

  const greeting = getGreeting();
  const firstName = (user?.name ?? "").split(" ")[0];

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      {/* ── Saudação ───────────────────────────────────────────────────── */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          O que você quer fazer agora?
        </p>
      </header>

      {/* ── Layout 2 colunas em desktop ────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="space-y-6 lg:col-span-2">

          {/* Atalhos */}
          <section>
            <SectionTitle>Atalhos</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {shortcuts.map((s) => <ShortcutCard key={s.href} shortcut={s} />)}
            </div>
          </section>

          {/* Administração */}
          {isAdmin && (
            <section>
              <SectionTitle>Administração</SectionTitle>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {adminShortcuts.map((s) => <ShortcutCard key={s.href} shortcut={s} />)}
              </div>
            </section>
          )}
        </div>

        {/* Resumo Rápido */}
        <section className="mt-6 lg:mt-0">
          <SectionTitle>Resumo rápido</SectionTitle>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
            <SummaryRow
              icon={Clock}
              label="Aguardando confirmação"
              count={counts.waiting}
              loading={loading}
              tone="warning"
            />
            <SummaryRow
              icon={ListChecks}
              label="Na fila"
              count={counts.queued}
              loading={loading}
              tone="info"
            />
            <SummaryRow
              icon={CheckCircle2}
              label="Prontos"
              count={counts.ready}
              loading={loading}
              tone="success"
              isLast
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Subcomponentes ───────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold text-[var(--text-muted)]">
      {children}
    </h2>
  );
}

function ShortcutCard({ shortcut }: { shortcut: Shortcut }) {
  const Icon = shortcut.icon;
  const tone = toneStyles[shortcut.tone];
  return (
    <Link
      href={shortcut.href}
      className="group flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] active:scale-[0.97]"
    >
      <div className={`rounded-2xl p-3 ${tone.bg}`}>
        <Icon className={`h-6 w-6 ${tone.fg}`} strokeWidth={1.75} />
      </div>
      <span className="text-center text-sm font-semibold text-[var(--text-primary)]">
        {shortcut.title}
      </span>
    </Link>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  count,
  loading,
  tone,
  isLast,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  loading: boolean;
  tone: "warning" | "info" | "success";
  isLast?: boolean;
}) {
  const toneMap = {
    warning: { bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning)]" },
    info:    { bg: "bg-[var(--status-info-bg)]",    text: "text-[var(--status-info)]" },
    success: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success)]" },
  }[tone];

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${isLast ? "" : "border-b border-[var(--border)]"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`rounded-lg p-2 ${toneMap.bg}`}>
          <Icon className={`h-4 w-4 ${toneMap.text}`} strokeWidth={1.75} />
        </div>
        <span className="truncate text-sm text-[var(--text-primary)]">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-10" />
      ) : (
        <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-sm font-semibold ${
          count > 0 ? `${toneMap.bg} ${toneMap.text}` : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
        }`}>
          {count}
        </span>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

