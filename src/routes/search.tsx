import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemCard } from "@/components/ItemCard";
import { CATEGORIES } from "@/lib/categories";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search Items — FindX" }, { name: "description", content: "Search lost and found items reported on campus." }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [tab, setTab] = useState<"lost" | "found">("lost");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const table = tab === "lost" ? "lost_items" : "found_items";
      let query = supabase.from(table).select("*").order("created_at", { ascending: false }).limit(60);
      if (cat !== "all") query = query.eq("category", cat);
      if (status !== "all") query = query.eq("status", status);
      if (q.trim()) query = query.or(`item_name.ilike.%${q}%,description.ilike.%${q}%`);
      const { data } = await query;
      setItems(data ?? []);
    })();
  }, [q, cat, status, tab]);

  const statuses = tab === "lost" ? ["pending", "matched", "recovered"] : ["pending", "claimed", "returned"];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold">Search items</h1>
        <p className="text-muted-foreground mt-1">Filter across the entire campus database.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name or description…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
          <TabsList>
            <TabsTrigger value="lost">Lost</TabsTrigger>
            <TabsTrigger value="found">Found</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-6">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">No items match your filters.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((it) => <ItemCard key={it.id} item={it} type={tab} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
