import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Upload } from "lucide-react";

const baseSchema = z.object({
  item_name: z.string().trim().min(1, "Required").max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.string().min(1, "Required"),
  date: z.string().min(1, "Required"),
  location: z.string().trim().min(1, "Required").max(200),
});

interface Props {
  type: "lost" | "found";
  trigger: React.ReactNode;
  initial?: any;
  onSaved?: () => void;
}

export function ItemFormDialog({ type, trigger, initial, onSaved }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    item_name: initial?.item_name ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "",
    date: initial?.[type === "lost" ? "date_lost" : "date_found"] ?? new Date().toISOString().slice(0, 10),
    location: initial?.[type === "lost" ? "location_lost" : "location_found"] ?? "",
    image_url: initial?.image_url ?? "",
  });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = baseSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl = form.image_url;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("item-images").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("item-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        imageUrl = signed?.signedUrl ?? "";
      }

      const payload: any = {
        item_name: form.item_name.trim(),
        description: form.description?.trim() || null,
        category: form.category,
        image_url: imageUrl || null,
      };
      if (type === "lost") {
        payload.date_lost = form.date;
        payload.location_lost = form.location.trim();
      } else {
        payload.date_found = form.date;
        payload.location_found = form.location.trim();
      }

      if (initial?.id) {
        const table = type === "lost" ? "lost_items" : "found_items";
        const { error } = await supabase.from(table).update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("Report updated");
      } else {
        payload.user_id = user.id;
        const table = type === "lost" ? "lost_items" : "found_items";
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success("Report submitted. We'll notify you of any matches.");
      }
      setOpen(false);
      onSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "Report"} {type === "lost" ? "Lost" : "Found"} Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item name</Label>
            <Input id="name" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Black leather wallet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date {type === "lost" ? "lost" : "found"}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Library 2nd floor" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Distinctive details, color, brand…" />
          </div>
          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <div className="flex items-center gap-3">
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-gradient-brand text-white">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Save changes" : "Submit report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
