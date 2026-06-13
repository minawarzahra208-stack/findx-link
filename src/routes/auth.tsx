import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FindX" }, { name: "description", content: "Sign in or create your FindX account." }] }),
  component: AuthPage,
});

const signUpSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  student_id: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  // Sign in
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(signIn);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  // Sign up
  const [signUp, setSignUp] = useState({ full_name: "", student_id: "", email: "", password: "", confirm: "" });
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUp.password !== signUp.confirm) return toast.error("Passwords do not match");
    const parsed = signUpSchema.safeParse(signUp);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name, student_id: parsed.data.student_id },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! You're signed in.");
    navigate({ to: "/dashboard" });
  };

  const handleGoogle = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (res.error) { setBusy(false); return toast.error("Google sign-in failed"); }
    if (res.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass p-8 border-border/40">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-brand shadow-glow mb-3">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to FindX</h1>
          <p className="text-sm text-muted-foreground">Reconnect with your belongings</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={signIn.email} onChange={(e) => setSignIn({ ...signIn, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" required value={signIn.password} onChange={(e) => setSignIn({ ...signIn, password: e.target.value })} />
              </div>
              <Button type="submit" className="w-full bg-gradient-brand text-white" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input required value={signUp.full_name} onChange={(e) => setSignUp({ ...signUp, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Student ID</Label>
                <Input required value={signUp.student_id} onChange={(e) => setSignUp({ ...signUp, student_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={signUp.email} onChange={(e) => setSignUp({ ...signUp, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" required value={signUp.password} onChange={(e) => setSignUp({ ...signUp, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Confirm</Label>
                  <Input type="password" required value={signUp.confirm} onChange={(e) => setSignUp({ ...signUp, confirm: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full bg-gradient-brand text-white" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">OR</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 2.18-5.42 2.18-4.32 0-7.7-3.48-7.7-7.8s3.38-7.8 7.7-7.8c2.32 0 4.02.92 5.27 2.1l2.32-2.32C18.97 1.97 16.57 1 12.48 1 6.55 1 1.6 5.95 1.6 11.88s4.95 10.88 10.88 10.88c3.3 0 5.78-1.08 7.71-3.07 1.98-1.98 2.6-4.78 2.6-7.03 0-.7-.05-1.34-.16-1.88z"/></svg>
          Continue with Google
        </Button>
      </Card>
    </div>
  );
}
