'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MetaHeader, VisionFooter } from '@/components/report';
import { exportReportToPdf } from '@/lib/pdf-export';
import type { User, Report, Student, AnalysisData, ReportType } from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

// 리포트 타입별 설정
const REPORT_TYPE_CONFIG: Record<ReportType, { name: string; color: string; bgColor: string }> = {
  level_test: { name: '레벨 테스트', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  test: { name: '시험 분석', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  weekly: { name: '주간', color: 'text-green-600', bgColor: 'bg-green-100' },
  monthly: { name: '월간', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  semi_annual: { name: '반기', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  annual: { name: '연간', color: 'text-red-600', bgColor: 'bg-red-100' },
  consolidated: { name: '종합', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
};

export default function StudentReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<ReportWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    checkAuthAndLoadReport();
  }, [reportId]);

  const checkAuthAndLoadReport = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (!userData || userData.role !== 'student') {
      router.push('/');
      return;
    }

    setUser(userData);

    // 학생 정보 조회
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', authUser.id)
      .single();

    if (!studentData) {
      router.push('/student');
      return;
    }

    // 리포트 로드 (본인 리포트만)
    const { data: reportData, error } = await supabase
      .from('reports')
      .select(`*, students (*)`)
      .eq('id', reportId)
      .eq('student_id', studentData.id)
      .single();

    if (error || !reportData) {
      alert('리포트를 찾을 수 없거나 접근 권한이 없습니다.');
      router.push('/student');
      return;
    }

    setReport(reportData);
    setLoading(false);
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const handleExportPdf = async () => {
    if (!report) return;

    setExporting(true);
    try {
      const success = await exportReportToPdf(
        'report-content',
        report.students?.name || '학생',
        report.test_name || '리포트',
        report.test_date || new Date().toISOString().split('T')[0]
      );

      if (!success) {
        alert('PDF 내보내기에 실패했습니다.');
      }
    } catch (error) {
      console.error('PDF 내보내기 오류:', error);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">리포트 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">리포트를 찾을 수 없습니다.</p>
          <Link href="/student" className="mt-4 text-indigo-600 hover:underline">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const analysisData = report.analysis_data as AnalysisData;
  const config = REPORT_TYPE_CONFIG[report.report_type as ReportType];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/student"
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                대시보드
              </Link>
              <span className={`text-xs px-2 py-1 rounded-full ${config?.bgColor} ${config?.color}`}>
                {config?.name || report.report_type}
              </span>
            </div>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  내보내는 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF 저장
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 리포트 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div id="report-content" className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* 리포트 제목 */}
          <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{report.test_name || '리포트'}</h1>
                <p className="text-gray-600 mt-1">{report.test_date} · {report.students?.name}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full ${config?.bgColor} ${config?.color} font-medium`}>
                {config?.name || report.report_type}
              </span>
            </div>
          </div>

          {/* 메타 헤더 */}
          <MetaHeader
            studentName={report.students?.name || '학생'}
            studentGrade={report.students?.grade || 1}
            compact
          />

          {/* 분석 결과 요약 */}
          {analysisData?.macroAnalysis && (
            <div className="p-6 border-b">
              {/* 핵심 메시지 */}
              {analysisData.macroAnalysis.analysisMessage && (
                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h3 className="font-bold text-indigo-800 mb-1">핵심 메시지</h3>
                      <p className="text-indigo-700">{analysisData.macroAnalysis.analysisMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 강점 / 약점 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisData.macroAnalysis.strengths && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                      <span>💪</span> 잘하는 점
                    </h4>
                    <p className="text-green-700 text-sm">{analysisData.macroAnalysis.strengths}</p>
                  </div>
                )}
                {analysisData.macroAnalysis.weaknesses && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <span>🎯</span> 더 연습하면 좋을 점
                    </h4>
                    <p className="text-orange-700 text-sm">{analysisData.macroAnalysis.weaknesses}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 점수 정보 */}
          {report.total_score != null && (
            <div className="p-6 border-b">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-indigo-600">{report.total_score}</div>
                  <div className="text-sm text-gray-500">점수</div>
                </div>
                {report.max_score && (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-400">{report.max_score}</div>
                    <div className="text-sm text-gray-500">만점</div>
                  </div>
                )}
                {report.rank && report.total_students && (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600">{report.rank}/{report.total_students}</div>
                    <div className="text-sm text-gray-500">등수</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 개선 전략 */}
          {analysisData?.actionablePrescription && analysisData.actionablePrescription.length > 0 && (
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📝</span> 이렇게 공부해보세요!
              </h3>
              <div className="space-y-4">
                {analysisData.actionablePrescription.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        item.priority === 1 ? 'bg-red-500' : item.priority === 2 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-gray-800">{item.title}</h4>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                      {item.whatToDo && (
                        <div className="flex gap-2">
                          <span className="text-indigo-600 font-medium whitespace-nowrap">무엇을:</span>
                          <span className="text-gray-700">{item.whatToDo}</span>
                        </div>
                      )}
                      {item.howMuch && (
                        <div className="flex gap-2">
                          <span className="text-indigo-600 font-medium whitespace-nowrap">얼마나:</span>
                          <span className="text-gray-700">{item.howMuch}</span>
                        </div>
                      )}
                      {item.howTo && (
                        <div className="flex gap-2">
                          <span className="text-indigo-600 font-medium whitespace-nowrap">어떻게:</span>
                          <span className="text-gray-700">{item.howTo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 미래 비전 */}
          {analysisData?.macroAnalysis?.futureVision && (
            <VisionFooter
              legacyVision={analysisData.macroAnalysis.futureVision}
              studentName={report.students?.name || '학생'}
            />
          )}

          {/* 응원 메시지 */}
          <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-center">
            <div className="text-4xl mb-4">🌟</div>
            <h3 className="text-xl font-bold mb-2">화이팅!</h3>
            <p className="text-indigo-100">
              {analysisData?.macroAnalysis?.futureVision?.encouragement || '꾸준히 노력하면 분명 좋은 결과가 있을 거예요!'}
            </p>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-500 text-sm print:hidden">
        <p>&copy; {new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.</p>
      </footer>
    </div>
  );
}
