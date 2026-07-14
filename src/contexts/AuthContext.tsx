"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { User, KpiRole } from "@/types";

export type DevMode = "management" | "employee";

interface AuthContextValue {
  supabaseUser: SupabaseAuthUser | null;
  user: User | null;
  kpiRole: KpiRole | null;
  isLoading: boolean;
  devMode: DevMode;
  toggleDevMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserProfile(uid: string): Promise<User | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select(`*, departments(name)`)
    .eq("id", uid)
    .single();

  if (error || !data) return null;

  const deptName = (data.departments as unknown as { name: string } | null)?.name ?? null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    kpiRole: data.kpi_role as KpiRole,
    departmentId: data.department_id,
    departmentName: deptName,
    department: deptName,
    position: data.position,
    photoUrl: data.photo_url,
    managedDepartments: (data.managed_departments as string[]) ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devMode, setDevMode] = useState<DevMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("devMode") as DevMode) ?? "management";
    }
    return "management";
  });

  function toggleDevMode() {
    setDevMode((prev) => {
      const next: DevMode = prev === "management" ? "employee" : "management";
      if (typeof window !== "undefined") localStorage.setItem("devMode", next);
      return next;
    });
  }

  useEffect(() => {
    const supabase = createClient();

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        setUser(profile);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
  }

  const kpiRole: KpiRole | null = user?.kpiRole ?? null;

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        user,
        kpiRole,
        isLoading,
        devMode,
        toggleDevMode,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
