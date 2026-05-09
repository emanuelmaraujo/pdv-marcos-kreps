"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-safe shadow-[0_-2px_12px_-2px_rgba(0,0,0,0.08)] md:hidden"
    >
      <div className="flex h-16 items-stretch px-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                isActive
                  ? "text-brand-red"
                  : "text-zinc-400 active:text-zinc-600"
              }`}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-brand-red" />
              )}
              <Icon className={`h-[22px] w-[22px] ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
