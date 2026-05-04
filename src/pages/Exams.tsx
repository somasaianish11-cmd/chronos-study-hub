import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import UpgradeModal from "@/components/UpgradeModal";

const FREE_LIMIT = 2;

export default function Exams() {
  const { user, isPro } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [form, setForm] = useState({ name: "", subject_id: "", exam_date: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd") });

  const load = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: ex }, { data: sb }] = await Promise.all([
      supabase.from("exams").select("*, subjects(name, color)").eq("user_id", user.id).gte("exam_date", today).order("exam_date"),
      supabase.from("subjects").select("*").eq("user_id", user.id),
    ]);
    setItems(ex || []); setSubjects(sb || []);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user || !form.name) return;
    if (!isPro && items.length >= FREE_LIMIT) { setShowUpgrade(true); return; }
    const { error } = await supabase.from("exams").insert({ ...form, user_id: user.id, subject_id: form.subject_id || null });
    if (error) return toast.error(error.message);
    setForm({ name: "", subject_id: "", exam_date: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd") });
    setShow(false); load();
  };
  const del = async (id: string) => { await supabase.from("exams").delete().eq("id", id); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Exam Countdown</h1>
          <p className="text-muted-foreground">{!isPro && <span className="text-accent">{items.length}/{FREE_LIMIT} exams</span>}</p>
        </div>
        <Dialog open={show} onOpenChange={setShow}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />New exam</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New exam</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Final exam" /></div>
              <div><Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.exam_date} onChange={e => setForm({ ...form, exam_date: e.target.value })} /></div>
              <Button onClick={add} className="w-full">Add exam</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border">
          <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No upcoming exams.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(e => {
            const days = Math.ceil((new Date(e.exam_date).getTime() - Date.now()) / 86400000);
            const urgent = days <= 7;
            return (
              <Card key={e.id} className={`p-5 bg-gradient-card border-border relative overflow-hidden ${urgent ? "border-accent/50" : ""}`}>
                <div className="absolute top-0 left-0 w-1 h-full" style={{ background: e.subjects?.color || "#7c6ff7" }} />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{e.subjects?.name || "—"}</div>
                    <h3 className="font-semibold mt-0.5">{e.name}</h3>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => del(e.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="mt-4">
                  <div className={`text-4xl font-bold tabular-nums ${urgent ? "text-accent" : "text-gradient"}`}>{days}</div>
                  <div className="text-xs text-muted-foreground">{days === 1 ? "day" : "days"} away · {format(new Date(e.exam_date), "EEE, MMM d")}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} feature="More than 2 exams" />
    </div>
  );
}
