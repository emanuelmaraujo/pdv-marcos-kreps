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
    return <div className="h-screen w-screen bg-background"><LoadingState message="Verificando sessão..." /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto w-full max-w-md min-h-screen relative">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
