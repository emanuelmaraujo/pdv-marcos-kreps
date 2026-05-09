"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Menu, X } from "lucide-react";
import Image from "next/image";

const SESSION_KEY = "pdv_login_time";

interface TopBarProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export function TopBar({ sidebarOpen, onSidebarToggle }: TopBarProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    router.push("/login");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-11 bg-brand-charcoal border-b border-zinc-700/60 shadow-sm">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Hamburger — tablet only (md but not lg) */}
          <button
            onClick={onSidebarToggle}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            className="hidden md:flex lg:hidden items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-all mr-1"
          >
            {sidebarOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>

          <Image
            src="/logo.png"
            alt="Marcos Krep's"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          <span className="text-sm font-bold tracking-tight text-white">
            Marcos Krep&apos;s
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-700/50 hover:text-white active:scale-95 transition-all text-xs font-medium"
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </header>
  );
}
