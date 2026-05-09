"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChefHat, LogOut } from "lucide-react";

const SESSION_KEY = "pdv_login_time";

export function TopBar() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    router.push("/login");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-11 bg-brand-charcoal border-b border-zinc-700/60 shadow-sm">
      <div className="mx-auto flex h-full max-w-md items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-red">
            <ChefHat className="h-4 w-4 text-white" />
          </div>
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
