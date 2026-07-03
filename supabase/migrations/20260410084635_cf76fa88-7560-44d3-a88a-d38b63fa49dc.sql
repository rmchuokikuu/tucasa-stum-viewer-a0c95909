
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Hierarchy tables
CREATE TABLE public.unions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id UUID NOT NULL REFERENCES public.unions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  institution TEXT,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members table
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  institution TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hierarchy level enum
CREATE TYPE public.hierarchy_level AS ENUM ('union', 'conference', 'zone', 'branch');

-- Roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role-Permission junction
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- User roles (leadership assignments)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  hierarchy_level hierarchy_level NOT NULL,
  level_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id, hierarchy_level, level_id)
);

-- Enable RLS on all tables
ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions for hierarchical access
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.name = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_union_leader(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND hierarchy_level = 'union'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_conference_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM conferences c
  WHERE public.user_is_union_leader(_user_id)
  UNION
  SELECT ur.level_id FROM user_roles ur
  WHERE ur.user_id = _user_id AND ur.hierarchy_level = 'conference'
$$;

CREATE OR REPLACE FUNCTION public.user_zone_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id FROM zones z
  WHERE z.conference_id IN (SELECT public.user_conference_ids(_user_id))
  UNION
  SELECT ur.level_id FROM user_roles ur
  WHERE ur.user_id = _user_id AND ur.hierarchy_level = 'zone'
$$;

CREATE OR REPLACE FUNCTION public.user_branch_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id FROM branches b
  WHERE b.zone_id IN (SELECT public.user_zone_ids(_user_id))
  UNION
  SELECT ur.level_id FROM user_roles ur
  WHERE ur.user_id = _user_id AND ur.hierarchy_level = 'branch'
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id)
$$;

-- RLS Policies

-- Unions
CREATE POLICY "Authenticated can view unions" ON public.unions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Union leaders can insert unions" ON public.unions FOR INSERT TO authenticated WITH CHECK (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can update unions" ON public.unions FOR UPDATE TO authenticated USING (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can delete unions" ON public.unions FOR DELETE TO authenticated USING (public.user_is_union_leader(auth.uid()));

-- Conferences
CREATE POLICY "Leaders can view accessible conferences" ON public.conferences FOR SELECT TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR id IN (SELECT public.user_conference_ids(auth.uid()))
);
CREATE POLICY "Union leaders can insert conferences" ON public.conferences FOR INSERT TO authenticated WITH CHECK (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can update conferences" ON public.conferences FOR UPDATE TO authenticated USING (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can delete conferences" ON public.conferences FOR DELETE TO authenticated USING (public.user_is_union_leader(auth.uid()));

-- Zones
CREATE POLICY "Leaders can view accessible zones" ON public.zones FOR SELECT TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR conference_id IN (SELECT public.user_conference_ids(auth.uid())) OR id IN (SELECT public.user_zone_ids(auth.uid()))
);
CREATE POLICY "Conference+ leaders can insert zones" ON public.zones FOR INSERT TO authenticated WITH CHECK (
  public.user_is_union_leader(auth.uid()) OR conference_id IN (SELECT public.user_conference_ids(auth.uid()))
);
CREATE POLICY "Conference+ leaders can update zones" ON public.zones FOR UPDATE TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR conference_id IN (SELECT public.user_conference_ids(auth.uid()))
);
CREATE POLICY "Conference+ leaders can delete zones" ON public.zones FOR DELETE TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR conference_id IN (SELECT public.user_conference_ids(auth.uid()))
);

-- Branches
CREATE POLICY "Leaders can view accessible branches" ON public.branches FOR SELECT TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR zone_id IN (SELECT public.user_zone_ids(auth.uid())) OR id IN (SELECT public.user_branch_ids(auth.uid()))
);
CREATE POLICY "Zone+ leaders can insert branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (
  public.user_is_union_leader(auth.uid()) OR zone_id IN (SELECT public.user_zone_ids(auth.uid()))
);
CREATE POLICY "Zone+ leaders can update branches" ON public.branches FOR UPDATE TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR zone_id IN (SELECT public.user_zone_ids(auth.uid()))
);
CREATE POLICY "Zone+ leaders can delete branches" ON public.branches FOR DELETE TO authenticated USING (
  public.user_is_union_leader(auth.uid()) OR zone_id IN (SELECT public.user_zone_ids(auth.uid()))
);

-- Profiles
CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.user_has_any_role(auth.uid())
);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Members
CREATE POLICY "Leaders can view accessible members" ON public.members FOR SELECT TO authenticated USING (
  branch_id IN (SELECT public.user_branch_ids(auth.uid()))
);
CREATE POLICY "Leaders can add members" ON public.members FOR INSERT TO authenticated WITH CHECK (
  branch_id IN (SELECT public.user_branch_ids(auth.uid())) AND public.user_has_permission(auth.uid(), 'add_member')
);
CREATE POLICY "Leaders can update members" ON public.members FOR UPDATE TO authenticated USING (
  branch_id IN (SELECT public.user_branch_ids(auth.uid())) AND public.user_has_permission(auth.uid(), 'edit_member')
);
CREATE POLICY "Leaders can delete members" ON public.members FOR DELETE TO authenticated USING (
  branch_id IN (SELECT public.user_branch_ids(auth.uid())) AND public.user_has_permission(auth.uid(), 'delete_member')
);

-- Roles & Permissions (read-only for all, write for union leaders)
CREATE POLICY "Authenticated can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Union leaders can insert roles" ON public.roles FOR INSERT TO authenticated WITH CHECK (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can update roles" ON public.roles FOR UPDATE TO authenticated USING (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can delete roles" ON public.roles FOR DELETE TO authenticated USING (public.user_is_union_leader(auth.uid()));

CREATE POLICY "Authenticated can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Union leaders can insert permissions" ON public.permissions FOR INSERT TO authenticated WITH CHECK (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can update permissions" ON public.permissions FOR UPDATE TO authenticated USING (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can delete permissions" ON public.permissions FOR DELETE TO authenticated USING (public.user_is_union_leader(auth.uid()));

CREATE POLICY "Authenticated can view role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Union leaders can insert role_permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can update role_permissions" ON public.role_permissions FOR UPDATE TO authenticated USING (public.user_is_union_leader(auth.uid()));
CREATE POLICY "Union leaders can delete role_permissions" ON public.role_permissions FOR DELETE TO authenticated USING (public.user_is_union_leader(auth.uid()));

-- User roles
CREATE POLICY "Leaders can view user roles" ON public.user_roles FOR SELECT TO authenticated USING (
  public.user_has_any_role(auth.uid())
);
CREATE POLICY "Leaders can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (
  public.user_has_permission(auth.uid(), 'manage_leaders')
);
CREATE POLICY "Leaders can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING (
  public.user_has_permission(auth.uid(), 'manage_leaders')
);
CREATE POLICY "Leaders can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (
  public.user_has_permission(auth.uid(), 'manage_leaders')
);

-- Indexes
CREATE INDEX idx_conferences_union ON public.conferences(union_id);
CREATE INDEX idx_zones_conference ON public.zones(conference_id);
CREATE INDEX idx_branches_zone ON public.branches(zone_id);
CREATE INDEX idx_members_branch ON public.members(branch_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_level ON public.user_roles(hierarchy_level, level_id);

-- Triggers
CREATE TRIGGER update_unions_updated_at BEFORE UPDATE ON public.unions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conferences_updated_at BEFORE UPDATE ON public.conferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default roles
INSERT INTO public.roles (name, description) VALUES
  ('Chairperson', 'Leader/chairperson of the organizational unit'),
  ('Secretary', 'Secretary responsible for records and communication'),
  ('Treasurer', 'Treasurer responsible for financial management'),
  ('Vice Chairperson', 'Deputy leader of the organizational unit'),
  ('Coordinator', 'Coordinates activities and programs');

-- Seed permissions
INSERT INTO public.permissions (name, description) VALUES
  ('view_members', 'Can view member lists'),
  ('add_member', 'Can add new members'),
  ('edit_member', 'Can edit member details'),
  ('delete_member', 'Can delete members'),
  ('manage_leaders', 'Can assign and remove leaders'),
  ('view_reports', 'Can view reports and statistics');

-- Assign all permissions to Chairperson
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'Chairperson';

-- Secretary permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'Secretary' AND p.name IN ('view_members', 'add_member', 'edit_member', 'view_reports');

-- Treasurer permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'Treasurer' AND p.name IN ('view_members', 'view_reports');

-- Vice Chairperson and Coordinator permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name IN ('Vice Chairperson', 'Coordinator') AND p.name IN ('view_members', 'view_reports');
