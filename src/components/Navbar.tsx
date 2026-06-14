import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, MessageSquare, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    const load = async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    };
    load();
    const channel = supabase
      .channel(`nav-unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-gradient-brand">FindX</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/search" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Search
          </Link>
          {user && (
            <>
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link to="/lost" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Lost
              </Link>
              <Link to="/found" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Found
              </Link>
              <Link to="/messages" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Messages
              </Link>
              {role === "admin" && (
                <Link to="/admin" className="px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/messages" })} aria-label="Messages" className="relative">
                <MessageSquare className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/notifications" })} aria-label="Notifications">
                <Bell className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/search" })} aria-label="Search" className="md:hidden">
                <Search className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>
                Sign in
              </Button>
              <Button size="sm" className="bg-gradient-brand text-white shadow-glow hover:opacity-90" onClick={() => navigate({ to: "/auth", search: { mode: "signup" } as never })}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
