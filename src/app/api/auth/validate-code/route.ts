import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

    if (!connectionCode || connectionCode.trim() === '') {
      return NextResponse.json(
        { isValid: false, error: '연결 코드가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, user_id, name')
      .eq('connection_code', connectionCode.trim())
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { isValid: false, error: '유효하지 않은 연결 코드입니다. 확인 후 다시 입력해주세요.' },
        { status: 400 }
      );
    }

    if (student.user_id) {
      return NextResponse.json(
        { isValid: false, error: '이미 다른 계정에 연결된 코드입니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ isValid: true, studentName: student.name });
  } catch (error) {
    console.error('API error in validate-code:', error);
    return NextResponse.json(
      { isValid: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
