-- Tighten profiles SELECT: only owner or admin
DROP POLICY IF EXISTS "profiles select all authed" ON public.profiles;
CREATE POLICY "profiles select own or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Remove sensitive contact_number column from lost_items (exposed to all authed)
ALTER TABLE public.lost_items DROP COLUMN IF EXISTS contact_number;