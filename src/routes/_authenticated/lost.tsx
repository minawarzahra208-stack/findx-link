import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/ItemCard";
import { ItemFormDialog } from "@/components/ItemFormDialog";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { getLostMessagePartners } from "@/lib/matches.functions";

export const Route = createFileRoute("/_authenticated/lost")({
  head: () => ({ meta: [{ title: "My Lost Items — FindX" }] }),
  component: LostPage,
});

function LostPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [partnerByItem, setPartnerByItem] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    const [{ data }, partners] = await Promise.all([
      supabase.from("lost_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      getLostMessagePartners(),
    ]);
    setItems(data ?? []);

    setPartnerByItem(partners ?? {});
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("lost_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const markRecovered = async (id: string) => {
    const { error } = await supabase.from("lost_items").update({ status: "recovered" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as recovered");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Lost Reports</h1>
            <p className="text-muted-foreground">Manage everything you've reported as lost.</p>
          </div>
          <ItemFormDialog type="lost" onSaved={load} trigger={
            <Button className="bg-gradient-brand text-white"><Plus className="mr-2 h-4 w-4" /> Report Lost</Button>
          } />
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            You haven't reported any lost items yet.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} type="lost" actions={
                <>
                  <ItemFormDialog type="lost" initial={it} onSaved={load} trigger={
                    <Button size="sm" variant="outline"><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                  } />
                  {it.status !== "recovered" && (
                    <Button size="sm" variant="outline" onClick={() => markRecovered(it.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Recovered
                    </Button>
                  )}
                  {partnerByItem[it.id] && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/messages/$userId" params={{ userId: partnerByItem[it.id] }}>
                        <MessageSquare className="h-3 w-3 mr-1" />Message finder
                      </Link>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(it.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              } />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
