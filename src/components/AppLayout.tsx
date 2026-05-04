import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Timer, Calendar, BookOpen, GraduationCap,
  Trophy, Swords, Layers, CreditCard, Settings, LogOut, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/timer", label: "Timer", icon: Timer },
  { to: "/timetable", label: "Timetable", icon: Calendar },
  { to: "/homework", label: "Homework", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/battle", label: "Battle Mode", icon: Swords, pro: true },
  { to: "/flashcards", label: "Flashcards", icon: Layers, pro: true },
];

export default function AppLayout() {
  const { user, loading, signOut, isPro } = useAuth();
  const nav2 = useNavigate();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!loading && !user) nav2("/login");
  }, [user, loading, nav2]);

  useEffect(() => {
    if (user) supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name || "Student"));
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Loading…</div></div>;
  }

  const initials = (name || user.email || "S").split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border bg-card/30 flex flex-col p-4 shrink-0 hidden md:flex">
        <NavLink to="/dashboard" className="flex items-center gap-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Timer className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Chronos</span>
        </NavLink>

        <nav className="flex-1 space-y-1">
          {nav.map(({ to, label, icon: Icon, pro }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1">{label}</span>
              {pro && !isPro && <Sparkles className="w-3 h-3 text-accent" />}
            </NavLink>
          ))}
        </nav>

        {!isPro && (
          <div className="rounded-xl p-4 mb-3 border border-primary/30 bg-gradient-hero">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Upgrade to Pro</span></div>
            <p className="text-xs text-muted-foreground mb-3">Unlimited subjects, battle mode & flashcards.</p>
            <Button size="sm" className="w-full" onClick={() => nav2("/pricing")}>Upgrade</Button>
          </div>
        )}

        <div className="border-t border-border pt-3 space-y-1">
          <NavLink to="/pricing" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")}>
            <CreditCard className="w-4 h-4" /> Pricing
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")}>
            <Settings className="w-4 h-4" /> Settings
          </NavLink>
          <div className="flex items-center gap-2 px-3 py-2 mt-2">
            <Avatar className="w-8 h-8"><AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">{initials}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-muted-foreground truncate">{isPro ? "Pro" : "Free"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </aside>

      {/* mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 glass border-b border-border px-4 py-3 flex items-center justify-between">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md gradient-primary flex items-center justify-center"><Timer className="w-3.5 h-3.5 text-primary-foreground" /></div>
          <span className="font-bold">Chronos</span>
        </NavLink>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
      </div>

      <main className="flex-1 overflow-x-hidden pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto p-6 md:p-8 animate-fade-in">
          <Outlet />
        </div>
        {/* mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 inset-x-0 glass border-t border-border flex justify-around p-2 z-40">
          {nav.slice(0, 5).map(({ to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn("p-2 rounded-lg", isActive ? "text-primary" : "text-muted-foreground")}>
              <Icon className="w-5 h-5" />
            </NavLink>
          ))}
        </div>
        <div className="md:hidden h-16" />
      </main>
    </div>
  );
}
