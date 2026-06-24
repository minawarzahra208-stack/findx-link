import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Send, ShieldCheck, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  head: () => ({ meta: [{ title: "Chat — FindX" }] }),
  component: ThreadPage,
});

interface MatchCtx {
  lost_item_id: string;
  found_item_id: string;
  // true when current user is the owner (loser); false = finder
  iAmOwner: boolean;
}

interface ClaimRow {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  owner_id: string;
  finder_id: string;
  decided_at: string | null;
  created_at: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function ThreadPage() {
  const { userId: partnerId } = Route.useParams();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [partnerName, setPartnerName] = useState("");
  const [myName, setMyName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [match, setMatch] = useState<MatchCtx | null>(null);
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [claimMsg, setClaimMsg] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
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

    const unread = (data ?? []).filter((m: any) => m.recipient_id === user.id && !m.read).map((m: any) => m.id);
    if (unread.length) {
      await (supabase as any).from("messages").update({ read: true }).in("id", unread);
    }
  };

  const loadMatch = async () => {
    if (!user) return;
    // Find a match notification linking these two users via their items
    const { data: lostMine } = await supabase.from("lost_items").select("id").eq("user_id", user.id);
    const { data: foundMine } = await supabase.from("found_items").select("id").eq("user_id", user.id);
    const { data: lostPartner } = await supabase.from("lost_items").select("id").eq("user_id", partnerId);
    const { data: foundPartner } = await supabase.from("found_items").select("id").eq("user_id", partnerId);

    const mineLostIds = (lostMine ?? []).map((r: any) => r.id);
    const mineFoundIds = (foundMine ?? []).map((r: any) => r.id);
    const partnerLostIds = (lostPartner ?? []).map((r: any) => r.id);
    const partnerFoundIds = (foundPartner ?? []).map((r: any) => r.id);

    // Case A: I'm owner — my lost item + partner's found item
    if (mineLostIds.length && partnerFoundIds.length) {
      const { data } = await supabase
        .from("notifications")
        .select("match_lost_id, match_found_id")
        .in("match_lost_id", mineLostIds)
        .in("match_found_id", partnerFoundIds)
        .limit(1);
      if (data && data.length) {
        setMatch({
          lost_item_id: data[0].match_lost_id as string,
          found_item_id: data[0].match_found_id as string,
          iAmOwner: true,
        });
        return;
      }
    }
    // Case B: I'm finder — partner's lost item + my found item
    if (partnerLostIds.length && mineFoundIds.length) {
      const { data } = await supabase
        .from("notifications")
        .select("match_lost_id, match_found_id")
        .in("match_lost_id", partnerLostIds)
        .in("match_found_id", mineFoundIds)
        .limit(1);
      if (data && data.length) {
        setMatch({
          lost_item_id: data[0].match_lost_id as string,
          found_item_id: data[0].match_found_id as string,
          iAmOwner: false,
        });
        return;
      }
    }
    setMatch(null);
  };

  const loadClaim = async (m: MatchCtx) => {
    const { data } = await (supabase as any)
      .from("claim_requests")
      .select("*")
      .eq("lost_item_id", m.lost_item_id)
      .eq("found_item_id", m.found_item_id)
      .maybeSingle();
    setClaim((data as ClaimRow | null) ?? null);
  };

  useEffect(() => {
    if (!user) return;
    load();
    loadMatch();
    supabase.rpc("get_profile_names", { _ids: [partnerId] }).then(({ data }) => {
      const row = (data as any[] | null)?.[0];
      if (row) setPartnerName(row.full_name);
    });
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setMyName(data.full_name);
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
    if (match) loadClaim(match);
  }, [match]);

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

  const submitClaim = async () => {
    if (!user || !match || !match.iAmOwner) return;
    setClaimBusy(true);
    const { error } = await (supabase as any).from("claim_requests").insert({
      lost_item_id: match.lost_item_id,
      found_item_id: match.found_item_id,
      owner_id: user.id,
      finder_id: partnerId,
      message: claimMsg.trim().slice(0, 500) || null,
    });
    setClaimBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setClaimMsg("");
    toast.success("Claim submitted");
    loadClaim(match);
  };

  const decideClaim = async (status: "approved" | "rejected") => {
    if (!user || !match || match.iAmOwner || !claim) return;
    setClaimBusy(true);
    const { error } = await (supabase as any)
      .from("claim_requests")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", claim.id);
    setClaimBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "Claim approved" : "Claim rejected");
    loadClaim(match);
  };

  const renderClaimPanel = () => {
    if (!match) return null;
    if (claim) {
      const color =
        claim.status === "approved"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
          : claim.status === "rejected"
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
      return (
        <Card className={`p-3 mb-3 border ${color}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold capitalize">Claim {claim.status}</span>
              {claim.message && <span className="text-muted-foreground"> — "{claim.message}"</span>}
            </div>
            {!match.iAmOwner && claim.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={claimBusy} onClick={() => decideClaim("rejected")}>
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button size="sm" className="bg-gradient-brand text-white" disabled={claimBusy} onClick={() => decideClaim("approved")}>
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
              </div>
            )}
          </div>
        </Card>
      );
    }
    if (match.iAmOwner) {
      return (
        <Card className="p-3 mb-3 border border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-primary mt-1" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">This looks like your item? Submit a claim for the finder to verify.</p>
              <Input
                value={claimMsg}
                onChange={(e) => setClaimMsg(e.target.value)}
                placeholder="Optional: distinguishing detail (color, serial, etc.)"
                maxLength={500}
              />
              <Button size="sm" className="bg-gradient-brand text-white" disabled={claimBusy} onClick={submitClaim}>
                Submit claim
              </Button>
            </div>
          </div>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-2xl flex-1 flex flex-col w-full">
        <div className="flex items-center gap-3 mb-4">
          <Button asChild size="icon" variant="ghost">
            <Link to="/messages"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-white text-sm font-semibold shrink-0">
            {initials(partnerName || "?")}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold truncate">{partnerName || "Conversation"}</h1>
            <p className="text-xs text-muted-foreground">
              {match ? (match.iAmOwner ? "Finder of your item" : "Owner of the item you found") : "Be respectful and arrange a safe handover."}
            </p>
          </div>
        </div>

        {renderClaimPanel()}

        <Card className="flex-1 flex flex-col p-4 min-h-[60vh]">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {msgs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">No messages yet. Say hello 👋</p>
            )}
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              const name = mine ? myName : partnerName;
              return (
                <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold shrink-0">
                      {initials(name || "?")}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold mb-0.5 ${mine ? "text-primary-foreground/80" : "text-foreground/70"}`}>
                      {name || (mine ? "You" : "User")}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "p · MMM d")}
                    </p>
                  </div>
                  {mine && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand text-white text-[11px] font-semibold shrink-0">
                      {initials(name || "?")}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="mt-3 flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={match ? "Type a message…" : "You can only message matched users"}
              maxLength={2000}
              disabled={sending || !match}
            />
            <Button type="submit" disabled={sending || !text.trim() || !match} className="bg-gradient-brand text-white">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {!match && (
            <p className="text-xs text-muted-foreground mt-2">
              Messaging is locked until a match exists between your items.
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}
