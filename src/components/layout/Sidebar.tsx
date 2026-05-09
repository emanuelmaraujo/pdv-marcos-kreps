"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav-items";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay — tablet only, when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:block lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegação lateral"
        className={[
          "hidden md:flex flex-col",
          "fixed left-0 top-14 z-40",
          "h-[calc(100vh-3.5rem)] w-[220px] lg:w-60",
          "bg-brand-charcoal border-r border-zinc-700/60",
          "transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Brand header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-700/60 shrink-0">
          <Image
            src="/logo.png"
            alt="Marcos Krep's"
            width={36}
            height={36}
            className="rounded-lg shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">
              Marcos Krep&apos;s
            </p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Ponto de Venda
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" role="navigation">
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
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
                  isActive
                    ? "bg-brand-red text-white"
                    : "text-zinc-400 hover:bg-zinc-700/50 hover:text-white",
                ].join(" ")}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${isActive ? "stroke-[2.5]" : ""}`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-3 py-3 border-t border-zinc-700/60">
          <p className="text-[10px] text-zinc-600 text-center">PDV Marcos Krep&apos;s · v1.0</p>
        </div>
      </aside>
    </>
  );
}
