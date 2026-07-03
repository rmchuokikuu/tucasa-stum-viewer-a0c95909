
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid := NULLIF(NEW.raw_user_meta_data->>'branch_id','')::uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone, institution, branch_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'institution',
    v_branch
  );

  IF v_branch IS NOT NULL THEN
    INSERT INTO public.members (user_id, full_name, email, phone, institution, branch_id, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name',''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'institution',
      v_branch,
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill members for existing profiles without one
INSERT INTO public.members (user_id, full_name, email, phone, institution, branch_id, is_active)
SELECT p.user_id, COALESCE(p.full_name,''), p.email, p.phone, p.institution, p.branch_id, true
FROM public.profiles p
WHERE p.branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = p.user_id);
