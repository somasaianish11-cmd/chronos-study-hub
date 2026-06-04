import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Subscription {
  user_id?: string;
  plan: "free" | "pro";
  status: string;
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
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id, plan, status")
      .eq("user_id", uid)
      .maybeSingle();
    console.log("[Auth] Subscription fetch for user:", uid, { data, error });
    if (data) setSubscription(data as unknown as Subscription);
    else setSubscription({ plan: "free", status: "active" });
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

  const isPro =
    subscription?.plan === "pro" &&
    (subscription?.status === "active" || subscription?.status === "trialing");

  return (
    <Ctx.Provider value={{ user, session, loading, subscription, isPro, signOut, refreshSubscription }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
