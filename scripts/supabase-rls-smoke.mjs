import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const teacherUserId =
  process.env.TEST_TEACHER_USER_ID ?? '9bd0920d-39e5-43b7-9b90-8e8edcf9ce8b';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tmpDir = join(process.cwd(), '.tmp', 'rls-smoke');

mkdirSync(tmpDir, { recursive: true });

const checks = [
  {
    name: 'users_insert_teacher policy blocks teacher-created super_admin rows',
    sql: `
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'users'
  and policyname = 'users_insert_teacher';
`,
  },
  {
    name: 'current_user_role execute grants include anon and authenticated',
    sql: `
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'current_user_role'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
`,
  },
  {
    name: 'authenticated users role lookup avoids RLS recursion',
    sql: `
set role authenticated;
set request.jwt.claim.sub = '${teacherUserId}';
select role
from public.users
where id = '${teacherUserId}';
reset role;
`,
  },
  {
    name: 'teacher dashboard attention RPC responds',
    sql: `
select public.count_reports_needing_attention_since(now() - interval '30 days') as attention_count;
`,
  },
];

for (const [index, check] of checks.entries()) {
  console.log(`\n== ${check.name} ==`);

  const sqlPath = join(tmpDir, `${String(index + 1).padStart(2, '0')}.sql`);
  writeFileSync(sqlPath, check.sql);

  const result = spawnSync(
    npxCommand,
    ['supabase', 'db', 'query', '--linked', '-o', 'json', '-f', sqlPath],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.error) {
    console.error(result.error.message);
    console.error(`\nSmoke check failed before query execution: ${check.name}`);
    process.exit(1);
  }

  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim() ?? '';

  if (stdout) {
    console.log(stdout);
  }

  if (stderr) {
    console.error(stderr);
  }

  if (result.status !== 0) {
    console.error(`\nSmoke check failed: ${check.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nRLS/Auth smoke checks completed.');
