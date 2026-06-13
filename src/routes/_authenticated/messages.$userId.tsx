import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  head: () => ({ meta: [{ title: "Chat — FindX" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { userId: partnerId } = Route.useParams();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [partnerName, setPartnerName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true });
    setMsgs(data ?? []);

    // mark received messages as read
    const unread = (data ?? []).filter((m: any) => m.recipient_id === user.id && !m.read).map((m: any) => m.id);
    if (unread.length) {
      await (supabase as any).from("messages").update({ read: true }).in("id", unread);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    supabase.from("profiles").select("full_name").eq("id", partnerId).maybeSingle().then(({ data }) => {
      if (data) setPartnerName(data.full_name);
    });

    const channel = supabase
      .channel(`messages:${user.id}:${partnerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const m = payload.new;
          const involvesPair =
            (m.sender_id === user.id && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === user.id);
          if (involvesPair) load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, partnerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);
    const content = text.trim().slice(0, 2000);
    const { error } = await (supabase as any)
      .from("messages")
      .insert({ sender_id: user.id, recipient_id: partnerId, content });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    load();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-2xl flex-1 flex flex-col w-full">
        <div className="flex items-center gap-3 mb-4">
          <Button asChild size="icon" variant="ghost">
            <Link to="/messages"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{partnerName || "Conversation"}</h1>
            <p className="text-xs text-muted-foreground">Be respectful and arrange a safe handover on campus.</p>
          </div>
        </div>

        <Card className="flex-1 flex flex-col p-4 min-h-[60vh]">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {msgs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">No messages yet. Say hello 👋</p>
            )}
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "p")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="mt-3 flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              maxLength={2000}
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !text.trim()} className="bg-gradient-brand text-white">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
