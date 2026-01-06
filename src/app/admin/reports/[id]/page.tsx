'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MetaHeader, VisionFooter, GrowthTrajectoryChart, ErrorPatternTrend } from '@/components/report';
import { exportReportToPdf } from '@/lib/pdf-export';
import type { User, Report, Student, AnalysisData, LevelTestAnalysis } from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

export default function ReportDetailPage() {
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

    if (!userData || userData.role !== 'teacher') {
      router.push('/');
      return;
    }

    setUser(userData);

    // 리포트 로드
    const { data: reportData, error } = await supabase
      .from('reports')
      .select(`*, students (*)`)
      .eq('id', reportId)
      .single();

    if (error || !reportData) {
      alert('리포트를 찾을 수 없습니다.');
      router.push('/admin/reports');
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

  // report.analysis_data는 다양한 리포트 타입을 지원
  const analysis = (report?.analysis_data as AnalysisData) || null;
  const levelTestAnalysis = report?.report_type === 'level_test'
    ? (report?.analysis_data as LevelTestAnalysis)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!report || (!analysis && !levelTestAnalysis)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">리포트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
    {/* 헤더 */}
    <header className="bg-white shadow-sm print:hidden">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-indigo-600 hover:text-indigo-700 font-medium">🏠 대시보드</a>
          <span className="text-gray-300">|</span>
          <a href="/admin/reports" className="text-gray-500 hover:text-gray-700">← 목록</a>
          <h1 className="text-xl font-bold text-gray-900">리포트 상세</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {exporting ? (
              <>
                <span className="animate-spin">⏳</span>
                PDF 생성 중...
              </>
            ) : (
              <>📄 PDF 저장</>
            )}
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
        {/* 학생 메타프로필 헤더 */}
        {report.students && (
          <MetaHeader
            metaProfile={report.students.meta_profile}
            studentName={report.students.name}
            studentGrade={report.students.grade}
          />
        )}

        {/* 헤더 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{report.test_name}</h2>
              <div className="mt-2 flex items-center gap-3 text-gray-600">
                <span className="font-medium">{report.students?.name}</span>
                <span>·</span>
                <span>{report.students && getGradeLabel(report.students.grade)}</span>
                <span>·</span>
                <span>{report.test_date}</span>
              </div>
            </div>
            <div className="text-right">
              {report.report_type === 'level_test' ? (
                <>
                  <div className="text-sm text-gray-500 mb-1">진단 점수</div>
                  <div className="text-4xl font-bold text-indigo-600">
                    {report.total_score ?? 0}
                    <span className="text-lg text-gray-400">/{report.max_score ?? 100}점</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    ({Math.round(((report.total_score ?? 0) / (report.max_score || 100)) * 100)}% 정답률)
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-bold text-indigo-600">
                    {report.total_score ?? '-'}
                    <span className="text-lg text-gray-400">/{report.max_score ?? '-'}</span>
                  </div>
                  {report.rank && report.total_students && (
                    <div className="text-sm text-gray-500 mt-1">
                      {report.total_students}명 중 {report.rank}등
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ===== 레벨 테스트 전용 뷰 ===== */}
        {report.report_type === 'level_test' && levelTestAnalysis && (
          <>
            {/* 학년 수준 평가 */}
            {levelTestAnalysis.gradeLevelAssessment && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 학년 수준 평가</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">현재 학년</div>
                    <div className="text-2xl font-bold text-gray-700">
                      {getGradeLabel(levelTestAnalysis.gradeLevelAssessment.currentGrade)}
                    </div>
                  </div>
                  <div className="text-3xl">→</div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">평가된 수준</div>
                    <div className={`text-2xl font-bold ${
                      levelTestAnalysis.gradeLevelAssessment.gap >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {getGradeLabel(levelTestAnalysis.gradeLevelAssessment.assessedLevel)}
                      {levelTestAnalysis.gradeLevelAssessment.gap !== 0 && (
                        <span className="text-sm ml-1">
                          ({levelTestAnalysis.gradeLevelAssessment.gap > 0 ? '+' : ''}
                          {levelTestAnalysis.gradeLevelAssessment.gap}학년)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-gray-600">{levelTestAnalysis.gradeLevelAssessment.explanation}</p>
              </div>
            )}

            {/* 영역별 진단 */}
            {levelTestAnalysis.domainDiagnosis && levelTestAnalysis.domainDiagnosis.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 영역별 진단</h3>
                <div className="space-y-3">
                  {levelTestAnalysis.domainDiagnosis.map((domain, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{domain.domain}</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-indigo-600">
                            {domain.score}/{domain.maxScore}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({domain.gradeEquivalent})
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${domain.percentile}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{domain.diagnosis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 선수학습 결손 */}
            {levelTestAnalysis.prerequisiteGaps && levelTestAnalysis.prerequisiteGaps.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 선수학습 결손</h3>
                <div className="space-y-3">
                  {levelTestAnalysis.prerequisiteGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg ${
                        gap.priority === 'critical' ? 'bg-red-50 border border-red-200' :
                        gap.priority === 'important' ? 'bg-yellow-50 border border-yellow-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          gap.priority === 'critical' ? 'bg-red-100 text-red-700' :
                          gap.priority === 'important' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {gap.priority === 'critical' ? '긴급' : gap.priority === 'important' ? '중요' : '보완'}
                        </span>
                        <span className="font-medium">{gap.concept}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        기대 수준: {gap.expectedLevel} → 실제 수준: {gap.actualLevel}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">💡 {gap.remedyPlan}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 학습 성향 */}
            {levelTestAnalysis.learningStyleDiagnosis && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 학습 성향</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`px-4 py-2 rounded-lg font-medium ${
                    levelTestAnalysis.learningStyleDiagnosis.style === 'visual' ? 'bg-purple-100 text-purple-700' :
                    levelTestAnalysis.learningStyleDiagnosis.style === 'verbal' ? 'bg-blue-100 text-blue-700' :
                    levelTestAnalysis.learningStyleDiagnosis.style === 'logical' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {levelTestAnalysis.learningStyleDiagnosis.style === 'visual' ? '👁️ 시각형' :
                     levelTestAnalysis.learningStyleDiagnosis.style === 'verbal' ? '💬 언어형' :
                     levelTestAnalysis.learningStyleDiagnosis.style === 'logical' ? '🧮 논리형' : '🔀 복합형'}
                  </div>
                  <span className="text-gray-500">
                    신뢰도: {levelTestAnalysis.learningStyleDiagnosis.confidence}%
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-700 mb-2">특성</h4>
                    <ul className="text-sm text-gray-600 list-disc list-inside">
                      {levelTestAnalysis.learningStyleDiagnosis.characteristics?.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <h4 className="font-medium text-indigo-700 mb-2">권장 학습법</h4>
                    <ul className="text-sm text-indigo-600 list-disc list-inside">
                      {levelTestAnalysis.learningStyleDiagnosis.recommendations?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 초기 Baseline */}
            {levelTestAnalysis.initialBaseline && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Baseline 설정</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">💪 강점</h4>
                    <p className="text-green-700 text-sm">{levelTestAnalysis.initialBaseline.strengths}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">⚠️ 약점</h4>
                    <p className="text-red-700 text-sm">{levelTestAnalysis.initialBaseline.weaknesses}</p>
                  </div>
                </div>
                {levelTestAnalysis.initialBaseline.errorPatterns && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">🔍 오류 패턴</h4>
                    <p className="text-yellow-700 text-sm">{levelTestAnalysis.initialBaseline.errorPatterns}</p>
                  </div>
                )}
                {levelTestAnalysis.initialBaseline.learningPotential && (
                  <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                    <h4 className="font-medium text-indigo-800 mb-2">✨ 학습 잠재력</h4>
                    <p className="text-indigo-700 text-sm">{levelTestAnalysis.initialBaseline.learningPotential}</p>
                  </div>
                )}
              </div>
            )}

            {/* 커리큘럼 제안 */}
            {levelTestAnalysis.suggestedCurriculum && levelTestAnalysis.suggestedCurriculum.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 맞춤 커리큘럼</h3>
                <div className="space-y-4">
                  {levelTestAnalysis.suggestedCurriculum.map((phase, idx) => (
                    <div key={idx} className="border-l-4 border-indigo-500 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-indigo-600">{phase.phase}</span>
                        <span className="text-sm text-gray-500">({phase.duration})</span>
                      </div>
                      <p className="text-gray-700 font-medium">{phase.focus}</p>
                      <ul className="mt-1 text-sm text-gray-600">
                        {phase.goals?.map((goal, i) => (
                          <li key={i}>• {goal}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 부모님 브리핑 */}
            {levelTestAnalysis.parentBriefing && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">👨‍👩‍👧 학부모님께 전달할 내용</h3>
                <p className="leading-relaxed">{levelTestAnalysis.parentBriefing}</p>
              </div>
            )}
          </>
        )}

        {/* ===== 일반 시험 분석 뷰 ===== */}
        {report.report_type !== 'level_test' && analysis && (
        <>
        {/* 종합 분석 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 종합 분석</h3>

          {analysis.macroAnalysis?.oneLineSummary && (
            <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
              <p className="text-indigo-800 font-medium">{analysis.macroAnalysis.oneLineSummary}</p>
            </div>
          )}

          <p className="text-gray-700 leading-relaxed mb-4">
            {analysis.macroAnalysis?.summary}
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {analysis.macroAnalysis?.strengths && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">💪 강점</h4>
                <p className="text-green-700 text-sm">{analysis.macroAnalysis.strengths}</p>
              </div>
            )}
            {analysis.macroAnalysis?.weaknesses && (
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">⚠️ 약점</h4>
                <p className="text-red-700 text-sm">{analysis.macroAnalysis.weaknesses}</p>
              </div>
            )}
          </div>

          {analysis.macroAnalysis?.errorPattern && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">🔍 오류 패턴</h4>
              <p className="text-yellow-700 text-sm">{analysis.macroAnalysis.errorPattern}</p>
            </div>
          )}
        </div>

        {/* 수학 역량 (5축) */}
        {analysis.macroAnalysis?.mathCapability && (
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
                const value = analysis.macroAnalysis?.mathCapability?.[key as keyof typeof analysis.macroAnalysis.mathCapability] || 0;
                return (
                  <div key={key} className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 오류 패턴 추이 - 학생 메타 프로필에서 가져옴 */}
        {report.students?.meta_profile?.errorSignature && (
          <ErrorPatternTrend
            primaryErrorTypes={report.students.meta_profile.errorSignature.primaryErrorTypes}
            signaturePatterns={report.students.meta_profile.errorSignature.signaturePatterns}
            domainVulnerability={report.students.meta_profile.errorSignature.domainVulnerability}
            lastUpdated={report.students.meta_profile.errorSignature.lastUpdated}
          />
        )}

        {/* 메타인지 분석 */}
        {analysis.metaCognitionAnalysis && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 메타인지 분석</h3>

            {/* 전체 점수 및 발달 단계 */}
            <div className="flex items-center justify-between mb-6 p-4 bg-purple-50 rounded-lg">
              <div>
                <div className="text-sm text-purple-600 mb-1">전체 메타인지 점수</div>
                <div className="text-3xl font-bold text-purple-700">
                  {analysis.metaCognitionAnalysis.overallScore}
                  <span className="text-lg font-normal text-purple-400">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">발달 단계</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.metaCognitionAnalysis.developmentStage === 'expert' ? 'bg-green-100 text-green-700' :
                  analysis.metaCognitionAnalysis.developmentStage === 'proficient' ? 'bg-blue-100 text-blue-700' :
                  analysis.metaCognitionAnalysis.developmentStage === 'competent' ? 'bg-indigo-100 text-indigo-700' :
                  analysis.metaCognitionAnalysis.developmentStage === 'developing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {analysis.metaCognitionAnalysis.developmentStage === 'expert' ? '전문가 수준' :
                   analysis.metaCognitionAnalysis.developmentStage === 'proficient' ? '숙달 단계' :
                   analysis.metaCognitionAnalysis.developmentStage === 'competent' ? '유능 단계' :
                   analysis.metaCognitionAnalysis.developmentStage === 'developing' ? '발달 중' :
                   '초기 단계'}
                </span>
              </div>
            </div>

            {/* 4가지 세부 영역 */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* 오답 인식 능력 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">🔍 오답 인식 능력</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {analysis.metaCognitionAnalysis.errorRecognition?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.errorRecognition?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.errorRecognition?.analysis}</p>
                {analysis.metaCognitionAnalysis.errorRecognition?.evidence &&
                 analysis.metaCognitionAnalysis.errorRecognition.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">관찰된 증거:</div>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {analysis.metaCognitionAnalysis.errorRecognition.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 전략 선택 능력 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">🎯 전략 선택 능력</span>
                  <span className="text-lg font-bold text-green-600">
                    {analysis.metaCognitionAnalysis.strategySelection?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.strategySelection?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.strategySelection?.analysis}</p>
                <div className="mt-2 flex gap-4 text-xs">
                  <span className="text-green-600">
                    최적 풀이: {analysis.metaCognitionAnalysis.strategySelection?.optimalCount ?? 0}개
                  </span>
                  <span className="text-yellow-600">
                    차선 풀이: {analysis.metaCognitionAnalysis.strategySelection?.suboptimalCount ?? 0}개
                  </span>
                </div>
              </div>

              {/* 시간 관리 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">⏱️ 시간 관리</span>
                  <span className="text-lg font-bold text-orange-600">
                    {analysis.metaCognitionAnalysis.timeManagement?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.timeManagement?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.timeManagement?.analysis}</p>
                <div className="mt-2 text-xs text-gray-500">
                  완료: {analysis.metaCognitionAnalysis.timeManagement?.completedProblems ?? 0}/{analysis.metaCognitionAnalysis.timeManagement?.totalProblems ?? 0}문제
                </div>
              </div>

              {/* 자기 점검 습관 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">✅ 자기 점검 습관</span>
                  <span className="text-lg font-bold text-purple-600">
                    {analysis.metaCognitionAnalysis.selfChecking?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.selfChecking?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.selfChecking?.analysis}</p>
                {analysis.metaCognitionAnalysis.selfChecking?.evidence &&
                 analysis.metaCognitionAnalysis.selfChecking.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">관찰된 증거:</div>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {analysis.metaCognitionAnalysis.selfChecking.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 개선 권장사항 */}
            {analysis.metaCognitionAnalysis.recommendations &&
             analysis.metaCognitionAnalysis.recommendations.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="font-medium text-blue-800 mb-2">💡 메타인지 향상 권장사항</div>
                <ul className="text-sm text-blue-700 space-y-1">
                  {analysis.metaCognitionAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 지구력 분석 */}
        {analysis.staminaAnalysis && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💪 지구력 분석</h3>

            {/* 전체 점수 및 피로도 패턴 */}
            <div className="flex items-center justify-between mb-6 p-4 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm text-green-600 mb-1">전체 지구력 점수</div>
                <div className="text-3xl font-bold text-green-700">
                  {analysis.staminaAnalysis.overallScore}
                  <span className="text-lg font-normal text-green-400">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">피로도 패턴</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.staminaAnalysis.fatiguePattern?.type === 'consistent' ? 'bg-green-100 text-green-700' :
                  analysis.staminaAnalysis.fatiguePattern?.type === 'improving' ? 'bg-blue-100 text-blue-700' :
                  analysis.staminaAnalysis.fatiguePattern?.type === 'mid-dip' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {analysis.staminaAnalysis.fatiguePattern?.type === 'consistent' ? '일관 유지' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'improving' ? '후반 향상' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'early-fatigue' ? '초반 집중형' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'mid-dip' ? '중반 슬럼프' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'late-fatigue' ? '후반 피로' :
                   '분석 중'}
                </span>
              </div>
            </div>

            {/* 피로도 패턴 설명 */}
            {analysis.staminaAnalysis.fatiguePattern?.description && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{analysis.staminaAnalysis.fatiguePattern.description}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  {analysis.staminaAnalysis.fatiguePattern.peakPerformanceRange && (
                    <span className="text-green-600">
                      🔥 최고 구간: {analysis.staminaAnalysis.fatiguePattern.peakPerformanceRange}
                    </span>
                  )}
                  {analysis.staminaAnalysis.fatiguePattern.lowPerformanceRange && (
                    <span className="text-orange-600">
                      📉 저조 구간: {analysis.staminaAnalysis.fatiguePattern.lowPerformanceRange}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 구간별 정확도 그래프 */}
            {analysis.staminaAnalysis.accuracyBySequence &&
             analysis.staminaAnalysis.accuracyBySequence.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">📊 구간별 정확도</h4>
                <div className="space-y-2">
                  {analysis.staminaAnalysis.accuracyBySequence.map((seq, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-20">{seq.range}번</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            seq.accuracy >= 80 ? 'bg-green-500' :
                            seq.accuracy >= 60 ? 'bg-yellow-500' :
                            seq.accuracy >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${seq.accuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">
                        {seq.correctCount}/{seq.totalCount} ({seq.accuracy}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 시간 배분 & 집중력 */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* 시간 배분 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">⏱️ 시간 배분 분석</h4>
                <p className="text-sm text-gray-600 mb-3">{analysis.staminaAnalysis.timeDistribution?.analysis}</p>
                {(analysis.staminaAnalysis.timeDistribution?.rushedProblems?.length ?? 0) > 0 && (
                  <div className="text-xs text-orange-600 mb-1">
                    ⚡ 급하게 푼 문제: {analysis.staminaAnalysis.timeDistribution?.rushedProblems?.join(', ')}
                  </div>
                )}
                {(analysis.staminaAnalysis.timeDistribution?.overthoughtProblems?.length ?? 0) > 0 && (
                  <div className="text-xs text-blue-600">
                    🤔 오래 고민한 문제: {analysis.staminaAnalysis.timeDistribution?.overthoughtProblems?.join(', ')}
                  </div>
                )}
              </div>

              {/* 집중력 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-700">🎯 집중력 유지</h4>
                  <span className="text-lg font-bold text-indigo-600">
                    {analysis.staminaAnalysis.focusAnalysis?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${analysis.staminaAnalysis.focusAnalysis?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.staminaAnalysis.focusAnalysis?.analysis}</p>
                {analysis.staminaAnalysis.focusAnalysis?.signs &&
                 analysis.staminaAnalysis.focusAnalysis.signs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">관찰된 징후:</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.staminaAnalysis.focusAnalysis.signs.map((sign, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {sign}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 권장사항 */}
            {analysis.staminaAnalysis.recommendations &&
             analysis.staminaAnalysis.recommendations.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="font-medium text-green-800 mb-2">💡 지구력 향상 권장사항</div>
                <ul className="text-sm text-green-700 space-y-1">
                  {analysis.staminaAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 개선 전략 */}
        {analysis.actionablePrescription && analysis.actionablePrescription.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 개선 전략</h3>
            <div className="space-y-4">
              {analysis.actionablePrescription.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      item.priority === 1 ? 'bg-red-100 text-red-700' :
                      item.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority}순위
                    </span>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {item.type}
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
                      <div className="md:col-span-2">
                        <span className="text-gray-500">📏 측정 방법:</span> {item.measurementMethod}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 성장 궤적 그래프 */}
        {(analysis.resultAnalysis?.gradeTrend || analysis.growthPredictions) && (
          <GrowthTrajectoryChart
            scoreHistory={analysis.resultAnalysis?.gradeTrend}
            predictions={analysis.growthPredictions}
            currentScore={report.total_score ?? undefined}
            targetScore={analysis.resultAnalysis?.gradeTrend && analysis.resultAnalysis.gradeTrend.length > 0
              ? Math.round(analysis.resultAnalysis.gradeTrend[analysis.resultAnalysis.gradeTrend.length - 1].score * 1.1)
              : undefined
            }
            title="성장 궤적"
          />
        )}

        {/* 미래 비전 - VisionFooter 컴포넌트 사용 */}
        {report.students && (analysis.macroAnalysis?.futureVision || analysis.growthPredictions) && (
          <VisionFooter
            legacyVision={analysis.macroAnalysis?.futureVision}
            growthPredictions={analysis.growthPredictions}
            studentName={report.students.name}
          />
        )}

        {/* 문항별 분석 */}
        {analysis.detailedAnalysis && analysis.detailedAnalysis.length > 0 && (
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
                  {analysis.detailedAnalysis.map((item, index) => (
                    <tr key={index} className={item.isCorrect === 'X' ? 'bg-red-50' : ''}>
                      <td className="px-3 py-2 font-medium">{item.problemNumber}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block w-6 h-6 rounded-full text-white font-bold leading-6 ${
                          item.isCorrect === 'O' ? 'bg-green-500' :
                          item.isCorrect === 'X' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}>
                          {item.isCorrect}
                        </span>
                      </td>
                      <td className="px-3 py-2">{item.keyConcept}</td>
                      <td className="px-3 py-2 text-gray-600">{item.errorType || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title={item.analysis}>
                        {item.analysis || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 학습 습관 & 위험 요인 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {analysis.learningHabits && analysis.learningHabits.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 학습 습관</h3>
              <div className="space-y-2">
                {analysis.learningHabits.map((habit, index) => (
                  <div key={index} className={`p-3 rounded-lg text-sm ${
                    habit.type === 'good' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <span className="mr-2">{habit.type === 'good' ? '✅' : '❌'}</span>
                    {habit.description}
                    <span className="text-xs text-gray-500 ml-2">({habit.frequency})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.riskFactors && analysis.riskFactors.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 위험 요인</h3>
              <div className="space-y-2">
                {analysis.riskFactors.map((risk, index) => (
                  <div key={index} className={`p-3 rounded-lg text-sm ${
                    risk.severity === 'high' ? 'bg-red-50' :
                    risk.severity === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                  }`}>
                    <div className="font-medium">{risk.factor}</div>
                    <div className="text-xs text-gray-600 mt-1">💡 {risk.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </main>
    </div>
  );
}
