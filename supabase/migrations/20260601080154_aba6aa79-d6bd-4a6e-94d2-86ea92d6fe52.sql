
-- 1. Extend user_roles with lifecycle columns
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_date timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS end_date timestamptz;

-- 2. Helper: is this user_role currently active?
CREATE OR REPLACE FUNCTION public.is_role_active(_is_active boolean, _start_date timestamptz, _end_date timestamptz)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(_is_active, false)
     AND (_start_date IS NULL OR _start_date <= now())
     AND (_end_date IS NULL OR _end_date > now());
$$;

-- 3. Update existing security-definer functions to honor active flag/dates
CREATE OR REPLACE FUNCTION public.user_is_union_leader(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND hierarchy_level = 'union'
      AND public.is_role_active(is_active, start_date, end_date)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND public.is_role_active(is_active, start_date, end_date)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.name = _permission
      AND public.is_role_active(ur.is_active, ur.start_date, ur.end_date)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_conference_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id FROM conferences c
  WHERE public.user_is_union_leader(_user_id)
  UNION
  SELECT ur.level_id FROM user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.hierarchy_level = 'conference'
    AND public.is_role_active(ur.is_active, ur.start_date, ur.end_date)
$$;

CREATE OR REPLACE FUNCTION public.user_zone_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT z.id FROM zones z
  WHERE z.conference_id IN (SELECT public.user_conference_ids(_user_id))
  UNION
  SELECT ur.level_id FROM user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.hierarchy_level = 'zone'
    AND public.is_role_active(ur.is_active, ur.start_date, ur.end_date)
$$;

CREATE OR REPLACE FUNCTION public.user_branch_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id FROM branches b
  WHERE b.zone_id IN (SELECT public.user_zone_ids(_user_id))
  UNION
  SELECT ur.level_id FROM user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.hierarchy_level = 'branch'
    AND public.is_role_active(ur.is_active, ur.start_date, ur.end_date)
$$;

-- 4. Guard: never allow a user to assign leadership to themselves
CREATE OR REPLACE FUNCTION public.prevent_self_role_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Users cannot assign leadership roles to themselves';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_assignment ON public.user_roles;
CREATE TRIGGER trg_prevent_self_role_assignment
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_assignment();

-- 5. Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,            -- 'created' | 'updated' | 'deleted'
  entity_type text NOT NULL,       -- table name
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Union leaders can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.user_is_union_leader(auth.uid()));

-- 6. Generic audit trigger
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_email text;
  v_action text;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new := to_jsonb(NEW);
    v_entity_id := (NEW).id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_entity_id := (NEW).id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old := to_jsonb(OLD);
    v_entity_id := (OLD).id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_actor, v_email, v_action, TG_TABLE_NAME, v_entity_id, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. Attach audit triggers
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['members','user_roles','unions','conferences','zones','branches','roles','role_permissions'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
      t, t
    );
  END LOOP;
END $$;
