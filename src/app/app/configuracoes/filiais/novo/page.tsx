"use client";

import Link from "next/link";
import { BranchEditorView } from "../BranchEditorView";
import { useUser } from "@/contexts/UserContext";

export default function NovaFilialPage() {
  const { isGlobalAdmin } = useUser();
  if (!isGlobalAdmin) {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 text-center">
        <h1 className="text-xl font-black text-[var(--text-primary)]">Criação restrita</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Somente o administrador global pode criar uma nova filial.</p>
        <Link href="/app/configuracoes/filiais" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-red px-5 text-sm font-black text-white">Voltar às filiais</Link>
      </div>
    );
  }
  return <BranchEditorView />;
}
