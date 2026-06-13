import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, ShieldCheck, Zap, FileSearch, ArrowRight, Sparkles, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FindX — Reconnecting Students With Their Belongings" },
      { name: "description", content: "Lost something on campus? Found something? FindX is the modern lost & found system for university students." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [stats, setStats] = useState({ lost: 0, found: 0, recovered: 0, users: 0 });

  useEffect(() => {
    (async () => {
      const [lost, found, rec, users] = await Promise.all([
        supabase.from("lost_items").select("*", { count: "exact", head: true }),
        supabase.from("found_items").select("*", { count: "exact", head: true }),
        supabase.from("lost_items").select("*", { count: "exact", head: true }).eq("status", "recovered"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        lost: lost.count ?? 0,
        found: found.count ?? 0,
        recovered: rec.count ?? 0,
        users: users.count ?? 0,
      });
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero text-white">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass-dark px-4 py-1.5 text-sm">
              <Sparkles className="h-4 w-4" />
              Smart matching · Real-time notifications
            </div>
            <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
              Lost it? Found it?<br />
              <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                FindX it.
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              FindX reconnects students with their belongings across campus — secure, fast, and built for university life.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 shadow-glow">
                <Link to="/auth">Report Lost Item <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Link to="/auth">Report Found Item</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
                <Link to="/search">Browse Items</Link>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Lost Items", value: stats.lost },
              { label: "Found Items", value: stats.found },
              { label: "Recovered", value: stats.recovered },
              { label: "Active Users", value: stats.users },
            ].map((s) => (
              <div key={s.label} className="glass-dark rounded-2xl p-6 text-center">
                <div className="text-3xl md:text-4xl font-bold">{s.value}</div>
                <div className="mt-1 text-sm text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold">Everything you need to recover what's yours</h2>
          <p className="mt-4 text-muted-foreground">Built specifically for the chaos of campus life.</p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileSearch, title: "Easy Reporting", desc: "Submit lost or found reports in seconds with photos and details." },
            { icon: Zap, title: "Smart Matching", desc: "Our engine flags potential matches instantly across categories and locations." },
            { icon: ShieldCheck, title: "Secure Authentication", desc: "University-only access with role-based permissions and encrypted data." },
            { icon: Search, title: "Powerful Search", desc: "Filter by category, date, location, and status to find your item fast." },
          ].map((f) => (
            <Card key={f.title} className="p-6 border-border/60 bg-card/80 backdrop-blur transition-all hover:-translate-y-1 hover:shadow-glow">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-secondary/40 py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold">From lost to found in 3 steps</h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { n: "01", t: "Submit a report", d: "Tell us what you lost or what you found — with a photo, date, and location." },
              { n: "02", t: "Get matched", d: "FindX automatically compares your report with the entire database for potential matches." },
              { n: "03", t: "Reconnect", d: "Get notified instantly and contact the finder or owner to recover the item." },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="text-6xl font-bold text-gradient-brand">{s.n}</div>
                <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold">Loved by students</h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { name: "Ayesha P.", role: "CS · Year 3", text: "Found my student ID within hours of posting. FindX saved my exam day." },
            { name: "Ravi K.", role: "Engineering · Year 2", text: "The match notification was instant. Couldn't believe how fast it worked." },
            { name: "Sana M.", role: "Business · Year 4", text: "Beautiful, simple, and actually useful. Should be standard at every university." },
          ].map((t) => (
            <Card key={t.name} className="p-6 bg-card/80 backdrop-blur border-border/60">
              <Quote className="h-6 w-6 text-primary/40" />
              <p className="mt-3 text-sm">{t.text}</p>
              <div className="mt-4">
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-24">
        <div className="rounded-3xl bg-gradient-brand p-12 md:p-16 text-center text-white shadow-glow">
          <h2 className="text-4xl font-bold">Ready to find what's lost?</h2>
          <p className="mt-4 text-white/80">Join thousands of students recovering their belongings every semester.</p>
          <Button asChild size="lg" className="mt-8 bg-white text-primary hover:bg-white/90">
            <Link to="/auth">Get Started Free</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-brand"><Sparkles className="h-3 w-3 text-white" /></div>
            <span>© {new Date().getFullYear()} FindX</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">About</a>
            <a href="#" className="hover:text-foreground">Contact</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
