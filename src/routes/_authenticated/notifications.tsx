import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — FindX" }] }),
  component: NotifPage,
});

interface Partner { id: string; full_name: string; }

function NotifPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [partners, setPartners] = useState<Record<string, Partner>>({});

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const notifs = data ?? [];
    setItems(notifs);

    // Resolve the "other party" for each notification via its linked items
    const lostIds = Array.from(new Set(notifs.map((n) => n.match_lost_id).filter((x): x is string => !!x)));
    const foundIds = Array.from(new Set(notifs.map((n) => n.match_found_id).filter((x): x is string => !!x)));
    const [{ data: lost }, { data: found }] = await Promise.all([
      lostIds.length ? supabase.from("lost_items").select("id, user_id").in("id", lostIds) : Promise.resolve({ data: [] as any[] }),
      foundIds.length ? supabase.from("found_items").select("id, user_id").in("id", foundIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const lostMap = new Map((lost ?? []).map((r: any) => [r.id, r.user_id]));
    const foundMap = new Map((found ?? []).map((r: any) => [r.id, r.user_id]));

    const partnerIds = new Set<string>();
    const byNotif: Record<string, string> = {};
    for (const n of notifs) {
      const lostOwner = n.match_lost_id ? lostMap.get(n.match_lost_id) : undefined;
      const foundOwner = n.match_found_id ? foundMap.get(n.match_found_id) : undefined;
      const partnerId = [lostOwner, foundOwner].find((id) => id && id !== user.id);
      if (partnerId) {
        byNotif[n.id] = partnerId;
        partnerIds.add(partnerId);
      }
    }

    if (partnerIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(partnerIds));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name as string]));
      const map: Record<string, Partner> = {};
      for (const [nid, pid] of Object.entries(byNotif)) {
        map[nid] = { id: pid, full_name: profMap.get(pid) ?? "FindX user" };
      }
      setPartners(map);
    } else {
      setPartners({});
    }
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
      <main className="container mx-auto px-4 py-10 max-w-3xl">
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
            {items.map((n) => {
              const partner = partners[n.id];
              const role = n.match_kind === "lost->found" ? "finder" : "owner";
              return (
                <Card key={n.id} className={`p-4 ${!n.read ? "border-primary/40 bg-primary/5" : ""}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{n.title}</h3>
                        {!n.read && <Badge className="bg-primary text-primary-foreground">New</Badge>}
                        {n.confidence != null && <Badge variant="outline">{n.confidence}% match</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      {partner && (
                        <p className="text-xs mt-2 inline-flex items-center gap-1 text-foreground/80">
                          <User className="h-3 w-3" />
                          <span className="capitalize text-muted-foreground">{role}:</span>
                          <span className="font-medium">{partner.full_name}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), "PPp")}</p>
                    </div>
                    {partner && (
                      <Button asChild size="sm" className="bg-gradient-brand text-white shrink-0">
                        <Link to="/messages/$userId" params={{ userId: partner.id }}>
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Message {role}
                        </Link>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
