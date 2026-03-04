import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service Role 클라이언트 (RLS 우회, 세션 독립)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const { email, name, password } = await request.json();

    if (!email || !name || !password) {
      return NextResponse.json({ error: '이메일, 이름, 비밀번호는 필수입니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Auth 사용자 생성 (서버 사이드 - 현재 세션 영향 없음)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 인증 없이 즉시 활성화
    });

    if (authError) {
      console.error('[create-parent] Auth error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: '사용자 생성에 실패했습니다.' }, { status: 500 });
    }

    // 2. users 테이블에 프로필 레코드 생성
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role: 'parent',
      })
      .select()
      .single();

    if (userError) {
      console.error('[create-parent] DB error:', userError);
      // Auth 사용자 롤백
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error('[create-parent] API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
