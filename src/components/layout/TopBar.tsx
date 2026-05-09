"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Menu, X } from "lucide-react";

const SESSION_KEY = "pdv_login_time";

interface TopBarProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export function TopBar({ sidebarOpen, onSidebarToggle }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const context = getTopBarContext(pathname);

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    router.push("/login");
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-zinc-700/60 bg-brand-charcoal shadow-sm">
      <div className="flex h-full items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onSidebarToggle}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            className="mr-1 hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-700/50 hover:text-white md:flex lg:hidden"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Image
            src="/logo.png"
            alt="Marcos Krep's"
            width={34}
            height={34}
            className="shrink-0 rounded-lg"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-white">
              {context.title}
            </p>
            <p className="hidden truncate text-[11px] font-medium text-zinc-400 sm:block">
              {context.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 transition-all hover:bg-zinc-700/50 hover:text-white active:scale-95"
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}

function getTopBarContext(pathname: string) {
  if (pathname.startsWith("/app/pedidos")) {
    return {
      title: "Pedidos do Dia",
      subtitle: "Acompanhe fila, prontos, entregues e pagamentos",
    };
  }

  if (pathname.startsWith("/app/novo-pedido")) {
    return {
      title: "Novo Pedido",
      subtitle: "Monte o pedido do balcão ou viagem",
    };
  }

  if (pathname.startsWith("/app/caixa/relatorio")) {
    return {
      title: "Relatório Gerencial",
      subtitle: "Financeiro, pagamentos, vendas, horários e pontos de atenção",
    };
  }

  if (pathname.startsWith("/app/caixa")) {
    return {
      title: "Caixa",
      subtitle: "Recebimentos, pendências e movimento do dia",
    };
  }

  if (pathname.startsWith("/app/cardapio")) {
    return {
      title: "Cardápio",
      subtitle: "Produtos, adicionais, categorias e disponibilidade",
    };
  }

  if (pathname.startsWith("/app/impressao")) {
    return {
      title: "Fila de Impressão",
      subtitle: "Comandas por setor e reimpressões",
    };
  }

  if (pathname.startsWith("/app/usuarios")) {
    return {
      title: "Usuários",
      subtitle: "Acessos, perfis e operadores",
    };
  }

  if (pathname.startsWith("/app/configuracoes")) {
    return {
      title: "Configurações",
      subtitle: "Regras do PDV e integrações",
    };
  }

  return {
    title: "Marcos Krep's",
    subtitle: "Painel operacional do PDV",
  };
}
