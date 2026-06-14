
-- 1) Tighten message INSERT: require an active match notification between the two users
DROP POLICY IF EXISTS "messages send as self" ON public.messages;

CREATE POLICY "messages send as self with active match"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> recipient_id
  AND EXISTS (
    SELECT 1
    FROM public.notifications n
    LEFT JOIN public.lost_items li ON li.id = n.match_lost_id
    LEFT JOIN public.found_items fi ON fi.id = n.match_found_id
    WHERE (
      (li.user_id = auth.uid() AND fi.user_id = recipient_id)
      OR (fi.user_id = auth.uid() AND li.user_id = recipient_id)
      OR (li.user_id = recipient_id AND fi.user_id = auth.uid())
      OR (fi.user_id = recipient_id AND li.user_id = auth.uid())
    )
  )
);

-- 2) Claim requests table
CREATE TABLE public.claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_item_id uuid NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
  found_item_id uuid NOT NULL REFERENCES public.found_items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  finder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lost_item_id, found_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_requests TO authenticated;
GRANT ALL ON public.claim_requests TO service_role;

ALTER TABLE public.claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim participants can view"
ON public.claim_requests FOR SELECT
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = finder_id);

CREATE POLICY "owner creates own claim"
ON public.claim_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.lost_items li WHERE li.id = lost_item_id AND li.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.found_items fi WHERE fi.id = found_item_id AND fi.user_id = finder_id)
);

CREATE POLICY "finder decides claim"
ON public.claim_requests FOR UPDATE
TO authenticated
USING (auth.uid() = finder_id)
WITH CHECK (auth.uid() = finder_id);

CREATE TRIGGER claim_requests_set_updated_at
BEFORE UPDATE ON public.claim_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
