/**
 * Student Detail API Routes (with PII encryption)
 *
 * GET   /api/students/[id]  - 학생 조회 (PII 복호화)
 * PATCH /api/students/[id]  - 학생 수정 (PII 암호화)
 * DELETE /api/students/[id] - 학생 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptStudentPII, decryptStudentPII } from '@/lib/pii-encryption';
import { studentUpdateSchema, validateRequest } from '@/lib/validations';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const studentId = parseInt(id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: '유효하지 않은 학생 ID입니다.' }, { status: 400 });
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (error || !student) {
    return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ student: decryptStudentPII(student) });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    return NextResponse.json({ error: '선생님만 학생 정보를 수정할 수 있습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const studentId = parseInt(id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: '유효하지 않은 학생 ID입니다.' }, { status: 400 });
  }

  const rawBody = await request.json();
  const validation = validateRequest(studentUpdateSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // PII 필드 암호화
  const encryptedData = encryptStudentPII(validation.data);

  const { data: student, error } = await supabase
    .from('students')
    .update(encryptedData)
    .eq('id', studentId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '학생 정보 수정 실패: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ student });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    return NextResponse.json({ error: '선생님만 학생을 삭제할 수 있습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const studentId = parseInt(id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: '유효하지 않은 학생 ID입니다.' }, { status: 400 });
  }

  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) {
    return NextResponse.json({ error: '학생 삭제 실패: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
