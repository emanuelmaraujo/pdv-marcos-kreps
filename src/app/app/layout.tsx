"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { LoadingState } from "@/components/feedback/LoadingState";

/** Inner layout — consumes UserContext (must be inside <UserProvider>) */
function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();

  // Defense-in-depth: middleware handles the redirect server-side,
  // but we also guard client-side in case of token expiry between navigations.
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
    <div className="min-h-screen bg-background pb-20 pt-11">
      <TopBar />
      <main className="mx-auto w-full max-w-md min-h-screen relative">
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
