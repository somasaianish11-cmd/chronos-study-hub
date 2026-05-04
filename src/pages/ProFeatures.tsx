import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Swords, Layers } from "lucide-react";
import UpgradeModal from "@/components/UpgradeModal";
import { useState } from "react";

export function ProGate({ feature, icon: Icon }: { feature: string; icon: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <Card className="p-12 text-center bg-gradient-card border-border max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
          <Icon className="w-7 h-7 text-primary-foreground" />
        </div>
        <div className="inline-flex items-center gap-1 text-xs text-accent font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3 h-3" /> Pro feature
        </div>
        <h1 className="text-2xl font-bold mb-2">{feature}</h1>
        <p className="text-muted-foreground mb-6">Upgrade to Pro to unlock this feature and dominate your study game.</p>
        <Button size="lg" onClick={() => setOpen(true)}>See pricing</Button>
      </Card>
      <UpgradeModal open={open} onOpenChange={setOpen} feature={feature} />
    </div>
  );
}

export function BattleMode() {
  const { isPro } = useAuth();
  if (!isPro) return <ProGate feature="Battle Mode" icon={Swords} />;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Battle Mode</h1>
      <Card className="p-12 text-center bg-gradient-card border-border">
        <Swords className="w-12 h-12 text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Coming soon — challenge your friends to focus duels.</p>
      </Card>
    </div>
  );
}

export function Flashcards() {
  const { isPro } = useAuth();
  if (!isPro) return <ProGate feature="Flashcards" icon={Layers} />;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Flashcards</h1>
      <Card className="p-12 text-center bg-gradient-card border-border">
        <Layers className="w-12 h-12 text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Coming soon — spaced repetition decks per subject.</p>
      </Card>
    </div>
  );
}
