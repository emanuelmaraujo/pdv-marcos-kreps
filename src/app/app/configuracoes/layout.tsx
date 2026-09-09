"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { LoadingState } from "@/components/feedback/LoadingState";
import { SettingsWorkspace } from "./components/SettingsWorkspace";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUser();

  if (isLoading) return <LoadingState message="Validando permissões..." />;
  if (!isAdmin) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 text-center shadow-sm">
          <ShieldX className="mx-auto h-9 w-9 text-[var(--status-danger)]" />
          <h1 className="mt-4 text-xl font-black text-[var(--text-primary)]">Acesso administrativo</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Seu perfil não tem permissão para abrir as configurações.</p>
          <Link href="/app" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-red px-5 text-sm font-black text-white">Voltar ao início</Link>
        </div>
      </main>
    );
  }

  return <SettingsWorkspace>{children}</SettingsWorkspace>;
}
