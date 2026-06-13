import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({ meta: [{ title: "Messages — FindX" }] }),
  component: InboxPage,
});

interface Thread {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

function InboxPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: msgs } = await (supabase as any)
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      const byPartner = new Map<string, Thread>();
      for (const m of msgs ?? []) {
        const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        const existing = byPartner.get(partnerId);
        const isUnread = m.recipient_id === user.id && !m.read;
        if (!existing) {
          byPartner.set(partnerId, {
            partnerId,
            partnerName: partnerId,
            lastMessage: m.content,
            lastAt: m.created_at,
            unread: isUnread ? 1 : 0,
          });
        } else if (isUnread) {
          existing.unread += 1;
        }
      }

      const ids = Array.from(byPartner.keys());
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        for (const p of profiles ?? []) {
          const t = byPartner.get(p.id);
          if (t) t.partnerName = p.full_name;
        }
      }

      setThreads(Array.from(byPartner.values()));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold flex items-center gap-2"><MessageSquare className="h-7 w-7" /> Messages</h1>
        <p className="text-muted-foreground">Chat with finders and owners.</p>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              No conversations yet. Open an item on Search and tap "Message".
            </div>
          ) : (
            threads.map((t) => (
              <Link key={t.partnerId} to="/messages/$userId" params={{ userId: t.partnerId }}>
                <Card className="p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{t.partnerName}</h3>
                        {t.unread > 0 && <Badge className="bg-primary text-primary-foreground">{t.unread}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">{t.lastMessage}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(t.lastAt), { addSuffix: true })}
                    </span>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
