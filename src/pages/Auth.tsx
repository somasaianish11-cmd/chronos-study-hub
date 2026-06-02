import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Timer } from "lucide-react";

export default function Auth({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const nav = useNavigate();

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return "Password must be at least 8 characters long.";
    if (!/\d/.test(pwd)) return "Password must include at least one number.";
    return "";
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      const error = validatePassword(password);
      setPasswordError(error);
      if (error) return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const response = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { display_name: name || email.split("@")[0] } },
        });
        
        if (response.error) throw response.error;
        if (!response.data.user) throw new Error("Signup failed: no user returned");
        toast.success("Welcome to Chronos!");
        nav("/dashboard");
      } else {
        const response = await supabase.auth.signInWithPassword({ email, password });
        console.log("Supabase signIn response:", response);
        if (response.error) throw response.error;
        toast.success("Welcome back!");
        nav("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/dashboard` });
    if (result.error) toast.error("Google sign-in failed");
    if (!result.redirected && !result.error) nav("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="w-full max-w-sm relative animate-slide-up">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-glow"><Timer className="w-4 h-4 text-primary-foreground" /></div>
          <span className="font-bold text-xl">Chronos</span>
        </Link>

        <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <h1 className="text-2xl font-semibold mb-1">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login" ? "Sign in to continue studying." : "Start studying smarter today."}
          </p>

          <Button variant="outline" className="w-full mb-4" onClick={handleGoogle} type="button">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" /></div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <div><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Alex" /></div>
            )}
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.edu" /></div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input id="password" type="password" required value={password} onChange={e => { setPassword(e.target.value); setPasswordError(""); }} placeholder="••••••••" />
              {mode === "signup" && passwordError && (
                <p className="text-sm text-destructive mt-1">{passwordError}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Please wait…" : (mode === "login" ? "Sign in" : "Create account")}</Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-5">
            {mode === "login" ? <>Don't have an account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link></>
              : <>Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link></>}
          </p>
        </div>
      </div>
    </div>
  );
}
