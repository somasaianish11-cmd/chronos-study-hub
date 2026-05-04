import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Timer, Trophy, Layers, Calendar, BookOpen, Swords, Sparkles, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  { icon: Timer, title: "Pomodoro Timer", desc: "Focus sessions that auto-log to your study stats." },
  { icon: Calendar, title: "Smart Timetable", desc: "Plan your week with subject-coded time slots." },
  { icon: BookOpen, title: "Homework Tracker", desc: "Never miss an assignment again." },
  { icon: Trophy, title: "Weekly Leaderboard", desc: "Compete with peers — climb the ranks." },
  { icon: Swords, title: "Battle Mode", desc: "Challenge a friend to a 60-minute focus duel." },
  { icon: Layers, title: "Smart Flashcards", desc: "Spaced repetition that targets your weak spots." },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow"><Timer className="w-4 h-4 text-primary-foreground" /></div>
            <span className="font-bold text-lg">Chronos</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/pricing"><Button variant="ghost">Pricing</Button></Link>
            {user ? <Link to="/dashboard"><Button>Open app</Button></Link> : (
              <>
                <Link to="/login"><Button variant="ghost">Log in</Button></Link>
                <Link to="/signup"><Button>Get started</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 text-xs text-muted-foreground mb-6 animate-fade-in">
            <Sparkles className="w-3 h-3 text-primary" /> The all-in-one study OS
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            Study smarter. <br /><span className="text-gradient">Chronos has time.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 animate-slide-up">
            Pomodoro timer, timetable, homework, leaderboards, and flashcards — built for students who actually want to win.
          </p>
          <div className="flex items-center justify-center gap-3 animate-slide-up">
            <Link to={user ? "/dashboard" : "/signup"}>
              <Button size="lg" className="shadow-elevated">
                {user ? "Open dashboard" : "Start studying free"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/pricing"><Button size="lg" variant="outline">See pricing</Button></Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-gradient-card p-6 hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to lock in?</h2>
        <p className="text-muted-foreground mb-6">Free forever, with optional Pro for power users.</p>
        <Link to={user ? "/dashboard" : "/signup"}><Button size="lg">Get started <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
        <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1"><Check className="w-4 h-4 text-primary" /> No credit card</div>
          <div className="flex items-center gap-1"><Check className="w-4 h-4 text-primary" /> 30-second signup</div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Chronos · Built for focus.
      </footer>
    </div>
  );
}
