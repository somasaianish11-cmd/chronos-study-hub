import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Pricing() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const { user, isPro } = useAuth();

  const freeFeatures = ["Up to 3 subjects", "Up to 5 active tasks", "Up to 2 exams", "Pomodoro timer", "Weekly leaderboard"];
  const proFeatures = ["Unlimited subjects, tasks & exams", "Battle mode with friends", "Flashcards with spaced repetition", "1 streak recovery per week", "Priority support"];

  return (
    <div className="min-h-screen bg-background">
      {!user && (
        <header className="border-b border-border/50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center"><Timer className="w-4 h-4 text-primary-foreground" /></div>
              <span className="font-bold">Chronos</span>
            </Link>
            <Link to="/login"><Button variant="ghost">Log in</Button></Link>
          </div>
        </header>
      )}

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Simple pricing</h1>
          <p className="text-muted-foreground">Start free. Upgrade when you're ready to dominate.</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1 rounded-lg bg-secondary border border-border">
            {(["monthly", "yearly"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-5 py-2 rounded-md text-sm font-medium transition-all capitalize",
                  period === p ? "bg-background shadow-card" : "text-muted-foreground")}>
                {p}{p === "yearly" && <span className="ml-2 text-xs text-accent">Save 21%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <Card className="p-6 bg-gradient-card border-border">
            <h2 className="font-semibold text-lg">Free</h2>
            <p className="text-sm text-muted-foreground">For getting started</p>
            <div className="my-5"><span className="text-4xl font-bold">$0</span><span className="text-muted-foreground"> forever</span></div>
            <ul className="space-y-2 mb-6">{freeFeatures.map(f => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-muted-foreground mt-0.5" />{f}</li>)}</ul>
            <Button variant="outline" className="w-full" disabled={!isPro}>{isPro ? "Downgrade" : "Current plan"}</Button>
          </Card>

          <Card className="p-6 bg-gradient-card border-primary/40 relative shadow-elevated">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1"><Sparkles className="w-3 h-3" />Most popular</div>
            <h2 className="font-semibold text-lg flex items-center gap-2">Pro</h2>
            <p className="text-sm text-muted-foreground">For serious students</p>
            <div className="my-5">
              <span className="text-4xl font-bold">${period === "monthly" ? "7.99" : "75.99"}</span>
              <span className="text-muted-foreground">/{period === "monthly" ? "month" : "year"}</span>
              {period === "yearly" && <div className="text-xs text-accent mt-1">Over a month free vs monthly</div>}
            </div>
            <ul className="space-y-2 mb-6">{proFeatures.map(f => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-primary mt-0.5" />{f}</li>)}</ul>
            <Button className="w-full" disabled={isPro} onClick={() => toast.info("Stripe checkout coming next — connect your Stripe account in settings to enable.")}>
              {isPro ? "You're on Pro 🎉" : "Upgrade to Pro"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
