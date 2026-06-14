import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PartnerMap = Record<string, string>;

export const getLostMessagePartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select("match_lost_id, match_found_id, created_at")
      .eq("user_id", userId)
      .eq("match_kind", "lost->found")
      .not("match_lost_id", "is", null)
      .not("match_found_id", "is", null)
      .order("created_at", { ascending: false });

    if (notifError) throw notifError;

    const foundIds = Array.from(
      new Set((notifications ?? []).map((m) => m.match_found_id).filter((id): id is string => !!id)),
    );

    if (!foundIds.length) return {} as PartnerMap;

    const { data: foundItems, error: foundError } = await supabase
      .from("found_items")
      .select("id, user_id")
      .in("id", foundIds);

    if (foundError) throw foundError;

    const foundOwnerById = new Map((foundItems ?? []).map((item) => [item.id, item.user_id]));
    const partnerByItem: PartnerMap = {};

    for (const match of notifications ?? []) {
      const lostId = match.match_lost_id as string | null;
      const foundId = match.match_found_id as string | null;
      if (!lostId || !foundId || partnerByItem[lostId]) continue;

      const partnerId = foundOwnerById.get(foundId);
      if (partnerId && partnerId !== userId) {
        partnerByItem[lostId] = partnerId;
      }
    }

    return partnerByItem;
  });

export const getFoundMessagePartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select("match_found_id, match_lost_id, created_at")
      .eq("user_id", userId)
      .eq("match_kind", "found->lost")
      .not("match_found_id", "is", null)
      .not("match_lost_id", "is", null)
      .order("created_at", { ascending: false });

    if (notifError) throw notifError;

    const lostIds = Array.from(
      new Set((notifications ?? []).map((m) => m.match_lost_id).filter((id): id is string => !!id)),
    );

    if (!lostIds.length) return {} as PartnerMap;

    const { data: lostItems, error: lostError } = await supabase
      .from("lost_items")
      .select("id, user_id")
      .in("id", lostIds);

    if (lostError) throw lostError;

    const lostOwnerById = new Map((lostItems ?? []).map((item) => [item.id, item.user_id]));
    const partnerByItem: PartnerMap = {};

    for (const match of notifications ?? []) {
      const foundId = match.match_found_id as string | null;
      const lostId = match.match_lost_id as string | null;
      if (!foundId || !lostId || partnerByItem[foundId]) continue;

      const partnerId = lostOwnerById.get(lostId);
      if (partnerId && partnerId !== userId) {
        partnerByItem[foundId] = partnerId;
      }
    }

    return partnerByItem;
  });