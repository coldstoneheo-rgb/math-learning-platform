import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const teacherUserId =
  process.env.TEST_TEACHER_USER_ID ?? '9bd0920d-39e5-43b7-9b90-8e8edcf9ce8b';

if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    teacherUserId,
  )
) {
  console.error('Error: TEST_TEACHER_USER_ID must be a valid UUID.');
  process.exit(1);
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tmpDir = join(process.cwd(), '.tmp', 'rls-smoke');

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
    validate(rows) {
      const row = rows[0];
      const withCheck = row?.with_check ?? '';

      return (
        rows.length === 1 &&
        row.policyname === 'users_insert_teacher' &&
        row.cmd === 'INSERT' &&
        withCheck.includes("current_user_role() = 'teacher'") &&
        withCheck.includes("'parent'") &&
        withCheck.includes("'student'") &&
        withCheck.includes("current_user_role() = 'super_admin'")
      );
    },
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
    validate(rows) {
      const grantees = new Set(
        rows
          .filter((row) => row.privilege_type === 'EXECUTE')
          .map((row) => row.grantee),
      );

      return grantees.has('anon') && grantees.has('authenticated');
    },
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
    validate(rows) {
      return rows.length === 1 && rows[0].role === 'super_admin';
    },
  },
  {
    name: 'teacher dashboard attention RPC responds',
    sql: `
select public.count_reports_needing_attention_since(now() - interval '30 days') as attention_count;
`,
    validate(rows) {
      return (
        rows.length === 1 &&
        typeof rows[0].attention_count === 'number' &&
        rows[0].attention_count >= 0
      );
    },
  },
];

function parseRows(stdout, checkName) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');

  if (start < 0 || end < start) {
    throw new Error(`No JSON object found in CLI output for ${checkName}.`);
  }

  const parsed = JSON.parse(stdout.slice(start, end + 1));

  if (!Array.isArray(parsed.rows)) {
    throw new Error(`CLI output for ${checkName} does not include rows[].`);
  }

  return parsed.rows;
}

try {
  mkdirSync(tmpDir, { recursive: true });

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
      throw new Error(result.error.message);
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
      throw new Error(`Supabase CLI exited with status ${result.status}.`);
    }

    const rows = parseRows(stdout, check.name);

    if (!check.validate(rows)) {
      throw new Error(`Unexpected query result for ${check.name}.`);
    }
  }

  console.log('\nRLS/Auth smoke checks completed.');
} catch (error) {
  console.error(`\nSmoke check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
