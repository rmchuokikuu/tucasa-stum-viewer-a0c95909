
-- Enums
CREATE TYPE public.hierarchy_level AS ENUM ('union','conference','zone','branch');

-- Hierarchy tables
CREATE TABLE public.unions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unions TO authenticated;
GRANT SELECT ON public.unions TO anon;
GRANT ALL ON public.unions TO service_role;
ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unions read" ON public.unions FOR SELECT USING (true);
CREATE POLICY "unions write auth" ON public.unions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  union_id uuid NOT NULL REFERENCES public.unions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conferences TO authenticated;
GRANT SELECT ON public.conferences TO anon;
GRANT ALL ON public.conferences TO service_role;
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conferences read" ON public.conferences FOR SELECT USING (true);
CREATE POLICY "conferences write auth" ON public.conferences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  conference_id uuid NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT SELECT ON public.zones TO anon;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones read" ON public.zones FOR SELECT USING (true);
CREATE POLICY "zones write auth" ON public.zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  institution text,
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT SELECT ON public.branches TO anon;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches read" ON public.branches FOR SELECT USING (true);
CREATE POLICY "branches write auth" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Members
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  institution text,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read auth" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members write auth" ON public.members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  institution text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Roles & Permissions
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read auth" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles write auth" ON public.roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions read auth" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions write auth" ON public.permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp read auth" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp write auth" ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  hierarchy_level public.hierarchy_level NOT NULL,
  level_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, hierarchy_level, level_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur read auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "ur write auth" ON public.user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read auth" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit insert auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_unions_updated BEFORE UPDATE ON public.unions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_conferences_updated BEFORE UPDATE ON public.conferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_zones_updated BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone, institution, branch_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'institution',
    NULLIF(NEW.raw_user_meta_data->>'branch_id','')::uuid
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
