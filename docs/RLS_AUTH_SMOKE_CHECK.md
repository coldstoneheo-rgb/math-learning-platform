# RLS/Auth Smoke Check

This smoke check verifies the high-risk RLS/auth paths that recently caused
login failures and role-escalation risk.

It is intentionally read-only. It does not apply migrations and does not change
data.

## When To Run

Run this after RLS/auth migrations or before a beta release handoff.

Prerequisites:

- Supabase CLI is installed.
- The local repo is linked with `supabase link`.
- You have access to the linked project.

## Command

```bash
npm run smoke:rls
```

By default the script checks the known super-admin test user:

```text
9bd0920d-39e5-43b7-9b90-8e8edcf9ce8b
```

To check another authenticated user id:

```bash
TEST_TEACHER_USER_ID=<auth-user-uuid> npm run smoke:rls
```

## Checks

The script verifies:

- `users_insert_teacher` blocks teachers from creating `super_admin` rows.
- `current_user_role()` has `EXECUTE` grants for `authenticated` and `anon`.
- An authenticated `public.users` role lookup does not trigger RLS recursion.
- `count_reports_needing_attention_since` still responds for dashboard health.

## Expected Result

The command should exit with status `0` and print JSON output for each query.
For the policy check, confirm the `with_check` expression includes:

```text
role = ANY (ARRAY['teacher', 'parent', 'student'])
current_user_role() = 'super_admin'
```

For the helper grant check, confirm both roles appear:

```text
anon
authenticated
```

