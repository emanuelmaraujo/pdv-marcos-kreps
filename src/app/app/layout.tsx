"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingState } from "@/components/feedback/LoadingState";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
      } else {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background">
        <LoadingState message="Verificando sessão..." />
      </div>
    );
  }

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
