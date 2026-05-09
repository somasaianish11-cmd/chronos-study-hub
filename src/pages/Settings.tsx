import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export default function Settings() {
  const { user, isPro, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete account");
      setDeleting(false);
    }
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

      <Card className="p-5 border-destructive/40 bg-destructive/5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => { setConfirmText(""); setDeleteOpen(true); }}>
          Delete account
        </Button>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Are you sure? This will permanently delete all your data and cannot be undone. Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || deleting}
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
