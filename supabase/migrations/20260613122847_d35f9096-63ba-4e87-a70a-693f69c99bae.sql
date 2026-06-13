
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select all authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Auto profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_id, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'student_id',
    NEW.email
  );
  IF lower(NEW.email) = lower('zumlafathima6@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lost items
CREATE TABLE public.lost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  date_lost DATE NOT NULL,
  location_lost TEXT NOT NULL,
  image_url TEXT,
  contact_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','recovered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lost_items TO authenticated;
GRANT ALL ON public.lost_items TO service_role;
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lost read all authed" ON public.lost_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "lost insert own" ON public.lost_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lost update own or admin" ON public.lost_items FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "lost delete own or admin" ON public.lost_items FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Found items
CREATE TABLE public.found_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  date_found DATE NOT NULL,
  location_found TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.found_items TO authenticated;
GRANT ALL ON public.found_items TO service_role;
ALTER TABLE public.found_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "found read all authed" ON public.found_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "found insert own" ON public.found_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "found update own or admin" ON public.found_items FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "found delete own or admin" ON public.found_items FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  match_kind TEXT,
  match_lost_id UUID REFERENCES public.lost_items(id) ON DELETE CASCADE,
  match_found_id UUID REFERENCES public.found_items(id) ON DELETE CASCADE,
  confidence INTEGER,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif read own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif delete own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER lost_set_updated_at BEFORE UPDATE ON public.lost_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER found_set_updated_at BEFORE UPDATE ON public.found_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Match scoring
CREATE OR REPLACE FUNCTION public.match_score(a_name TEXT, a_cat TEXT, a_loc TEXT, b_name TEXT, b_cat TEXT, b_loc TEXT)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
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

-- Match on lost insert -> search found
CREATE OR REPLACE FUNCTION public.match_on_lost()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; s INTEGER;
BEGIN
  FOR r IN SELECT * FROM public.found_items WHERE status = 'pending' LOOP
    s := public.match_score(NEW.item_name, NEW.category, NEW.location_lost, r.item_name, r.category, r.location_found);
    IF s >= 50 THEN
      INSERT INTO public.notifications (user_id, title, message, match_kind, match_lost_id, match_found_id, confidence)
      VALUES (NEW.user_id, 'Possible match found!',
        'A found item "'||r.item_name||'" ('||r.category||') at '||r.location_found||' may match your lost report.',
        'lost->found', NEW.id, r.id, s);
      INSERT INTO public.notifications (user_id, title, message, match_kind, match_lost_id, match_found_id, confidence)
      VALUES (r.user_id, 'Someone reported losing an item you found',
        'A lost report for "'||NEW.item_name||'" ('||NEW.category||') at '||NEW.location_lost||' may match the item you found.',
        'found->lost', NEW.id, r.id, s);
      UPDATE public.lost_items SET status='matched' WHERE id = NEW.id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER lost_after_insert AFTER INSERT ON public.lost_items FOR EACH ROW EXECUTE FUNCTION public.match_on_lost();

CREATE OR REPLACE FUNCTION public.match_on_found()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; s INTEGER;
BEGIN
  FOR r IN SELECT * FROM public.lost_items WHERE status = 'pending' LOOP
    s := public.match_score(NEW.item_name, NEW.category, NEW.location_found, r.item_name, r.category, r.location_lost);
    IF s >= 50 THEN
      INSERT INTO public.notifications (user_id, title, message, match_kind, match_lost_id, match_found_id, confidence)
      VALUES (r.user_id, 'Possible match found!',
        'A found item "'||NEW.item_name||'" ('||NEW.category||') at '||NEW.location_found||' may match your lost report.',
        'lost->found', r.id, NEW.id, s);
      INSERT INTO public.notifications (user_id, title, message, match_kind, match_lost_id, match_found_id, confidence)
      VALUES (NEW.user_id, 'Someone reported losing an item you found',
        'A lost report for "'||r.item_name||'" ('||r.category||') at '||r.location_lost||' may match the item you found.',
        'found->lost', r.id, NEW.id, s);
      UPDATE public.lost_items SET status='matched' WHERE id = r.id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER found_after_insert AFTER INSERT ON public.found_items FOR EACH ROW EXECUTE FUNCTION public.match_on_found();
