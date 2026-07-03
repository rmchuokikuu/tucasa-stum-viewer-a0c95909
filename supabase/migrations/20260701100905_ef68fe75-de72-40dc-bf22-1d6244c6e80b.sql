
CREATE TABLE IF NOT EXISTS public.super_admin_phones (
  phone text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.super_admin_phones TO authenticated;
GRANT ALL ON public.super_admin_phones TO service_role;
ALTER TABLE public.super_admin_phones ENABLE ROW LEVEL SECURITY;

-- No client policies: only security-definer function reads it.
CREATE POLICY "no direct access" ON public.super_admin_phones FOR SELECT USING (false);

INSERT INTO public.super_admin_phones(phone) VALUES ('0752519974')
ON CONFLICT (phone) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.super_admin_phones s ON s.phone = p.phone
    WHERE p.user_id = _uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon;
