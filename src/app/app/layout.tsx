"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingState } from "@/components/feedback/LoadingState";

/** Inner layout - consumes UserContext (must be inside <UserProvider>) */
function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background">
        <LoadingState message="Verificando sessão..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-background">
        <LoadingState message="Redirecionando para o login..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((open) => !open)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-h-[calc(100vh-3.5rem)] overflow-y-auto pb-20 pt-14 md:pb-6 lg:ml-60">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
