import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Pricing() {
  const { user, isPro } = useAuth();

  const goToCheckout = () =>
    toast.info("Stripe checkout coming next — connect your Stripe account in settings to enable.");

  const freeFeatures = ["Core Focus Timer", "Homework & Timetable Planner", "Basic Streak Tracking"];
  const proMonthlyFeatures = ["Battle Mode", "Unlimited Streak Recoveries", "Custom Timer Sounds", "Detailed Study Analytics"];
  const proAnnualFeatures = ["Everything in Pro Monthly included."];

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

        <div className="grid md:grid-cols-3 gap-5">
          <Card className="p-6 bg-gradient-card border-border flex flex-col">
            <h2 className="font-semibold text-lg">Free</h2>
            <p className="text-sm text-muted-foreground">For getting started</p>
            <div className="my-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground">/ month</span>
            </div>
            <ul className="space-y-2 mb-6 grow">{freeFeatures.map(f => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />{f}</li>)}</ul>
            <Button variant="outline" className="w-full" disabled={!isPro}>{isPro ? "Downgrade" : "Current plan"}</Button>
          </Card>

          <Card className="p-6 bg-gradient-card border-border flex flex-col">
            <h2 className="font-semibold text-lg">Chronos Pro Monthly</h2>
            <p className="text-sm text-muted-foreground">Billed monthly. Cancel anytime.</p>
            <div className="my-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$3.99</span>
              <span className="text-muted-foreground">/ month</span>
            </div>
            <ul className="space-y-2 mb-6 grow">{proMonthlyFeatures.map(f => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{f}</li>)}</ul>
            <Button variant="outline" className="w-full" disabled={isPro} onClick={goToCheckout}>
              {isPro ? "You're on Pro" : "Upgrade to Pro"}
            </Button>
          </Card>

          <Card className="p-6 bg-gradient-card border-primary/40 relative shadow-elevated flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1 whitespace-nowrap"><Sparkles className="w-3 h-3" />Best Value (Save 37%)</div>
            <h2 className="font-semibold text-lg">Chronos Pro Annual</h2>
            <p className="text-sm text-muted-foreground">Equivalent to $2.50 / month</p>
            <div className="my-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$29.99</span>
              <span className="text-muted-foreground">/ year</span>
            </div>
            <ul className="space-y-2 mb-6 grow">{proAnnualFeatures.map(f => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{f}</li>)}</ul>
            <Button className="w-full" disabled={isPro} onClick={goToCheckout}>
              {isPro ? "You're on Pro" : "Upgrade to Pro"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
