import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; feature?: string; }

const TIERS = {
  monthly: {
    label: "Monthly",
    price: "3.99",
    unit: "/ month",
    subtitle: "Billed monthly. Cancel anytime.",
    features: ["Battle Mode", "Unlimited Streak Recoveries", "Custom Timer Sounds", "Detailed Study Analytics"],
  },
  yearly: {
    label: "Annual",
    price: "29.99",
    unit: "/ year",
    subtitle: "Equivalent to $2.50 / month",
    features: ["Everything in Pro Monthly included."],
  },
} as const;

export default function UpgradeModal({ open, onOpenChange, feature }: Props) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const nav = useNavigate();
  const tier = TIERS[period];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-2 shadow-glow">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl">Upgrade to Pro</DialogTitle>
          <DialogDescription>
            {feature ? `${feature} is a Pro feature. ` : ""}Unlock everything Chronos has to offer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex p-1 rounded-lg bg-secondary border border-border">
          {(["monthly", "yearly"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-all",
                period === p ? "bg-background shadow-card" : "text-muted-foreground")}>
              {TIERS[p].label}
              {p === "yearly" && <span className="ml-1 text-xs text-accent">Best Value</span>}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border p-5 bg-gradient-card">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">${tier.price}</span>
            <span className="text-muted-foreground">{tier.unit}</span>
          </div>
          <p className="text-xs text-accent mt-1">{tier.subtitle}</p>
          <ul className="mt-4 space-y-2">
            {tier.features.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /><span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Free plan: Core Focus Timer, Homework &amp; Timetable Planner, Basic Streak Tracking.
        </p>

        <Button size="lg" className="w-full" onClick={() => { onOpenChange(false); nav("/pricing"); }}>
          Continue to checkout
        </Button>
      </DialogContent>
    </Dialog>
  );
}
