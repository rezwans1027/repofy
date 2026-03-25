"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  github_username?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(initialUser === undefined);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Skip initial fetch if server provided auth state
    if (initialUser !== undefined) return;

    api.get<{ user: AuthUser }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, [initialUser]);

  const value = useMemo(() => ({ user, isLoading, refresh }), [user, isLoading, refresh]);

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
