"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingState } from "@/components/feedback/LoadingState";

/** Inner layout — consumes UserContext (must be inside <UserProvider>) */
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

  if (!user) return null; // redirect is in-flight

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — shifts right on desktop to clear the fixed sidebar */}
      <main className="pt-11 pb-20 md:pb-6 lg:ml-60 overflow-y-auto min-h-[calc(100vh-2.75rem)]">
        {children}
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
