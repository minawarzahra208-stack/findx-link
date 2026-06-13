
CREATE POLICY "item-images read authed" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'item-images');
CREATE POLICY "item-images insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "item-images update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "item-images delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.match_score(a_name TEXT, a_cat TEXT, a_loc TEXT, b_name TEXT, b_cat TEXT, b_loc TEXT)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE score INTEGER := 0;
BEGIN
  IF lower(a_cat) = lower(b_cat) THEN score := score + 40; END IF;
  IF lower(a_name) = lower(b_name) THEN score := score + 40;
  ELSIF position(lower(a_name) IN lower(b_name)) > 0 OR position(lower(b_name) IN lower(a_name)) > 0 THEN score := score + 25;
  END IF;
  IF a_loc IS NOT NULL AND b_loc IS NOT NULL AND (position(lower(a_loc) IN lower(b_loc)) > 0 OR position(lower(b_loc) IN lower(a_loc)) > 0) THEN
    score := score + 20;
  END IF;
  RETURN score;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_on_lost() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_on_found() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
