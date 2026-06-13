import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/ItemCard";
import { ItemFormDialog } from "@/components/ItemFormDialog";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/found")({
  head: () => ({ meta: [{ title: "My Found Items — FindX" }] }),
  component: FoundPage,
});

function FoundPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("found_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("found_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const markReturned = async (id: string) => {
    const { error } = await supabase.from("found_items").update({ status: "returned" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as returned");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Found Reports</h1>
            <p className="text-muted-foreground">Items you've turned in to help others.</p>
          </div>
          <ItemFormDialog type="found" onSaved={load} trigger={
            <Button className="bg-gradient-brand text-white"><Plus className="mr-2 h-4 w-4" /> Report Found</Button>
          } />
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            You haven't reported any found items yet.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} type="found" actions={
                <>
                  <ItemFormDialog type="found" initial={it} onSaved={load} trigger={
                    <Button size="sm" variant="outline"><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                  } />
                  {it.status !== "returned" && (
                    <Button size="sm" variant="outline" onClick={() => markReturned(it.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Returned
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
