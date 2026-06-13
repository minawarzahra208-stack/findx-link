import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — FindX" }] }),
  component: NotifPage,
});

function NotifPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="h-7 w-7" /> Notifications</h1>
            <p className="text-muted-foreground">Match alerts and updates on your items.</p>
          </div>
          <Button variant="outline" onClick={markAll}><Check className="h-4 w-4 mr-2" />Mark all read</Button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <Card key={n.id} className={`p-4 ${!n.read ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{n.title}</h3>
                      {!n.read && <Badge className="bg-primary text-primary-foreground">New</Badge>}
                      {n.confidence != null && <Badge variant="outline">{n.confidence}% match</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), "PPp")}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
