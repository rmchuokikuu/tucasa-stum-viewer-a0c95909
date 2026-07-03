
-- 1. Rename union
UPDATE public.unions SET name = 'Southern Tanzania Union'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 2. Link members to auth users
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

-- 3. RLS: self-view, self-update, self-insert at signup
DROP POLICY IF EXISTS "Users can view own member record" ON public.members;
CREATE POLICY "Users can view own member record"
  ON public.members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own member record" ON public.members;
CREATE POLICY "Users can update own member record"
  ON public.members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can self-register as member" ON public.members;
CREATE POLICY "Users can self-register as member"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Extend handle_new_user to create member row from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_branch_id uuid;
  v_full_name text;
  v_phone text;
  v_institution text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_institution := NEW.raw_user_meta_data->>'institution';
  v_branch_id := NULLIF(NEW.raw_user_meta_data->>'branch_id', '')::uuid;

  INSERT INTO public.profiles (user_id, full_name, email, phone, branch_id, institution)
  VALUES (NEW.id, v_full_name, NEW.email, v_phone, v_branch_id, v_institution);

  IF v_branch_id IS NOT NULL THEN
    INSERT INTO public.members (user_id, full_name, email, phone, institution, branch_id)
    VALUES (NEW.id, v_full_name, NEW.email, v_phone, v_institution, v_branch_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
