import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Subscription {
  tier: "free" | "pro";
  status: string;
  billing_period?: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: Subscription | null;
  isPro: boolean;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const loadSubscription = async (uid: string) => {
    const { data } = await supabase.from("subscriptions").select("tier, status, billing_period").eq("user_id", uid).maybeSingle();
    if (data) setSubscription(data as Subscription);
    else setSubscription({ tier: "free", status: "active" });
  };

  useEffect(() => {
    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => loadSubscription(s.user.id), 0);
      else setSubscription(null);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadSubscription(s.user.id);
      setLoading(false);
    });

    return () => sub.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshSubscription = async () => { if (user) await loadSubscription(user.id); };

  return (
    <Ctx.Provider value={{ user, session, loading, subscription, isPro: subscription?.tier === "pro", signOut, refreshSubscription }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
