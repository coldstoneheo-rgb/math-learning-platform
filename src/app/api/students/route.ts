/**
 * Students API Routes (with PII encryption)
 *
 * GET  /api/students        - 학생 목록 (PII 복호화)
 * POST /api/students        - 학생 생성 (PII 암호화)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptStudentPII, decryptStudentList } from '@/lib/pii-encryption';
import { studentCreateSchema, validateRequest } from '@/lib/validations';
import { applyRateLimitAsync } from '@/lib/rate-limiter';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'teacher') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: '학생 목록 조회 실패' }, { status: 500 });
  }

  // PII 복호화 후 반환
  const decrypted = decryptStudentList(students ?? []);
  return NextResponse.json({ students: decrypted });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit
  const rateLimitResult = await applyRateLimitAsync(request, 'STANDARD');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: '요청 한도를 초과했습니다.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'teacher') {
    return NextResponse.json({ error: '선생님만 학생을 등록할 수 있습니다.' }, { status: 403 });
  }

  const rawBody = await request.json();
  const validation = validateRequest(studentCreateSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // PII 필드 암호화
  const encryptedData = encryptStudentPII(validation.data);

  const { data: student, error } = await supabase
    .from('students')
    .insert(encryptedData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '학생 등록 실패: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ student }, { status: 201 });
}
