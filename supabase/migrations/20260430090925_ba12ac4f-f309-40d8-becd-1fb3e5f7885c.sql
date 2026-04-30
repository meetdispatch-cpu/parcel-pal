
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'receiver');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Parcels
CREATE TYPE public.parcel_status AS ENUM ('dispatched', 'delivered');

CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE DEFAULT 'PKG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  description TEXT,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status parcel_status NOT NULL DEFAULT 'dispatched',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view sent parcels" ON public.parcels FOR SELECT TO authenticated
  USING (auth.uid() = sender_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Receivers view their parcels" ON public.parcels FOR SELECT TO authenticated
  USING (auth.uid() = receiver_id AND public.has_role(auth.uid(), 'receiver'));

CREATE POLICY "Admins create parcels" ON public.parcels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Receivers mark delivered" ON public.parcels FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id AND public.has_role(auth.uid(), 'receiver'))
  WITH CHECK (auth.uid() = receiver_id);

-- Realtime
ALTER TABLE public.parcels REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;
