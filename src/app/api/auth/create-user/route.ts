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

type StudentLinkTarget = {
  id: number;
  user_id: string | null;
  name: string;
};

export async function POST(request: Request) {
  try {
    const { userId, email, name, role, connectionCode } = await request.json();
    const normalizedConnectionCode = typeof connectionCode === 'string'
      ? connectionCode.trim()
      : '';

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

    // 학생 계정이고 연결 코드가 입력된 경우 사전 검증
    let studentToLink: StudentLinkTarget | null = null;
    if (role === 'student' && normalizedConnectionCode) {
      const { data: existingLinkedStudent, error: existingLinkedStudentError } = await supabase
        .from('students')
        .select('id, name')
        .eq('user_id', userId)
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

      const { data: student, error: studentError } = await supabase
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

      studentToLink = student;
    }

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

    // 검증된 학생 레코드가 있다면 user_id 연결
    if (studentToLink) {
      const { error: updateError } = await supabase
        .from('students')
        .update({ user_id: userId })
        .eq('id', studentToLink.id)
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
          { error: '유저 프로필은 생성되었으나 학생 연결에 실패했습니다. 대시보드에서 다시 연결해주세요.' },
          { status: 500 }
        );
      }
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
