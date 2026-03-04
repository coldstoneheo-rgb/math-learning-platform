'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MetaHeader, VisionFooter } from '@/components/report';
import { exportReportToPdf } from '@/lib/pdf-export';
import type {
  User, Report, Student, AnalysisData,
  LevelTestAnalysis, WeeklyReportAnalysis, MonthlyReportAnalysis,
  SemiAnnualReportAnalysis, AnnualReportAnalysis,
} from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  level_test: '레벨 테스트',
  test: '시험 분석',
  weekly: '주간 리포트',
  monthly: '월간 리포트',
  semi_annual: '반기 리포트',
  annual: '연간 리포트',
  consolidated: '통합 분석',
};

const REPORT_TYPE_COLORS: Record<string, string> = {
  level_test: 'from-emerald-500 to-teal-600',
  test: 'from-indigo-500 to-purple-600',
  weekly: 'from-blue-500 to-cyan-600',
  monthly: 'from-violet-500 to-purple-600',
  semi_annual: 'from-orange-500 to-amber-600',
  annual: 'from-rose-500 to-pink-600',
  consolidated: 'from-gray-500 to-slate-600',
};

export default function ParentReportDetailPage() {
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

    if (!userData || userData.role !== 'parent') {
      router.push('/');
      return;
    }

    setUser(userData);

    const { data: reportData, error } = await supabase
      .from('reports')
      .select(`*, students (*)`)
      .eq('id', reportId)
      .single();

    if (error || !reportData) {
      alert('리포트를 찾을 수 없거나 접근 권한이 없습니다.');
      router.push('/parent');
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
      if (!success) alert('PDF 내보내기에 실패했습니다.');
    } catch {
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">리포트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const reportType = report.report_type;
  const gradientColor = REPORT_TYPE_COLORS[reportType] || REPORT_TYPE_COLORS.test;
  const typeLabel = REPORT_TYPE_LABELS[reportType] || '리포트';

  // 타입별 분석 데이터 캐스팅
  const testAnalysis = (reportType === 'test' || reportType === 'consolidated') ? report.analysis_data as AnalysisData : null;
  const levelTestAnalysis = reportType === 'level_test' ? report.analysis_data as LevelTestAnalysis : null;
  const weeklyAnalysis = reportType === 'weekly' ? report.analysis_data as WeeklyReportAnalysis : null;
  const monthlyAnalysis = reportType === 'monthly' ? report.analysis_data as MonthlyReportAnalysis : null;
  const semiAnnualAnalysis = reportType === 'semi_annual' ? report.analysis_data as SemiAnnualReportAnalysis : null;
  const annualAnalysis = reportType === 'annual' ? report.analysis_data as AnnualReportAnalysis : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm print:hidden">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/parent" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
            <h1 className="text-xl font-bold text-gray-900">{typeLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {exporting ? <><span className="animate-spin">⏳</span>PDF 생성 중...</> : <>📄 PDF 저장</>}
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              🖨️ 인쇄
            </button>
          </div>
        </div>
      </header>

      <main id="report-content" className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 메타프로필 헤더 */}
        {report.students && (
          <MetaHeader
            metaProfile={report.students.meta_profile}
            studentName={report.students.name}
            studentGrade={report.students.grade}
            compact
          />
        )}

        {/* 공통 헤더 배너 */}
        <div className={`bg-gradient-to-r ${gradientColor} rounded-xl shadow-lg p-6 mb-6 text-white`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-sm font-medium opacity-80">{typeLabel}</span>
              <h2 className="text-2xl font-bold mt-1">{report.test_name || typeLabel}</h2>
              <div className="mt-2 flex items-center gap-3 text-white/80">
                <span className="font-medium">{report.students?.name}</span>
                <span>·</span>
                <span>{report.students && getGradeLabel(report.students.grade)}</span>
                {report.test_date && <><span>·</span><span>{report.test_date}</span></>}
              </div>
            </div>
            {report.total_score != null && report.max_score && (
              <div className="text-right">
                <div className="text-4xl font-bold">{report.total_score}<span className="text-lg opacity-70">/{report.max_score}</span></div>
                {report.rank && report.total_students && (
                  <div className="text-sm opacity-80 mt-1">{report.total_students}명 중 {report.rank}등</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== 시험 분석 리포트 ===== */}
        {testAnalysis && (
          <>
            {/* 종합 분석 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 종합 분석</h3>
              {testAnalysis.macroAnalysis?.oneLineSummary && (
                <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
                  <p className="text-indigo-800 font-medium">{testAnalysis.macroAnalysis.oneLineSummary}</p>
                </div>
              )}
              <p className="text-gray-700 leading-relaxed mb-4">{testAnalysis.macroAnalysis?.summary}</p>
              <div className="grid md:grid-cols-2 gap-4">
                {testAnalysis.macroAnalysis?.strengths && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">💪 강점</h4>
                    <p className="text-green-700 text-sm">{testAnalysis.macroAnalysis.strengths}</p>
                  </div>
                )}
                {testAnalysis.macroAnalysis?.weaknesses && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">⚠️ 보완점</h4>
                    <p className="text-red-700 text-sm">{testAnalysis.macroAnalysis.weaknesses}</p>
                  </div>
                )}
              </div>
              {testAnalysis.macroAnalysis?.errorPattern && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">🔍 주요 오류 패턴</h4>
                  <p className="text-yellow-700 text-sm">{testAnalysis.macroAnalysis.errorPattern}</p>
                </div>
              )}
            </div>

            {/* 수학 역량 */}
            {testAnalysis.macroAnalysis?.mathCapability && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 수학 역량</h3>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { key: 'calculationSpeed', label: '계산 속도' },
                    { key: 'calculationAccuracy', label: '계산 정확도' },
                    { key: 'applicationAbility', label: '응용력' },
                    { key: 'logic', label: '논리력' },
                    { key: 'anxietyControl', label: '불안 통제' },
                  ].map(({ key, label }) => {
                    const value = testAnalysis.macroAnalysis?.mathCapability?.[key as keyof typeof testAnalysis.macroAnalysis.mathCapability] || 0;
                    return (
                      <div key={key} className="text-center">
                        <div className="text-2xl font-bold text-indigo-600">{value}</div>
                        <div className="text-xs text-gray-500 mt-1">{label}</div>
                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${value}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 학습 처방 */}
            {testAnalysis.actionablePrescription && testAnalysis.actionablePrescription.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 학습 처방</h3>
                <div className="space-y-4">
                  {testAnalysis.actionablePrescription.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          item.priority === 1 ? 'bg-red-100 text-red-700' :
                          item.priority === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.priority === 1 ? '🔴 긴급' : item.priority === 2 ? '🟡 중요' : '🔵 장기'}
                        </span>
                        <span className="font-semibold text-gray-900">{item.title}</span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                      <div className="grid md:grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
                        <div><span className="text-gray-500">📚 무엇을:</span> {item.whatToDo}</div>
                        <div><span className="text-gray-500">📍 어디서:</span> {item.where}</div>
                        <div><span className="text-gray-500">⏱️ 얼마나:</span> {item.howMuch}</div>
                        <div><span className="text-gray-500">💡 어떻게:</span> {item.howTo}</div>
                        {item.measurementMethod && (
                          <div className="md:col-span-2"><span className="text-gray-500">📏 측정 방법:</span> {item.measurementMethod}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 문항별 분석 */}
            {testAnalysis.detailedAnalysis && testAnalysis.detailedAnalysis.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 문항별 분석</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">번호</th>
                        <th className="px-3 py-2 text-center">정오</th>
                        <th className="px-3 py-2 text-left">핵심 개념</th>
                        <th className="px-3 py-2 text-left">오류 유형</th>
                        <th className="px-3 py-2 text-left">분석</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {testAnalysis.detailedAnalysis.map((item, index) => (
                        <tr key={index} className={item.isCorrect === 'X' ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2 font-medium">{item.problemNumber}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block w-6 h-6 rounded-full text-white font-bold leading-6 text-xs ${
                              item.isCorrect === 'O' ? 'bg-green-500' : item.isCorrect === 'X' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}>{item.isCorrect}</span>
                          </td>
                          <td className="px-3 py-2">{item.keyConcept}</td>
                          <td className="px-3 py-2 text-gray-600">{item.errorType || '-'}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{item.analysis || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 학습 습관 & 위험 요인 */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {testAnalysis.learningHabits && testAnalysis.learningHabits.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 학습 습관</h3>
                  <div className="space-y-2">
                    {testAnalysis.learningHabits.map((habit, index) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${habit.type === 'good' ? 'bg-green-50' : 'bg-red-50'}`}>
                        <span className="mr-2">{habit.type === 'good' ? '✅' : '❌'}</span>
                        {habit.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {testAnalysis.riskFactors && testAnalysis.riskFactors.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 주의 사항</h3>
                  <div className="space-y-2">
                    {testAnalysis.riskFactors.map((risk, index) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${
                        risk.severity === 'high' ? 'bg-red-50' : risk.severity === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                      }`}>
                        <div className="font-medium">{risk.factor}</div>
                        <div className="text-xs text-gray-600 mt-1">💡 {risk.recommendation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 미래 비전 */}
            {report.students && (testAnalysis.macroAnalysis?.futureVision || testAnalysis.growthPredictions) && (
              <VisionFooter
                legacyVision={testAnalysis.macroAnalysis?.futureVision}
                growthPredictions={testAnalysis.growthPredictions}
                studentName={report.students.name}
              />
            )}
          </>
        )}

        {/* ===== 레벨 테스트 리포트 ===== */}
        {levelTestAnalysis && (
          <>
            {/* 진단 요약 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 진단 결과 요약</h3>
              {levelTestAnalysis.overallAssessment && (
                <div className="mb-4 p-4 bg-emerald-50 rounded-lg">
                  <p className="text-emerald-800 font-medium">{levelTestAnalysis.overallAssessment}</p>
                </div>
              )}
              {levelTestAnalysis.gradeLevelAssessment && (
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-sm text-blue-600">현재 학년</div>
                    <div className="text-xl font-bold text-blue-700">{levelTestAnalysis.gradeLevelAssessment.actualGrade || '-'}</div>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg text-center">
                    <div className="text-sm text-indigo-600">실력 수준</div>
                    <div className="text-xl font-bold text-indigo-700">{levelTestAnalysis.gradeLevelAssessment.levelLabel || '-'}</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg text-center">
                    <div className="text-sm text-purple-600">학습 유형</div>
                    <div className="text-xl font-bold text-purple-700">{levelTestAnalysis.learningStyle || '-'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* 영역별 진단 */}
            {levelTestAnalysis.domainAssessments && levelTestAnalysis.domainAssessments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 영역별 수준</h3>
                <div className="space-y-3">
                  {levelTestAnalysis.domainAssessments.map((domain, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-gray-700 shrink-0">{domain.domain}</div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${(domain.score / (domain.maxScore || 100)) * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium text-gray-700 w-16 text-right">{domain.score}/{domain.maxScore || 100}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 강점 & 개선 영역 */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {levelTestAnalysis.strengths && levelTestAnalysis.strengths.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">💪 잘하는 것</h3>
                  <ul className="space-y-2">
                    {levelTestAnalysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {levelTestAnalysis.weaknesses && levelTestAnalysis.weaknesses.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 보완할 것</h3>
                  <ul className="space-y-2">
                    {levelTestAnalysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-orange-500 mt-0.5">→</span>
                        <span className="text-gray-700">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 맞춤 커리큘럼 */}
            {levelTestAnalysis.recommendedCurriculum && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">📅 맞춤 학습 로드맵</h3>
                <p className="text-emerald-100 text-sm leading-relaxed">{levelTestAnalysis.recommendedCurriculum}</p>
              </div>
            )}
          </>
        )}

        {/* ===== 주간 리포트 ===== */}
        {weeklyAnalysis && (
          <>
            {/* 주간 요약 통계 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 이번 주 요약</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-blue-600">수업 횟수</div>
                  <div className="text-2xl font-bold text-blue-700">{weeklyAnalysis.classSessions?.length || 0}회</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-600">숙제 완료율</div>
                  <div className="text-2xl font-bold text-green-700">{weeklyAnalysis.assignmentCompletion?.rate || 0}%</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-purple-600">연속성 점수</div>
                  <div className="text-2xl font-bold text-purple-700">{weeklyAnalysis.microLoopFeedback?.continuityScore || 0}</div>
                </div>
              </div>
            </div>

            {/* 학습 내용 평가 */}
            {weeklyAnalysis.learningContent && weeklyAnalysis.learningContent.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 이번 주 학습 내용</h3>
                <div className="space-y-2">
                  {weeklyAnalysis.learningContent.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${
                      item.evaluation === 'excellent' ? 'bg-green-50' :
                      item.evaluation === 'good' ? 'bg-blue-50' : 'bg-orange-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          item.evaluation === 'excellent' ? 'bg-green-200 text-green-700' :
                          item.evaluation === 'good' ? 'bg-blue-200 text-blue-700' : 'bg-orange-200 text-orange-700'
                        }`}>
                          {item.evaluation === 'excellent' ? '우수' : item.evaluation === 'good' ? '양호' : '보완 필요'}
                        </span>
                        <span className="font-medium text-sm">{item.topic}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 성취 & 개선점 */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {weeklyAnalysis.weeklyAchievements && weeklyAnalysis.weeklyAchievements.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 이번 주 성취</h3>
                  <ul className="space-y-2">
                    {weeklyAnalysis.weeklyAchievements.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><span className="text-green-500">✓</span><span>{a}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {weeklyAnalysis.areasForImprovement && weeklyAnalysis.areasForImprovement.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📌 다음 주 집중 포인트</h3>
                  <ul className="space-y-2">
                    {weeklyAnalysis.areasForImprovement.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><span className="text-orange-500">→</span><span>{a}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 다음 주 계획 */}
            {weeklyAnalysis.nextWeekPlan && (
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">📌 다음 주 계획</h3>
                <p className="text-blue-100 mb-3"><span className="font-medium">핵심 목표:</span> {weeklyAnalysis.nextWeekPlan.focus}</p>
                {weeklyAnalysis.nextWeekPlan.goals && (
                  <ul className="space-y-1">
                    {weeklyAnalysis.nextWeekPlan.goals.map((g, i) => (
                      <li key={i} className="text-sm text-blue-50">• {g}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 격려 메시지 */}
            {weeklyAnalysis.encouragement && (
              <div className="bg-yellow-50 rounded-xl p-6 mb-6 border border-yellow-200">
                <p className="text-yellow-800">💪 {weeklyAnalysis.encouragement}</p>
              </div>
            )}
          </>
        )}

        {/* ===== 월간 리포트 ===== */}
        {monthlyAnalysis && (
          <>
            {/* 월간 요약 통계 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 월간 요약</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-indigo-600">총 수업</div>
                  <div className="text-2xl font-bold text-indigo-700">{monthlyAnalysis.classSessionsSummary?.totalClasses || 0}회</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-blue-600">총 수업시간</div>
                  <div className="text-2xl font-bold text-blue-700">{monthlyAnalysis.classSessionsSummary?.totalHours || 0}h</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-600">평균 이해도</div>
                  <div className="text-2xl font-bold text-green-700">{monthlyAnalysis.classSessionsSummary?.averageUnderstanding?.toFixed(1) || '-'}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-purple-600">숙제 완료율</div>
                  <div className="text-2xl font-bold text-purple-700">{monthlyAnalysis.assignmentSummary?.completionRate || 0}%</div>
                </div>
              </div>
            </div>

            {/* 학부모 보고 섹션 (핵심) */}
            {monthlyAnalysis.parentReport && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👨‍👩‍👧 학부모 보고</h3>
                {monthlyAnalysis.parentReport.highlights && monthlyAnalysis.parentReport.highlights.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-green-700 mb-2">✨ 이번 달 하이라이트</h4>
                    <ul className="space-y-1">
                      {monthlyAnalysis.parentReport.highlights.map((h, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-green-500">•</span>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {monthlyAnalysis.parentReport.concerns && monthlyAnalysis.parentReport.concerns.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-orange-700 mb-2">⚠️ 주의가 필요한 부분</h4>
                    <ul className="space-y-1">
                      {monthlyAnalysis.parentReport.concerns.map((c, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-orange-500">•</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {monthlyAnalysis.parentReport.recommendations && monthlyAnalysis.parentReport.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-700 mb-2">💡 권장사항</h4>
                    <ul className="space-y-1">
                      {monthlyAnalysis.parentReport.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-blue-500">→</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 성취 & 과제 */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {monthlyAnalysis.monthlyAchievements && monthlyAnalysis.monthlyAchievements.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 이달의 성취</h3>
                  <ul className="space-y-2">
                    {monthlyAnalysis.monthlyAchievements.map((a, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-green-500">✓</span>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {monthlyAnalysis.newChallenges && monthlyAnalysis.newChallenges.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 새로운 도전 과제</h3>
                  <ul className="space-y-2">
                    {monthlyAnalysis.newChallenges.map((c, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-orange-500">→</span>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 다음 달 계획 */}
            {monthlyAnalysis.nextMonthPlan && (
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">📅 다음 달 계획</h3>
                {monthlyAnalysis.nextMonthPlan.mainGoals && (
                  <ul className="space-y-1 mb-3">
                    {monthlyAnalysis.nextMonthPlan.mainGoals.map((g, i) => (
                      <li key={i} className="text-sm text-violet-100">• {g}</li>
                    ))}
                  </ul>
                )}
                {monthlyAnalysis.nextMonthPlan.expectedCoverage && (
                  <p className="text-violet-100 text-sm">📚 예정 범위: {monthlyAnalysis.nextMonthPlan.expectedCoverage}</p>
                )}
              </div>
            )}

            {/* 선생님 메시지 */}
            {monthlyAnalysis.teacherMessage && (
              <div className="bg-indigo-50 rounded-xl p-6 mb-6 border border-indigo-200">
                <h3 className="font-semibold text-indigo-900 mb-2">💬 선생님 메시지</h3>
                <p className="text-indigo-800 text-sm leading-relaxed">{monthlyAnalysis.teacherMessage}</p>
              </div>
            )}
          </>
        )}

        {/* ===== 반기 리포트 ===== */}
        {semiAnnualAnalysis && (
          <>
            {/* 반기 통계 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {semiAnnualAnalysis.halfYear} 요약</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: '총 수업', value: `${semiAnnualAnalysis.periodSummary?.totalClasses || 0}회` },
                  { label: '총 시간', value: `${semiAnnualAnalysis.periodSummary?.totalHours || 0}h` },
                  { label: '총 시험', value: `${semiAnnualAnalysis.periodSummary?.totalTests || 0}회` },
                  { label: '평균 점수', value: `${semiAnnualAnalysis.periodSummary?.averageScore || 0}점` },
                  { label: '점수 향상', value: `+${semiAnnualAnalysis.periodSummary?.scoreImprovement || 0}점` },
                ].map((stat, i) => (
                  <div key={i} className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-orange-600">{stat.label}</div>
                    <div className="text-xl font-bold text-orange-700">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 학부모 종합 보고 */}
            {semiAnnualAnalysis.parentComprehensiveReport && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👨‍👩‍👧 학부모 종합 보고</h3>
                {semiAnnualAnalysis.parentComprehensiveReport.executiveSummary && (
                  <div className="mb-4 p-4 bg-orange-50 rounded-lg">
                    <p className="text-orange-800 font-medium">{semiAnnualAnalysis.parentComprehensiveReport.executiveSummary}</p>
                  </div>
                )}
                {semiAnnualAnalysis.parentComprehensiveReport.detailedAnalysis && (
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">{semiAnnualAnalysis.parentComprehensiveReport.detailedAnalysis}</p>
                )}
                {semiAnnualAnalysis.parentComprehensiveReport.investmentReturn && (
                  <div className="p-4 bg-green-50 rounded-lg mb-4">
                    <h4 className="font-medium text-green-800 mb-1">📈 학습 투자 효과</h4>
                    <p className="text-green-700 text-sm">{semiAnnualAnalysis.parentComprehensiveReport.investmentReturn}</p>
                  </div>
                )}
                {semiAnnualAnalysis.parentComprehensiveReport.recommendations && semiAnnualAnalysis.parentComprehensiveReport.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-700 mb-2">💡 권장사항</h4>
                    <ul className="space-y-1">
                      {semiAnnualAnalysis.parentComprehensiveReport.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-blue-500">→</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 취약점 해결 현황 */}
            {semiAnnualAnalysis.weaknessReview && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 취약점 해결 현황</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">취약점 해결률</span>
                    <span className="font-bold text-orange-600">{semiAnnualAnalysis.weaknessReview.resolutionRate || 0}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${semiAnnualAnalysis.weaknessReview.resolutionRate || 0}%` }} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {semiAnnualAnalysis.weaknessReview.resolved && semiAnnualAnalysis.weaknessReview.resolved.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-700 mb-2">✅ 해결됨</h4>
                      <ul className="space-y-1">{semiAnnualAnalysis.weaknessReview.resolved.map((w, i) => <li key={i} className="text-xs text-gray-600">• {w}</li>)}</ul>
                    </div>
                  )}
                  {semiAnnualAnalysis.weaknessReview.persistent && semiAnnualAnalysis.weaknessReview.persistent.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-2">⚠️ 지속 중</h4>
                      <ul className="space-y-1">{semiAnnualAnalysis.weaknessReview.persistent.map((w, i) => <li key={i} className="text-xs text-gray-600">• {w}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 다음 반기 전략 */}
            {semiAnnualAnalysis.nextHalfStrategy && (
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">🎯 다음 반기 목표</h3>
                <p className="text-orange-100 text-sm mb-3">목표 점수: <span className="font-bold text-white">{semiAnnualAnalysis.nextHalfStrategy.targetScore}점</span></p>
                {semiAnnualAnalysis.nextHalfStrategy.primaryGoals && (
                  <ul className="space-y-1">
                    {semiAnnualAnalysis.nextHalfStrategy.primaryGoals.map((g, i) => (
                      <li key={i} className="text-sm text-orange-50">• {g}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 선생님 평가 */}
            {semiAnnualAnalysis.teacherAssessment && (
              <div className="bg-indigo-50 rounded-xl p-6 mb-6 border border-indigo-200">
                <h3 className="font-semibold text-indigo-900 mb-2">💬 선생님 종합 평가</h3>
                <p className="text-indigo-800 text-sm leading-relaxed">{semiAnnualAnalysis.teacherAssessment}</p>
              </div>
            )}
          </>
        )}

        {/* ===== 연간 리포트 ===== */}
        {annualAnalysis && (
          <>
            {/* 연간 통계 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {annualAnalysis.year}년 연간 요약</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '총 수업', value: `${annualAnalysis.annualStatistics?.totalClasses || 0}회` },
                  { label: '총 시험', value: `${annualAnalysis.annualStatistics?.totalTests || 0}회` },
                  { label: '평균 점수', value: `${annualAnalysis.annualStatistics?.averageScore || 0}점` },
                  { label: '점수 향상', value: `+${annualAnalysis.annualStatistics?.scoreImprovement || 0}점` },
                ].map((stat, i) => (
                  <div key={i} className="bg-rose-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-rose-600">{stat.label}</div>
                    <div className="text-xl font-bold text-rose-700">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 성장 스토리 */}
            {annualAnalysis.growthStory?.narrativeSummary && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📖 1년 성장 스토리</h3>
                <div className="p-4 bg-rose-50 rounded-lg">
                  <p className="text-rose-800 leading-relaxed">{annualAnalysis.growthStory.narrativeSummary}</p>
                </div>
                {annualAnalysis.growthStory.majorMilestones && annualAnalysis.growthStory.majorMilestones.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-3">🏁 주요 성장 마일스톤</h4>
                    <div className="space-y-3">
                      {annualAnalysis.growthStory.majorMilestones.map((m, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-xs text-gray-500 w-20 shrink-0 mt-0.5">{m.date}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{m.milestone}</div>
                            <div className="text-xs text-gray-500">{m.significance}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 학부모 연간 보고 */}
            {annualAnalysis.parentAnnualReport && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👨‍👩‍👧 학부모 연간 보고</h3>
                {annualAnalysis.parentAnnualReport.executiveSummary && (
                  <div className="mb-4 p-4 bg-rose-50 rounded-lg">
                    <p className="text-rose-800 font-medium">{annualAnalysis.parentAnnualReport.executiveSummary}</p>
                  </div>
                )}
                {annualAnalysis.parentAnnualReport.highlights && annualAnalysis.parentAnnualReport.highlights.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-green-700 mb-2">✨ 올해의 하이라이트</h4>
                    <ul className="space-y-1">
                      {annualAnalysis.parentAnnualReport.highlights.map((h, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-green-500">•</span>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {annualAnalysis.parentAnnualReport.recommendations && annualAnalysis.parentAnnualReport.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-700 mb-2">💡 내년을 위한 권장사항</h4>
                    <ul className="space-y-1">
                      {annualAnalysis.parentAnnualReport.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-blue-500">→</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 성장 내러티브 & 다음 해 준비 */}
            {annualAnalysis.nextYearPreparation && (
              <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">🚀 내년 준비</h3>
                {annualAnalysis.nextYearPreparation.primaryObjectives && (
                  <ul className="space-y-1 mb-3">
                    {annualAnalysis.nextYearPreparation.primaryObjectives.map((o, i) => (
                      <li key={i} className="text-sm text-rose-100">• {o}</li>
                    ))}
                  </ul>
                )}
                {annualAnalysis.nextYearPreparation.recommendedApproach && (
                  <p className="text-rose-100 text-sm mt-2">{annualAnalysis.nextYearPreparation.recommendedApproach}</p>
                )}
              </div>
            )}
          </>
        )}

        {/* 하단 네비게이션 */}
        <div className="flex justify-center print:hidden">
          <a href="/parent" className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            ← 대시보드로 돌아가기
          </a>
        </div>
      </main>
    </div>
  );
}
