'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import type { Student } from '@/types';

interface EmbeddingStats {
  studentId: number;
  studentName: string;
  totalReports: number;
  indexedReports: number;
  failedReports: number;
  lastIndexedAt: string | null;
  lastAttemptedAt: string | null;
  lastError: string | null;
}

export default function EmbeddingsAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmbeddingStats[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [backfilling, setBackfilling] = useState<number | null>(null);
  const [queryTest, setQueryTest] = useState('');
  const [queryStudentId, setQueryStudentId] = useState('');
  const [queryResults, setQueryResults] = useState<{
    text: string; sourceType: string; reportType: string;
    testDate: string | null; similarity: number;
  }[]>([]);
  const [queryDiagnostics, setQueryDiagnostics] = useState<{
    memoryCount: number;
    contextPreviewRequested: boolean;
    ragPromptInjected?: boolean;
    contextPromptExcerpt?: string;
  } | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!userData || !['teacher', 'super_admin'].includes(userData.role)) { router.push('/'); return; }

    const { data: studentList } = await supabase.from('students').select('*').order('name');
    setStudents(studentList ?? []);
    await loadStats(studentList ?? []);
    setLoading(false);
  };

  const loadStats = async (studentList: Student[]) => {
    const supabase = createClient();

    const reportCounts = await supabase
      .from('reports')
      .select('student_id', { count: 'exact' });

    const embedCounts = await supabase
      .from('report_embeddings')
      .select('student_id, report_id, created_at');

    const statusCounts = await supabase
      .from('embedding_index_status')
      .select('student_id, status, last_error, last_attempted_at, updated_at');

    const embedData = embedCounts.data ?? [];
    const statusData = statusCounts.data ?? [];

    const statsMap: Record<number, EmbeddingStats> = {};
    for (const s of studentList) {
      const totalReports = (reportCounts.data ?? []).filter(
        (r: { student_id: number }) => r.student_id === s.id
      ).length;
      const studentEmbeds = embedData.filter(
        (e: { student_id: number }) => e.student_id === s.id
      );
      const uniqueReports = new Set(studentEmbeds.map((e: { report_id: number }) => e.report_id)).size;
      const lastAt = studentEmbeds.reduce(
        (max: string | null, e: { created_at: string }) =>
          !max || e.created_at > max ? e.created_at : max,
        null
      );
      const studentStatuses = statusData.filter(
        (row: { student_id: number }) => row.student_id === s.id
      );
      const failedReports = studentStatuses.filter(
        (row: { status: string }) => row.status === 'failed'
      ).length;
      const latestStatus = studentStatuses.reduce(
        (
          latest: { last_attempted_at: string | null; last_error: string | null } | null,
          row: { last_attempted_at: string | null; last_error: string | null }
        ) => {
          if (!latest) return row;
          if (!row.last_attempted_at) return latest;
          if (!latest.last_attempted_at || row.last_attempted_at > latest.last_attempted_at) return row;
          return latest;
        },
        null
      );
      statsMap[s.id] = {
        studentId: s.id,
        studentName: s.name,
        totalReports,
        indexedReports: uniqueReports,
        failedReports,
        lastIndexedAt: lastAt,
        lastAttemptedAt: latestStatus?.last_attempted_at ?? null,
        lastError: latestStatus?.last_error ?? null,
      };
    }

    setStats(Object.values(statsMap).sort((a, b) => a.studentName.localeCompare(b.studentName)));
  };

  const handleBackfill = async (studentId?: number) => {
    setBackfilling(studentId ?? -1);
    try {
      const res = await fetch('/api/embeddings/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentId ? { studentId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        addToast(`인덱싱 완료: ${data.processed}건 처리`, 'success');
        await loadStats(students);
      } else {
        addToast(data.error ?? '인덱싱 실패', 'error');
      }
    } catch {
      addToast('네트워크 오류', 'error');
    } finally {
      setBackfilling(null);
    }
  };

  const handleQueryTest = async () => {
    if (!queryTest.trim() || !queryStudentId) {
      addToast('쿼리 텍스트와 학생을 선택해주세요.', 'error');
      return;
    }
    setQueryLoading(true);
    setHasQueried(false);
    setQueryResults([]);
    setQueryDiagnostics(null);
    try {
      const res = await fetch('/api/embeddings/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: queryTest,
          studentId: Number(queryStudentId),
          includeContextPreview: true,
        }),
      });
      const data = await res.json();
      if (data.memories) {
        setQueryResults(data.memories);
        setQueryDiagnostics(data.diagnostics ?? null);
        setHasQueried(true);
      } else {
        addToast(data.error ?? '검색 실패', 'error');
      }
    } catch {
      addToast('네트워크 오류', 'error');
    } finally {
      setQueryLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const totalIndexed = stats.reduce((s, r) => s + r.indexedReports, 0);
  const totalReports = stats.reduce((s, r) => s + r.totalReports, 0);
  const totalFailed = stats.reduce((s, r) => s + r.failedReports, 0);
  const hasIndexedMemories = totalIndexed > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} onRemove={removeToast} />

      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <a href="/teacher" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
          <h1 className="text-xl font-bold text-gray-900">🧠 RAG 기억 서랍 관리</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* 개요 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-indigo-600">{totalIndexed}</div>
            <div className="text-sm text-gray-500 mt-1">인덱싱된 리포트</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-gray-700">{totalReports}</div>
            <div className="text-sm text-gray-500 mt-1">전체 리포트</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-green-600">
              {totalReports > 0 ? Math.round((totalIndexed / totalReports) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-500 mt-1">인덱싱 완료율</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className={`text-3xl font-bold ${totalFailed > 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {totalFailed}
            </div>
            <div className="text-sm text-gray-500 mt-1">최근 실패</div>
          </div>
        </div>

        <div className={`rounded-lg border p-4 text-sm ${
          hasIndexedMemories
            ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
            : totalReports > 0
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-slate-200 bg-white text-slate-700'
        }`}>
          <div className="font-semibold">
            {hasIndexedMemories
              ? 'RAG 기억 서랍은 분석 컨텍스트에 주입될 준비가 되어 있습니다.'
              : totalReports > 0
                ? '인덱싱된 기억이 없어 현재 검색과 프롬프트 주입 결과가 비어 있습니다.'
                : '저장된 리포트가 생기면 RAG 기억 서랍을 준비할 수 있습니다.'}
          </div>
          <p className="mt-1 leading-relaxed">
            시험 분석처럼 학생 ID와 검색 쿼리가 있는 분석 경로에서는 유사한 과거 기억을 찾고,
            검색 결과가 있으면 AI 프롬프트의 과거 기억 서랍 섹션에 참고 자료로 넣습니다.
            현재 시험 이미지와 교사 확정값이 우선이며, RAG는 반복 패턴과 성장 맥락을 보강하는 참고 근거입니다.
          </p>
          {!hasIndexedMemories && totalReports > 0 && (
            <p className="mt-2">
              전체 Backfill 또는 학생별 Backfill을 먼저 실행한 뒤 검색 테스트로 프롬프트 주입 여부를 확인하세요.
            </p>
          )}
        </div>

        {/* 전체 Backfill */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">전체 Backfill</h2>
              <p className="text-sm text-gray-500 mt-1">
                임베딩이 없는 리포트를 일괄 인덱싱합니다 (최대 50건).
              </p>
            </div>
            <button
              onClick={() => handleBackfill()}
              disabled={backfilling !== null}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {backfilling === -1 ? '⏳ 처리 중...' : '🔄 전체 Backfill'}
            </button>
          </div>
        </div>

        {/* 학생별 상태 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="font-bold text-gray-900">학생별 인덱싱 현황</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs text-gray-500">
              <tr>
                <th className="text-left px-6 py-3">학생</th>
                <th className="text-center px-4 py-3">인덱싱</th>
                <th className="text-center px-4 py-3">전체</th>
                <th className="text-center px-4 py-3">커버리지</th>
                <th className="text-left px-4 py-3">상태</th>
                <th className="text-right px-6 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.map((s) => {
                const coverage = s.totalReports > 0
                  ? Math.round((s.indexedReports / s.totalReports) * 100)
                  : 0;
                return (
                  <tr key={s.studentId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{s.studentName}</td>
                    <td className="px-4 py-3 text-center text-indigo-600 font-bold">{s.indexedReports}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{s.totalReports}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        coverage === 100 ? 'bg-green-100 text-green-700' :
                        coverage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {coverage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      {s.failedReports > 0 ? (
                        <div>
                          <div className="text-xs font-semibold text-red-600">
                            실패 {s.failedReports}건
                          </div>
                          {s.lastError && (
                            <div className="text-xs text-gray-500 truncate max-w-[180px]" title={s.lastError}>
                              {s.lastError}
                            </div>
                          )}
                        </div>
                      ) : s.lastAttemptedAt ? (
                        <div className="text-xs text-gray-500">
                          마지막 시도 {new Date(s.lastAttemptedAt).toLocaleDateString('ko-KR')}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">기록 없음</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {(s.indexedReports < s.totalReports || s.failedReports > 0) && (
                        <button
                          onClick={() => handleBackfill(s.studentId)}
                          disabled={backfilling !== null}
                          className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {backfilling === s.studentId ? '...' : 'Backfill'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 검색 테스트 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">🔍 기억 검색 테스트</h2>
          <div className="space-y-3">
            <select
              value={queryStudentId}
              onChange={(e) => setQueryStudentId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-white text-sm"
            >
              <option value="">학생 선택</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryTest}
                onChange={(e) => setQueryTest(e.target.value)}
                placeholder="예: 일차방정식 이항 중간고사"
                className="flex-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleQueryTest()}
              />
              <button
                onClick={handleQueryTest}
                disabled={queryLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {queryLoading ? '...' : '검색'}
              </button>
            </div>
          </div>

          {queryResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500">{queryResults.length}개 결과</p>
              {queryResults.map((r, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">{r.sourceType}</span>
                    <span>{r.reportType}</span>
                    {r.testDate && <span>{r.testDate}</span>}
                    <span className="ml-auto font-semibold text-green-600">
                      유사도 {Math.round(r.similarity * 100)}%
                    </span>
                  </div>
                  <p className="text-gray-700">{r.text}</p>
                </div>
              ))}
            </div>
          )}

          {queryDiagnostics && (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold">분석 프롬프트 주입 검증</div>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${
                  queryDiagnostics.ragPromptInjected
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {queryDiagnostics.ragPromptInjected ? '주입 확인' : '주입 미확인'}
                </span>
              </div>
              <p className="mt-1 leading-relaxed">
                검색된 RAG 기억 {queryDiagnostics.memoryCount}건
                {queryDiagnostics.ragPromptInjected
                  ? '이 분석 컨텍스트 미리보기의 과거 기억 서랍 섹션에 포함되었습니다.'
                  : '입니다. 검색 결과가 없거나 미리보기 컨텍스트에 포함할 기억이 없어 과거 기억 서랍 섹션이 생성되지 않았습니다.'}
              </p>
              <p className="mt-1 leading-relaxed text-indigo-800">
                실제 분석에서도 RAG는 현재 시험 증거를 대체하지 않고, 과거 반복 패턴과 성장 흐름을 판단하는 보조 기억으로만 사용됩니다.
              </p>
              {queryDiagnostics.contextPromptExcerpt && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700">
                  {queryDiagnostics.contextPromptExcerpt}
                </pre>
              )}
            </div>
          )}

          {queryResults.length === 0 && !queryLoading && hasQueried && (
            <p className="mt-3 text-sm text-gray-400 text-center">
              검색 결과가 없습니다. 임베딩 인덱싱 여부를 확인해주세요.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
