
-- Add academic info to profiles (used to derive finalist/continuing status; hidden from membership card)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS course text,
  ADD COLUMN IF NOT EXISTS course_duration integer,
  ADD COLUMN IF NOT EXISTS year_of_study integer,
  ADD COLUMN IF NOT EXISTS academic_completed_at timestamptz;

-- Seed roles for leadership assignment (idempotent)
INSERT INTO public.roles (name)
SELECT v FROM (VALUES ('Chairperson'),('Secretary'),('Treasurer'),('Communication Coordinator')) t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = t.v);

-- Seed core permissions
INSERT INTO public.permissions (name)
SELECT v FROM (VALUES ('manage_leaders'),('manage_members'),('view_reports')) t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = t.v);

-- Grant Chairperson + Secretary the manage_leaders + manage_members + view_reports perms
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name IN ('Chairperson','Secretary')
  AND p.name IN ('manage_leaders','manage_members','view_reports')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Treasurer + Communication Coordinator: view_reports only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name IN ('Treasurer','Communication Coordinator')
  AND p.name = 'view_reports'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
