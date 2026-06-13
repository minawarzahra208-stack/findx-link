import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSearch, PackageCheck, PackageSearch, Bell, Plus, Search } from "lucide-react";
import { ItemFormDialog } from "@/components/ItemFormDialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FindX" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ lost: 0, found: 0, recovered: 0, notifs: 0 });
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);

  const load = async () => {
    if (!user) return;
    const [lost, found, rec, notifs, prof] = await Promise.all([
      supabase.from("lost_items").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("found_items").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("lost_items").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "recovered"),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    setStats({ lost: lost.count ?? 0, found: found.count ?? 0, recovered: rec.count ?? 0, notifs: notifs.count ?? 0 });
    setProfile(prof.data);
  };

  useEffect(() => { load(); }, [user]);

  const cards = [
    { icon: FileSearch, label: "My Lost Reports", value: stats.lost, to: "/lost", tone: "from-violet-500 to-fuchsia-500" },
    { icon: PackageSearch, label: "My Found Reports", value: stats.found, to: "/found", tone: "from-blue-500 to-cyan-500" },
    { icon: PackageCheck, label: "Recovered Items", value: stats.recovered, to: "/lost", tone: "from-emerald-500 to-teal-500" },
    { icon: Bell, label: "Unread Notifications", value: stats.notifs, to: "/notifications", tone: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Welcome back{profile ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋</h1>
          <p className="text-muted-foreground mt-1">Here's your FindX activity at a glance.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} to={c.to} className="group">
              <Card className="p-5 border-border/60 bg-card/80 backdrop-blur transition hover:-translate-y-1 hover:shadow-glow">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white shadow-glow`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-3xl font-bold">{c.value}</div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="mt-8 p-6 bg-gradient-brand text-white shadow-glow">
          <h2 className="text-xl font-semibold">Quick actions</h2>
          <p className="text-white/80 text-sm mt-1">Report or search in seconds</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ItemFormDialog type="lost" onSaved={load} trigger={
              <Button className="bg-white text-primary hover:bg-white/90"><Plus className="mr-2 h-4 w-4" /> Report Lost</Button>
            } />
            <ItemFormDialog type="found" onSaved={load} trigger={
              <Button className="bg-white/15 text-white hover:bg-white/25 border border-white/30"><Plus className="mr-2 h-4 w-4" /> Report Found</Button>
            } />
            <Button asChild variant="ghost" className="text-white hover:bg-white/10">
              <Link to="/search"><Search className="mr-2 h-4 w-4" /> Search Items</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
