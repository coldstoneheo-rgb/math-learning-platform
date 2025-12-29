'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MetaHeader, VisionFooter } from '@/components/report';
import type { User, Report, Student, AnalysisData } from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

export default function ParentReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<ReportWithStudent | null>(null);
  const [loading, setLoading] = useState(true);

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

    // 리포트 로드 (RLS가 자동으로 본인 자녀 리포트만 허용)
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

  const handlePrint = () => {
    window.print();
  };

  const analysis: AnalysisData | null = report?.analysis_data || null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!report || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
            <a href="/parent" className="text-gray-500 hover:text-gray-700">
              ← 대시보드
            </a>
            <h1 className="text-xl font-bold text-gray-900">리포트 상세</h1>
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🖨️ 인쇄 / PDF
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 학생 메타프로필 헤더 */}
        {report.students && (
          <MetaHeader
            metaProfile={report.students.meta_profile}
            studentName={report.students.name}
            studentGrade={report.students.grade}
            compact
          />
        )}

        {/* 헤더 정보 */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 mb-6 text-white print:bg-indigo-600">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{report.test_name}</h2>
              <div className="mt-2 flex items-center gap-3 text-indigo-100">
                <span className="font-medium">{report.students?.name}</span>
                <span>·</span>
                <span>{report.students && getGradeLabel(report.students.grade)}</span>
                <span>·</span>
                <span>{report.test_date}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">
                {report.total_score}
                <span className="text-lg text-indigo-200">/{report.max_score}</span>
              </div>
              {report.rank && report.total_students && (
                <div className="text-sm text-indigo-100 mt-1">
                  {report.total_students}명 중 {report.rank}등
                </div>
              )}
            </div>
          </div>
        </div>

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
                <h4 className="font-medium text-red-800 mb-2">⚠️ 보완점</h4>
                <p className="text-red-700 text-sm">{analysis.macroAnalysis.weaknesses}</p>
              </div>
            )}
          </div>

          {analysis.macroAnalysis?.errorPattern && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">🔍 주요 오류 패턴</h4>
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

        {/* 개선 전략 */}
        {analysis.actionablePrescription && analysis.actionablePrescription.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 학습 처방</h3>
            <div className="space-y-4">
              {analysis.actionablePrescription.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      item.priority === 1 ? 'bg-red-100 text-red-700' :
                      item.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority === 1 ? '🔴 긴급' : item.priority === 2 ? '🟡 중요' : '🔵 장기'}
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
                    {item.expectedEffect && (
                      <div className="md:col-span-2">
                        <span className="text-gray-500">✨ 예상 효과:</span> {item.expectedEffect}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미래 비전 및 성장 예측 - VisionFooter 컴포넌트 사용 */}
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.riskFactors && analysis.riskFactors.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 주의 사항</h3>
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

        {/* 하단 네비게이션 */}
        <div className="flex justify-center print:hidden">
          <a
            href="/parent"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            ← 대시보드로 돌아가기
          </a>
        </div>
      </main>
    </div>
  );
}
