
-- 1) Tighten profiles cross-user exposure: drop broad item-owners policy, expose only safe columns via a view
DROP POLICY IF EXISTS "profiles select item owners" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, full_name FROM public.profiles;

-- Allow authenticated users to read the safe view. RLS on profiles still gates row access;
-- add a narrow SELECT policy permitting id+full_name reads for item owners and message partners
-- by allowing rows visible only through the view path. Easiest: add a policy that allows any
-- authenticated select but we restrict via view's column list. To keep email/student_id private,
-- the only remaining SELECT policies are 'profiles select own or admin' and 'profiles select message partners'.
-- To make the view work for any user, add a policy on the view's underlying read scoped by an
-- EXISTS-from-items check is what we removed. Instead use a SECURITY DEFINER function for name lookup.

DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_profile_names(_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = ANY(_ids);
$$;

REVOKE ALL ON FUNCTION public.get_profile_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_names(uuid[]) TO authenticated;

-- 2) Claim requests: enforce finder_id server-side via BEFORE INSERT trigger
CREATE OR REPLACE FUNCTION public.set_claim_finder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_finder uuid; v_lost_owner uuid;
BEGIN
  SELECT user_id INTO v_finder FROM public.found_items WHERE id = NEW.found_item_id;
  IF v_finder IS NULL THEN
    RAISE EXCEPTION 'Invalid found_item_id';
  END IF;
  SELECT user_id INTO v_lost_owner FROM public.lost_items WHERE id = NEW.lost_item_id;
  IF v_lost_owner IS NULL OR v_lost_owner <> auth.uid() THEN
    RAISE EXCEPTION 'You do not own this lost item';
  END IF;
  IF v_finder = auth.uid() THEN
    RAISE EXCEPTION 'You cannot claim your own found item';
  END IF;
  NEW.finder_id := v_finder;
  NEW.owner_id := auth.uid();
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_claim_finder ON public.claim_requests;
CREATE TRIGGER trg_set_claim_finder
BEFORE INSERT ON public.claim_requests
FOR EACH ROW EXECUTE FUNCTION public.set_claim_finder();

-- Simplify INSERT policy: trust trigger to set finder_id/owner_id
DROP POLICY IF EXISTS "owner creates own claim" ON public.claim_requests;
CREATE POLICY "owner creates own claim"
ON public.claim_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.lost_items li WHERE li.id = lost_item_id AND li.user_id = auth.uid())
);

-- 3) Realtime channel authorization for messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read own message channels" ON realtime.messages;
CREATE POLICY "authenticated can read own message channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'messages:%')
  AND (
    split_part(realtime.topic(), ':', 2) = auth.uid()::text
    OR split_part(realtime.topic(), ':', 3) = auth.uid()::text
  )
);
