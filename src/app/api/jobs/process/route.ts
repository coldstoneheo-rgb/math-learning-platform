/**
 * Background Job Processor
 * Gemini API 분석을 비동기로 처리
 *
 * POST /api/jobs/process
 * Authorization: Bearer <JOB_PROCESSOR_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingJob, updateJobStatus } from '@/lib/analysis-queue';
import { analyzeTestPaperWithContext, GeminiApiError, GeminiParseError } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import type { ReportType, TestAnalysisFormData } from '@/types';

export const maxDuration = 300; // 5분 타임아웃 (Vercel Pro)

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 처리기 인증 (서버-to-서버)
  const secret = process.env.JOB_PROCESSOR_SECRET;
  if (secret) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const requestedJobId = body?.jobId as string | undefined;

  const job = await getPendingJob();
  if (!job) {
    return NextResponse.json({ message: '처리할 작업이 없습니다.', processed: 0 });
  }

  // 특정 jobId가 지정된 경우 일치 확인
  if (requestedJobId && job.id !== requestedJobId) {
    return NextResponse.json({ message: '요청된 작업을 찾을 수 없습니다.', processed: 0 });
  }

  // 처리 중으로 표시
  await updateJobStatus(job.id, 'processing');

  try {
    const formData = job.form_data;
    const studentName = (formData.studentName as string) || '학생';
    const reportType = job.report_type as ReportType;

    // 컨텍스트 빌드
    let context = undefined;
    if (job.student_id) {
      try {
        const typedFormData = formData as Partial<TestAnalysisFormData>;
        const queryText = [
          typedFormData.testName,
          typedFormData.testRange,
          typedFormData.teacherComments?.additionalNote,
        ].filter(Boolean).join(' ');
        context = await buildAnalysisContext(job.student_id, reportType, {
          queryText: queryText || undefined,
        });
      } catch {
        // 컨텍스트 빌드 실패 시 무시하고 진행
      }
    }

    const result = await analyzeTestPaperWithContext(
      studentName,
      formData as unknown as TestAnalysisFormData,
      job.images,
      [],
      reportType,
      context
    );

    await updateJobStatus(job.id, 'completed', result);
    return NextResponse.json({ message: '분석 완료', processed: 1, jobId: job.id });

  } catch (error) {
    const errorMessage =
      error instanceof GeminiApiError || error instanceof GeminiParseError
        ? error.message
        : '분석 중 알 수 없는 오류가 발생했습니다.';

    await updateJobStatus(job.id, 'failed', undefined, errorMessage);
    console.error('[JobProcessor] 분석 실패:', error);

    return NextResponse.json(
      { message: '분석 실패', processed: 0, jobId: job.id, error: errorMessage },
      { status: 500 }
    );
  }
}
