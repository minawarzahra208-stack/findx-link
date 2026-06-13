import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Users, FileSearch, PackageSearch, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — FindX" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [lost, setLost] = useState<any[]>([]);
  const [found, setFound] = useState<any[]>([]);

  const load = async () => {
    const [u, l, f] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("lost_items").select("*").order("created_at", { ascending: false }),
      supabase.from("found_items").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers(u.data ?? []);
    setLost(l.data ?? []);
    setFound(f.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const del = async (table: "lost_items" | "found_items", id: string) => {
    if (!confirm("Remove this report?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  const recoveryRate = lost.length ? Math.round((lost.filter((l) => l.status === "recovered").length / lost.length) * 100) : 0;

  const categoryData = (() => {
    const map: Record<string, number> = {};
    [...lost, ...found].forEach((i) => (map[i.category] = (map[i.category] ?? 0) + 1));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  const statusData = [
    { name: "Pending", value: lost.filter((l) => l.status === "pending").length },
    { name: "Matched", value: lost.filter((l) => l.status === "matched").length },
    { name: "Recovered", value: lost.filter((l) => l.status === "recovered").length },
  ];

  const cards = [
    { icon: Users, label: "Total Users", value: users.length },
    { icon: FileSearch, label: "Lost Reports", value: lost.length },
    { icon: PackageSearch, label: "Found Reports", value: found.length },
    { icon: TrendingUp, label: "Recovery Rate", value: `${recoveryRate}%` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, reports, and review analytics.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-5">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-3xl font-bold">{c.value}</div>
              <div className="text-sm text-muted-foreground">{c.label}</div>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Items by category</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Lost item status</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Tabs defaultValue="lost" className="mt-8">
          <TabsList>
            <TabsTrigger value="lost">Lost reports</TabsTrigger>
            <TabsTrigger value="found">Found reports</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="lost" className="mt-4">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-3">Item</th><th className="p-3">Category</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {lost.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3 font-medium">{l.item_name}</td>
                      <td className="p-3">{l.category}</td>
                      <td className="p-3">{l.location_lost}</td>
                      <td className="p-3"><Badge variant="outline">{l.status}</Badge></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del("lost_items", l.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="found" className="mt-4">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-3">Item</th><th className="p-3">Category</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {found.map((f) => (
                    <tr key={f.id} className="border-t border-border">
                      <td className="p-3 font-medium">{f.item_name}</td>
                      <td className="p-3">{f.category}</td>
                      <td className="p-3">{f.location_found}</td>
                      <td className="p-3"><Badge variant="outline">{f.status}</Badge></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del("found_items", f.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-3">Name</th><th className="p-3">Student ID</th><th className="p-3">Email</th><th className="p-3">Joined</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3 font-medium">{u.full_name}</td>
                      <td className="p-3">{u.student_id ?? "—"}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
