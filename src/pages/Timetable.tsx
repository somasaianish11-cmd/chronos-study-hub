import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import UpgradeModal from "@/components/UpgradeModal";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREE_LIMIT = 3;

export default function Timetable() {
  const { user, isPro } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [showSubject, setShowSubject] = useState(false);
  const [showSlot, setShowSlot] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [subjName, setSubjName] = useState("");
  const [subjColor, setSubjColor] = useState("#7c6ff7");
  const [slotData, setSlotData] = useState({ subject_id: "", day_of_week: 1, start_time: "09:00", end_time: "10:00" });

  const load = async () => {
    if (!user) return;
    const [{ data: subs }, { data: sl }] = await Promise.all([
      supabase.from("subjects").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("timetable_slots").select("*, subjects(name, color)").eq("user_id", user.id).order("start_time"),
    ]);
    setSubjects(subs || []);
    setSlots(sl || []);
  };
  useEffect(() => { load(); }, [user]);

  const addSubject = async () => {
    if (!user || !subjName.trim()) return;
    if (!isPro && subjects.length >= FREE_LIMIT) { setShowUpgrade(true); return; }
    const { error } = await supabase.from("subjects").insert({ user_id: user.id, name: subjName, color: subjColor });
    if (error) return toast.error(error.message);
    setSubjName(""); setShowSubject(false); load();
  };

  const addSlot = async () => {
    if (!user || !slotData.subject_id) return;
    await supabase.from("timetable_slots").insert({ ...slotData, user_id: user.id });
    setShowSlot(false); load();
  };

  const delSlot = async (id: string) => { await supabase.from("timetable_slots").delete().eq("id", id); load(); };
  const delSubject = async (id: string) => { await supabase.from("subjects").delete().eq("id", id); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Timetable</h1>
          <p className="text-muted-foreground">Plan your week. {!isPro && <span className="text-accent">{subjects.length}/{FREE_LIMIT} subjects</span>}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showSubject} onOpenChange={setShowSubject}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-1" />Subject</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New subject</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={subjName} onChange={e => setSubjName(e.target.value)} placeholder="Mathematics" /></div>
                <div><Label>Color</Label><Input type="color" value={subjColor} onChange={e => setSubjColor(e.target.value)} className="h-10 w-20" /></div>
                <Button onClick={addSubject} className="w-full">Add subject</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showSlot} onOpenChange={setShowSlot}>
            <DialogTrigger asChild><Button disabled={!subjects.length}><Plus className="w-4 h-4 mr-1" />Time slot</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New time slot</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Subject</Label>
                  <Select value={slotData.subject_id} onValueChange={v => setSlotData({ ...slotData, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Day</Label>
                  <Select value={String(slotData.day_of_week)} onValueChange={v => setSlotData({ ...slotData, day_of_week: +v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start</Label><Input type="time" value={slotData.start_time} onChange={e => setSlotData({ ...slotData, start_time: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="time" value={slotData.end_time} onChange={e => setSlotData({ ...slotData, end_time: e.target.value })} /></div>
                </div>
                <Button onClick={addSlot} className="w-full">Add slot</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-5 bg-gradient-card border-border">
        <h2 className="font-semibold mb-3">Subjects</h2>
        {subjects.length === 0 ? <p className="text-sm text-muted-foreground">No subjects yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {subjects.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 text-sm">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.name}
                <button onClick={() => delSubject(s.id)} className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-7 gap-3">
        {DAYS.map((day, dow) => {
          const daySlots = slots.filter(s => s.day_of_week === dow);
          return (
            <Card key={day} className="p-3 bg-gradient-card border-border min-h-[150px]">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">{day}</div>
              <div className="space-y-1.5">
                {daySlots.map(s => (
                  <div key={s.id} className="text-xs p-2 rounded-md group relative" style={{ background: `${s.subjects?.color}22`, borderLeft: `2px solid ${s.subjects?.color}` }}>
                    <div className="font-medium truncate">{s.subjects?.name}</div>
                    <div className="text-muted-foreground">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</div>
                    <button onClick={() => delSlot(s.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} feature="More than 3 subjects" />
    </div>
  );
}
