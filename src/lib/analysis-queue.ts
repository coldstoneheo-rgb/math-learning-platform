/**
 * Analysis Queue - Graceful Degradation for Gemini API
 *
 * Vercel Functions의 10초 제한 및 Gemini API 타임아웃 대응:
 * - 분석 요청을 Supabase analysis_jobs 테이블에 큐잉
 * - 즉시 jobId 반환 → 사용자는 폴링으로 상태 확인
 * - 백그라운드 처리: /api/jobs/process 엔드포인트 호출
 *
 * DB 마이그레이션 (Supabase에서 실행):
 * ```sql
 * CREATE TABLE analysis_jobs (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   student_id INTEGER REFERENCES students(id),
 *   form_data JSONB NOT NULL,
 *   images JSONB NOT NULL,           -- base64 이미지 배열
 *   report_type TEXT NOT NULL DEFAULT 'test',
 *   status TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|completed|failed
 *   result JSONB,
 *   error TEXT,
 *   created_by UUID REFERENCES auth.users(id),
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   started_at TIMESTAMPTZ,
 *   completed_at TIMESTAMPTZ
 * );
 * CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status, created_at);
 * CREATE INDEX idx_analysis_jobs_student ON analysis_jobs(student_id);
 * ```
 */

import { createClient } from '@/lib/supabase/server';
import type { AnalysisData, ReportType } from '@/types';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AnalysisJob {
  id: string;
  student_id: number;
  form_data: Record<string, unknown>;
  images: string[];
  report_type: ReportType;
  status: JobStatus;
  result?: AnalysisData;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface QueueResult {
  success: true;
  jobId: string;
  message: string;
}

export interface QueueError {
  success: false;
  error: string;
}

/**
 * 분석 요청을 큐에 등록 (즉시 jobId 반환)
 */
export async function enqueueAnalysis(
  studentId: number,
  formData: Record<string, unknown>,
  images: string[],
  reportType: ReportType = 'test',
  userId?: string
): Promise<QueueResult | QueueError> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('analysis_jobs')
    .insert({
      student_id: studentId,
      form_data: formData,
      images: images,
      report_type: reportType,
      status: 'pending',
      created_by: userId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[AnalysisQueue] 큐 등록 실패:', error);
    return { success: false, error: '분석 큐 등록에 실패했습니다.' };
  }

  // 백그라운드 처리 트리거 (fire-and-forget)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (appUrl) {
    const processUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    fetch(`${processUrl}/api/jobs/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.JOB_PROCESSOR_SECRET || ''}`,
      },
      body: JSON.stringify({ jobId: data.id }),
    }).catch((err) => console.warn('[AnalysisQueue] 처리 트리거 실패 (무시 가능):', err));
  }

  return {
    success: true,
    jobId: data.id,
    message: '분석이 대기열에 등록되었습니다. 잠시 후 결과를 확인해주세요.',
  };
}

/**
 * 분석 작업 상태 조회
 */
export async function getJobStatus(jobId: string): Promise<AnalysisJob | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('analysis_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('[AnalysisQueue] 작업 조회 실패:', error);
    return null;
  }

  return data as AnalysisJob;
}

/**
 * 완료된 분석 결과 가져오기
 * 완료 전이면 null 반환
 */
export async function getJobResult(jobId: string): Promise<AnalysisData | null> {
  const job = await getJobStatus(jobId);
  if (!job || job.status !== 'completed' || !job.result) return null;
  return job.result;
}

/**
 * 대기 중인 작업 가져오기 (처리기에서 사용)
 */
export async function getPendingJob(): Promise<AnalysisJob | null> {
  const supabase = await createClient();

  // 처리 중인 채로 30분 이상 경과한 작업은 재처리 대상으로 간주
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('analysis_jobs')
    .select('*')
    .or(`status.eq.pending,and(status.eq.processing,started_at.lt.${staleThreshold})`)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as AnalysisJob;
}

/**
 * 작업 상태 업데이트
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  result?: AnalysisData,
  errorMessage?: string
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { status };
  if (status === 'processing') updates.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();
  if (result) updates.result = result;
  if (errorMessage) updates.error = errorMessage;

  await supabase
    .from('analysis_jobs')
    .update(updates)
    .eq('id', jobId);
}

/**
 * 오래된 완료/실패 작업 정리 (7일 이상)
 */
export async function cleanupOldJobs(): Promise<void> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('analysis_jobs')
    .delete()
    .in('status', ['completed', 'failed'])
    .lt('created_at', cutoff);
}
