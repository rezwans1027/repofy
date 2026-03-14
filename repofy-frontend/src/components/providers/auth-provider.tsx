"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Lazy singleton: only created on first call, which happens inside the
// component (i.e. in the browser), never at module-evaluation time during SSR.
let cachedClient: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Stable reference: create the client once per component lifetime (browser only).
  if (!supabaseRef.current) {
    supabaseRef.current = getSupabaseClient();
  }
  const supabase = supabaseRef.current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    }).catch((err) => {
      console.error("Failed to get user:", err);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const value = useMemo(() => ({ user, isLoading }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
