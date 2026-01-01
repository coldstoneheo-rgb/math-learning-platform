import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service Role 클라이언트 (RLS 우회)
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 1. users 테이블에서 삭제
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('User table delete error:', userError);
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      );
    }

    // 2. auth.users에서도 삭제 (Supabase Admin API)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth delete error:', authError);
      // users 테이블에서는 이미 삭제됨, 경고만 로그
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
