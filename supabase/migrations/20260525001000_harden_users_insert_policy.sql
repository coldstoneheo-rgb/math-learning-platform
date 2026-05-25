-- Harden the recursion-safe users insert policy added in the RLS hotfix.
-- Teachers may create ordinary app users, but only super_admin can create a
-- super_admin row. Also allow anon to execute the helper so unauthenticated
-- RLS evaluation denies access cleanly instead of raising a permission error.

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

DROP POLICY IF EXISTS "users_insert_teacher" ON public.users;
CREATE POLICY "users_insert_teacher" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.current_user_role() = 'teacher'
      AND role IN ('teacher', 'parent', 'student')
    )
    OR public.current_user_role() = 'super_admin'
  );
