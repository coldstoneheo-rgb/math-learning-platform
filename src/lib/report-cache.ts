/**
 * Server-side report data caching using Next.js unstable_cache
 *
 * 리포트 상세 데이터를 1시간 캐싱하여 DB 조회 최소화
 * 리포트 저장/수정 시 revalidateTag('reports') 호출 필요
 *
 * 사용: 서버 컴포넌트 또는 API Routes에서만 사용 가능
 */

import { unstable_cache, revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Report, Student } from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

/**
 * 리포트 상세 조회 (1시간 캐시)
 */
export const getCachedReport = unstable_cache(
  async (reportId: string): Promise<ReportWithStudent | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('reports')
      .select('*, students(*)')
      .eq('id', reportId)
      .single();

    if (error) return null;
    return data as ReportWithStudent;
  },
  ['report-detail'],
  { revalidate: 3600 }
);

/**
 * 학생의 리포트 목록 조회 (30분 캐시)
 */
export const getCachedStudentReports = unstable_cache(
  async (studentId: number): Promise<Report[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('reports')
      .select('id, report_type, test_name, test_date, total_score, max_score, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data ?? []) as Report[];
  },
  ['student-reports'],
  { revalidate: 1800 }
);

/**
 * 전체 리포트 목록 (교사용, 5분 캐시)
 */
export const getCachedAllReports = unstable_cache(
  async (): Promise<(Report & { students: Pick<Student, 'id' | 'name' | 'student_id' | 'grade'> })[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('reports')
      .select('id, report_type, test_name, test_date, total_score, max_score, created_at, students(id, name, student_id, grade)')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data ?? []) as unknown as (Report & { students: Pick<Student, 'id' | 'name' | 'student_id' | 'grade'> })[];
  },
  ['all-reports'],
  { revalidate: 300 }
);

/**
 * 리포트 캐시 무효화
 * 리포트 생성/수정/삭제 후 호출
 */
export function invalidateReportCache(): void {
  revalidatePath('/teacher/reports', 'layout');
  revalidatePath('/parent', 'layout');
}
