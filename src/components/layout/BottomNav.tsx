"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav-items";
import { useUser } from "@/contexts/UserContext";
import { useNavBadges } from "@/lib/nav-badges";

export function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useUser();
  const badges = useNavBadges();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-surface)] pb-safe shadow-[0_-2px_12px_-2px_rgba(0,0,0,0.06)] md:hidden"
    >
      <div className="flex h-16 items-stretch px-1">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const count = badges[item.href] ?? 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl ${
                isActive
                  ? "text-brand-red"
                  : "text-[var(--text-muted)] active:text-[var(--text-secondary)]"
              }`}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-brand-red" />
              )}
              <span className="relative">
                <Icon className={`h-[22px] w-[22px] ${isActive ? "stroke-[2]" : "stroke-[1.75]"}`} />
                {count > 0 && (
                  <span
                    className="absolute -right-2 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-[var(--bg-surface)]"
                    aria-label={`${count} ${count === 1 ? "pendente" : "pendentes"}`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className={`text-[10px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
