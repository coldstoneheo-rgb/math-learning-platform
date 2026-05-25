-- Fix RLS recursion caused by policies on public.users reading public.users again.
-- The helper runs as the function owner, so policies can check the current user's
-- role without recursively evaluating public.users RLS policies.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT users.role
  FROM public.users AS users
  WHERE users.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS "users_all_super_admin" ON public.users;
CREATE POLICY "users_all_super_admin" ON public.users
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "users_select_teacher" ON public.users;
CREATE POLICY "users_select_teacher" ON public.users
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('teacher', 'super_admin'));

DROP POLICY IF EXISTS "users_insert_teacher" ON public.users;
CREATE POLICY "users_insert_teacher" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('teacher', 'super_admin'));

DROP POLICY IF EXISTS "students_all_super_admin" ON public.students;
CREATE POLICY "students_all_super_admin" ON public.students
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "students_all_teacher" ON public.students;
CREATE POLICY "students_all_teacher" ON public.students
  FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('teacher', 'super_admin'))
  WITH CHECK (public.current_user_role() IN ('teacher', 'super_admin'));

DROP POLICY IF EXISTS "reports_all_super_admin" ON public.reports;
CREATE POLICY "reports_all_super_admin" ON public.reports
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "reports_all_teacher" ON public.reports;
CREATE POLICY "reports_all_teacher" ON public.reports
  FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('teacher', 'super_admin'))
  WITH CHECK (public.current_user_role() IN ('teacher', 'super_admin'));
