import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import UpgradeModal from "@/components/UpgradeModal";

const FREE_LIMIT = 5;

export default function Homework() {
  const { user, isPro } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", subject_id: "", due_date: format(new Date(), "yyyy-MM-dd") });

  const load = async () => {
    if (!user) return;
    const [{ data: hw }, { data: sb }] = await Promise.all([
      supabase.from("homework").select("*, subjects(name, color)").eq("user_id", user.id).order("due_date"),
      supabase.from("subjects").select("*").eq("user_id", user.id),
    ]);
    setItems(hw || []); setSubjects(sb || []);
  };
  useEffect(() => { load(); }, [user]);

  const active = items.filter(i => !i.completed);

  const add = async () => {
    if (!user || !form.title) return;
    if (!isPro && active.length >= FREE_LIMIT) { setShowUpgrade(true); return; }
    const { error } = await supabase.from("homework").insert({ ...form, user_id: user.id, subject_id: form.subject_id || null });
    if (error) return toast.error(error.message);
    setForm({ title: "", description: "", subject_id: "", due_date: format(new Date(), "yyyy-MM-dd") });
    setShow(false); load();
  };

  const toggle = async (id: string, v: boolean) => { await supabase.from("homework").update({ completed: v }).eq("id", id); load(); };
  const del = async (id: string) => { await supabase.from("homework").delete().eq("id", id); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Homework</h1>
          <p className="text-muted-foreground">{!isPro && <span className="text-accent">{active.length}/{FREE_LIMIT} active tasks</span>}</p>
        </div>
        <Dialog open={show} onOpenChange={setShow}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />New task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New homework</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Calculus problem set" /></div>
              <div><Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <Button onClick={add} className="w-full">Add task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-5 bg-gradient-card border-border">
        {items.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No homework yet.</p> : (
          <div className="space-y-2">
            {items.map(h => (
              <div key={h.id} className={`flex items-start gap-3 p-3 rounded-lg bg-secondary/40 ${h.completed ? "opacity-50" : ""}`}>
                <Checkbox checked={h.completed} onCheckedChange={v => toggle(h.id, !!v)} className="mt-1" />
                <div className="w-1 h-8 rounded-full mt-1" style={{ background: h.subjects?.color || "#7c6ff7" }} />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${h.completed ? "line-through" : ""}`}>{h.title}</div>
                  {h.description && <div className="text-xs text-muted-foreground mt-0.5">{h.description}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{h.subjects?.name || "—"} · due {format(new Date(h.due_date), "MMM d")}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => del(h.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} feature="More than 5 active tasks" />
    </div>
  );
}
