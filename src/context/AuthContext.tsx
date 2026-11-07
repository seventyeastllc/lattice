import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types";

const DEMO_SESSION_KEY = "lattice_demo_role";
export type DemoRole = "public" | "member" | "admin";

function initDemoRole(): DemoRole | null {
  if (new URLSearchParams(window.location.search).get("demo") === "1") {
    const saved = sessionStorage.getItem(DEMO_SESSION_KEY) as DemoRole | null;
    const role: DemoRole = saved ?? "admin";
    sessionStorage.setItem(DEMO_SESSION_KEY, role);
    return role;
  }
  return sessionStorage.getItem(DEMO_SESSION_KEY) as DemoRole | null;
}

const DEMO_USER = {
  id: "demo-user-id",
  email: "admin@seedexchange.org",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  demoRole: DemoRole | null;
  setDemoRole: (r: DemoRole) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [demoRole, setDemoRoleState] = useState<DemoRole | null>(initDemoRole);
  const demo = demoRole !== null;
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(
    demo && demoRole !== "public" ? DEMO_USER : null
  );
  const [role, setRole] = useState<UserRole | null>(
    demoRole === "admin" ? "admin" : demoRole === "member" ? "member" : null
  );
  const [loading, setLoading] = useState(!demo);

  function setDemoRole(r: DemoRole) {
    sessionStorage.setItem(DEMO_SESSION_KEY, r);
    setDemoRoleState(r);
    setUser(r !== "public" ? DEMO_USER : null);
    setRole(r === "admin" ? "admin" : r === "member" ? "member" : null);
  }

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    const record = data as { role: string } | null;
    setRole((record?.role as UserRole) ?? "member");
  }

  useEffect(() => {
    if (demo) return; // demo mode skips real auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // Redirect to reset page regardless of where the hash landed
        window.location.replace("/reset-password");
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, role, loading, demoRole, setDemoRole, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
