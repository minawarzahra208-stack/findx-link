DROP POLICY IF EXISTS "profiles select message partners" ON public.profiles;

CREATE POLICY "claim participants or admin can delete"
ON public.claim_requests
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = finder_id OR public.has_role(auth.uid(), 'admin'));