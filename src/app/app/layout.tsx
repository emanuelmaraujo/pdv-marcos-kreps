"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingState } from "@/components/feedback/LoadingState";
import { BiometricEnrollPrompt } from "@/components/auth/BiometricEnrollPrompt";
import { createClient } from "@/lib/supabase/client";
import { hasEnrolledPasskey, isWebAuthnSupported } from "@/lib/webauthn-client";

const BIOMETRIC_DISMISSED_KEY = "pdv_biometric_prompt_dismissed";

/** Inner layout - consumes UserContext (must be inside <UserProvider>) */
function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAttendant } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Load access token and decide whether to show biometric prompt for attendants
  useEffect(() => {
    if (!user || !isAttendant) return;
    if (!isWebAuthnSupported()) return;
    if (hasEnrolledPasskey()) return;
    if (sessionStorage.getItem(BIOMETRIC_DISMISSED_KEY)) return;

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAccessToken(session.access_token);
        setShowBiometricPrompt(true);
      }
    });
  }, [user, isAttendant]);

  const handleDismissPrompt = () => {
    sessionStorage.setItem(BIOMETRIC_DISMISSED_KEY, "1");
    setShowBiometricPrompt(false);
  };

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

      {showBiometricPrompt && user && accessToken && (
        <BiometricEnrollPrompt
          userId={user.id}
          email={user.email}
          accessToken={accessToken}
          onDismiss={handleDismissPrompt}
        />
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <BranchProvider>
        <AppShell>{children}</AppShell>
      </BranchProvider>
    </UserProvider>
  );
}
