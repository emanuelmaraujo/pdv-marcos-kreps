"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { LoadingState } from "@/components/feedback/LoadingState";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
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
    return <div className="h-screen w-screen"><LoadingState message="Verificando sessão..." /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <main className="mx-auto max-w-md w-full h-full bg-background min-h-screen relative shadow-sm">
        {children}
      </main>
      <div className="mx-auto max-w-md">
        <BottomNav />
      </div>
    </div>
  );
}
