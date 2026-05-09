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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (mounted) setIsLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, name, role, active")
        .eq("id", session.user.id)
        .single();

      if (mounted) {
        if (!error && profile) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name: profile.name,
            role: profile.role as UserRole,
            active: profile.active,
          });
        }
        setIsLoading(false);
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

        // Re-fetch profile on token refresh / sign-in
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, role, active")
          .eq("id", session.user.id)
          .single();

        if (mounted && profile) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name: profile.name,
            role: profile.role as UserRole,
            active: profile.active,
          });
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
