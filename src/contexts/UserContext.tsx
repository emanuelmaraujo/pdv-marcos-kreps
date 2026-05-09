"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/pdv";

const SESSION_TIMEOUT_MS = 10000;

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
}

interface UserContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  /** Convenience helpers */
  isAdmin: boolean;
  isAttendant: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isAttendant: false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
        );
        const session = sessionResult.data.session;

        if (!mounted) return;

        if (!session) {
          setUser(null);
          return;
        }

        const { data: profile, error } = await withTimeout(
          supabase
            .from("profiles")
            .select("id, name, role, active")
            .eq("id", session.user.id)
            .maybeSingle(),
          SESSION_TIMEOUT_MS,
        );

        if (!mounted) return;

        if (!error && profile) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name: profile.name,
            role: profile.role as UserRole,
            active: profile.active,
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("[UserProvider] Failed to load session profile", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        try {
          // Re-fetch profile on token refresh / sign-in
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, role, active")
            .eq("id", session.user.id)
            .maybeSingle();

          if (mounted && profile) {
            setUser({
              id: session.user.id,
              email: session.user.email ?? "",
              name: profile.name,
              role: profile.role as UserRole,
              active: profile.active,
            });
          }
        } finally {
          if (mounted) setIsLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        isAdmin: user?.role === "ADMIN",
        isAttendant: user?.role === "ATTENDANT",
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

/** Hook — throws if used outside <UserProvider> */
export function useUser(): UserContextValue {
  return useContext(UserContext);
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Tempo limite ao verificar sessão no Supabase"));
    }, timeoutMs);

    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout));
  });
}
