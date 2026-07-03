
GRANT SELECT ON public.unions, public.conferences, public.zones, public.branches TO anon;

DROP POLICY IF EXISTS "Anyone can view unions" ON public.unions;
CREATE POLICY "Anyone can view unions" ON public.unions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view conferences" ON public.conferences;
CREATE POLICY "Anyone can view conferences" ON public.conferences FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view zones" ON public.zones;
CREATE POLICY "Anyone can view zones" ON public.zones FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view branches" ON public.branches;
CREATE POLICY "Anyone can view branches" ON public.branches FOR SELECT TO anon, authenticated USING (true);
