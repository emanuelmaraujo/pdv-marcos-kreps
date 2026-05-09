"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/pdv";

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
    const timers = new Set<number>();

    async function applySession(session: Session | null) {
      try {
        if (!session) {
          if (mounted) setUser(null);
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, name, role, active")
          .eq("id", session.user.id)
          .maybeSingle();

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
          console.error("[UserProvider] Profile lookup failed", error);
          setUser(null);
        }
      } catch (error) {
        console.error("[UserProvider] Failed to load session profile", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    async function loadInitialSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await applySession(session);
      } catch (error) {
        console.error("[UserProvider] Failed to restore Supabase session", error);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    loadInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const timer = window.setTimeout(() => {
          timers.delete(timer);
          applySession(session);
        }, 0);
        timers.add(timer);
      },
    );

    return () => {
      mounted = false;
      timers.forEach((timer) => window.clearTimeout(timer));
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

/** Hook - throws if used outside <UserProvider> */
export function useUser(): UserContextValue {
  return useContext(UserContext);
}
