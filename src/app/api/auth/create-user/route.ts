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
    const { userId, email, name, role } = await request.json();

    // 필수 파라미터 검증
    if (!userId || !email || !name || !role) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // role 검증
    if (!['teacher', 'parent', 'student'].includes(role)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // users 테이블에 upsert (이미 있으면 업데이트, 없으면 생성)
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email,
          name,
          role,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('User creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
