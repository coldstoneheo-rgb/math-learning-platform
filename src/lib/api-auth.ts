import { NextResponse } from 'next/server';
import type { UserRole } from '@/types';

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  from: (table: string) => unknown;
};

type UserRoleQuery = {
  select: (columns: string) => {
    eq: (column: string, value: unknown) => {
      single: () => Promise<{ data: { role?: UserRole } | null; error: unknown }>;
    };
  };
};

type AuthorizedUser = {
  id: string;
  role: UserRole;
};

type AuthResult =
  | { ok: true; user: AuthorizedUser }
  | { ok: false; response: NextResponse };

export async function requireRoles(
  supabase: SupabaseLike,
  allowedRoles: UserRole[]
): Promise<AuthResult> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const usersTable = supabase.from('users') as UserRoleQuery;
  const { data: userData, error: userError } = await usersTable
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role;
  if (userError || !role || !allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, role } };
}

export function requireTeacherOrSuperAdmin(supabase: SupabaseLike): Promise<AuthResult> {
  return requireRoles(supabase, ['teacher', 'super_admin']);
}
