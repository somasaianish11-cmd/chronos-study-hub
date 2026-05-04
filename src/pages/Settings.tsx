import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Settings() {
  const { user, isPro, signOut } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    if (user) supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name || ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card className="p-5 bg-gradient-card border-border space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div><Label>Display name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
        <Button onClick={save}>Save changes</Button>
      </Card>

      <Card className="p-5 bg-gradient-card border-border space-y-2">
        <h2 className="font-semibold">Plan</h2>
        <p className="text-sm text-muted-foreground">You're on the <span className="text-foreground font-medium">{isPro ? "Pro" : "Free"}</span> plan.</p>
      </Card>

      <Card className="p-5 bg-gradient-card border-border">
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </Card>
    </div>
  );
}
