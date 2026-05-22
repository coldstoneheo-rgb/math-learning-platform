import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

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
    const { connectionCode } = await request.json();
    const normalizedConnectionCode = typeof connectionCode === 'string'
      ? connectionCode.trim()
      : '';

    if (!normalizedConnectionCode) {
      return NextResponse.json(
        { error: '연결 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 1. 로그인된 사용자 가져오기
    const userSupabase = await createServerSupabase();
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 2. 해당 사용자의 역할이 'student'인지 확인
    const { data: userData } = await userSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'student') {
      return NextResponse.json(
        { error: '학생 계정만 사용할 수 있는 기능입니다.' },
        { status: 403 }
      );
    }

    // 3. connection_code로 학생 검색
    const serviceSupabase = createServiceClient();

    const { data: existingLinkedStudent, error: existingLinkedStudentError } = await serviceSupabase
      .from('students')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLinkedStudentError) {
      console.error('Failed to check existing student link:', existingLinkedStudentError);
      return NextResponse.json(
        { error: '학생 계정 연결 상태를 확인하지 못했습니다.' },
        { status: 500 }
      );
    }

    if (existingLinkedStudent) {
      return NextResponse.json(
        {
          error: '이미 학생 프로필에 연결된 계정입니다.',
          studentName: existingLinkedStudent.name,
        },
        { status: 409 }
      );
    }

    const { data: student, error: studentError } = await serviceSupabase
      .from('students')
      .select('id, user_id, name')
      .eq('connection_code', normalizedConnectionCode)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: '유효하지 않은 연결 코드입니다. 확인 후 다시 입력해주세요.' },
        { status: 400 }
      );
    }

    if (student.user_id) {
      return NextResponse.json(
        { error: '이미 다른 계정에 연결된 코드입니다.' },
        { status: 409 }
      );
    }

    // 4. 학생 레코드에 user_id 할당
    const { error: updateError } = await serviceSupabase
      .from('students')
      .update({ user_id: user.id })
      .eq('id', student.id)
      .is('user_id', null)
      .select('id')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: '이미 다른 계정에 연결된 코드입니다.' },
          { status: 409 }
        );
      }

      console.error('Failed to link student:', updateError);
      return NextResponse.json(
        { error: '학생 계정 연결에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, studentName: student.name });
  } catch (error) {
    console.error('Connect API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
