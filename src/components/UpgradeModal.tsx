import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; feature?: string; }

export default function UpgradeModal({ open, onOpenChange, feature }: Props) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const nav = useNavigate();
  const features = [
    "Unlimited subjects, tasks & exams",
    "Battle mode with friends",
    "Flashcards with spaced repetition",
    "Streak recovery (1/week)",
    "Priority support",
  ];
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
              className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-all capitalize",
                period === p ? "bg-background shadow-card" : "text-muted-foreground")}>
              {p} {p === "yearly" && <span className="ml-1 text-xs text-accent">−21%</span>}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border p-5 bg-gradient-card">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">${period === "monthly" ? "7.99" : "75.99"}</span>
            <span className="text-muted-foreground">/{period === "monthly" ? "month" : "year"}</span>
          </div>
          {period === "yearly" && <p className="text-xs text-accent mt-1">Save over a month free</p>}
          <ul className="mt-4 space-y-2">
            {features.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /><span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button size="lg" className="w-full" onClick={() => { onOpenChange(false); nav("/pricing"); }}>
          Continue to checkout
        </Button>
      </DialogContent>
    </Dialog>
  );
}
