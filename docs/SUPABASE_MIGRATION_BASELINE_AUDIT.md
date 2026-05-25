# Supabase Migration Baseline Audit

Date: 2026-05-25

## Summary

Supabase Preview Branch currently fails before it reaches recent RLS migrations.
The failure is not caused by the latest RLS policy changes. It happens because
the migration stack starts with migrations that reference the core tables
`students` and `reports`, while those core tables are only defined in
`supabase/schema.sql` and not in an earlier migration file.

This audit is intentionally documentation-only. It does not add a baseline
migration and does not change production database state.

## Observed Failure

Supabase Preview reports:

```text
ERROR: relation "students" does not exist (SQLSTATE 42P01)
At statement: 0
CREATE TABLE IF NOT EXISTS study_plans (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ...
)
```

The failing statement is in:

```text
supabase/migrations/20250101000000_create_study_plans_tables.sql
```

## Current Migration Ordering

The first migration in `supabase/migrations` is:

```text
20250101000000_create_study_plans_tables.sql
```

There is no earlier migration that creates:

```text
public.users
public.students
public.reports
```

Those tables exist in `supabase/schema.sql`, but Supabase Preview Branch applies
the migration files in `supabase/migrations`. It does not use `schema.sql` as a
pre-migration baseline for branch creation.

## Evidence From The Migration Stack

Early migrations reference core tables immediately:

```text
20250101000000_create_study_plans_tables.sql: student_id REFERENCES students(id)
20250101000000_create_study_plans_tables.sql: report_id REFERENCES reports(id)
20250101000001_create_notification_logs_table.sql: student_id REFERENCES students(id)
20250101000002_create_achievements_tables.sql: student_id REFERENCES students(id)
```

Later migrations also depend on the same core tables:

```text
20251229_add_meta_profile.sql: ALTER TABLE students
20251229_add_meta_profile.sql: ALTER TABLE reports
20251230_add_strategy_tracking_and_predictions.sql: REFERENCES reports(id)
20251230_add_strategy_tracking_and_predictions.sql: REFERENCES students(id)
20260508_add_pgvector_rag.sql: REFERENCES reports(id), REFERENCES students(id)
20260510000000_add_student_user_id.sql: ALTER TABLE public.students
20260515000000_add_super_admin_role_and_student_code.sql: ALTER TABLE public.users
20260522000000_add_unique_student_user_id.sql: ALTER TABLE public.students
```

## Why A Backdated Baseline Was Considered

To make Preview Branch apply the stack from an empty database, the core tables
must exist before `20250101000000_create_study_plans_tables.sql`.

That means a baseline migration would need a filename earlier than
`20250101000000...`, for example:

```text
20240101000000_create_core_tables_baseline.sql
```

The older timestamp is not meant to imply that the file was authored in 2024. It
is an ordering mechanism required by the migration stack. Because this is easy
to misunderstand and affects the most important tables, it should not be slipped
into an unrelated hotfix PR.

## Risks

### Risk 1: Accidental Production Re-application

The linked production project appears to have an incomplete or non-populated CLI
migration history. Running `supabase db push` may try to apply old migrations
instead of only the intended new one.

Mitigation:

- Do not use `supabase db push` until migration history is reconciled.
- Prefer standard migration files; use `supabase migration repair` if the
  production migration history needs manual reconciliation.
- Keep structural baseline work in a separate PR and apply manually only after
  review.

### Risk 2: Baseline Drift From `schema.sql`

The current `schema.sql` is a snapshot, not an applied migration. It may already
lag behind production migrations. A baseline copied blindly from it can miss
columns, constraints, RLS policies, or functions required by later migrations.

Mitigation:

- Build the baseline from the minimum required core tables.
- Verify every later migration that references `users`, `students`, and
  `reports`.
- Keep the baseline idempotent with `CREATE TABLE IF NOT EXISTS` and
  `CREATE INDEX IF NOT EXISTS`.

### Risk 3: Backdated Migration Confusion

A new file with a timestamp such as `20240101000000` can look suspicious because
it predates current work.

Mitigation:

- Add an explicit header comment explaining that the old timestamp is for
  dependency ordering.
- Mention the related Supabase Preview failure in the PR body.
- Do not combine it with feature, RLS, or auth changes.

## Recommended Next Step

Create a dedicated PR for the baseline only. Do not auto-merge it.

Suggested file:

```text
supabase/migrations/20240101000000_create_core_tables_baseline.sql
```

Suggested scope:

- `public.users`
- `public.students`
- `public.reports`
- RLS helper functions and base policies for core tables
- minimal indexes required by existing queries and later migrations
- no data changes
- no destructive DDL
- no production DB execution from automation

The PR should stay open for manual review because it affects the foundation of
the migration stack.

## Non-Goals

- Do not fix every schema drift in this audit PR.
- Do not rename existing migrations.
- Do not apply SQL to the linked production database.
- Do not treat Supabase Preview failure as caused by the latest RLS hotfixes.
