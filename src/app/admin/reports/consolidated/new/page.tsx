'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateStudentProfileFromConsolidated } from '@/lib/student-profile-extractor';
import type { Student, User, Report, MacroAnalysis, ActionablePrescriptionItem, GrowthPrediction, ConsolidatedReportData } from '@/types';

interface ReportWithStudent extends Report {
  students: Pick<Student, 'name' | 'student_id' | 'grade'>;
}

export default function NewConsolidatedReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<ReportWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [studentReports, setStudentReports] = useState<ReportWithStudent[]>([]);

  const [macroAnalysis, setMacroAnalysis] = useState<MacroAnalysis>({
    summary: '',
    strengths: '',
    weaknesses: '',
    errorPattern: '',
  });

  const [prescriptions, setPrescriptions] = useState<ActionablePrescriptionItem[]>([
    {
      priority: 1,
      type: '개념 교정',
      title: '',
      description: '',
      whatToDo: '',
      where: '',
      howMuch: '',
      howTo: '',
      measurementMethod: '',
    },
  ]);

  const [growthPredictions, setGrowthPredictions] = useState<GrowthPrediction[]>([
    { timeframe: '1개월', predictedScore: 0, confidenceLevel: 0, assumptions: [''] },
    { timeframe: '3개월', predictedScore: 0, confidenceLevel: 0, assumptions: [''] },
    { timeframe: '6개월', predictedScore: 0, confidenceLevel: 0, assumptions: [''] },
  ]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      const filtered = reports.filter(r => r.student_id === selectedStudentId && r.report_type === 'test');
      setStudentReports(filtered);
      setSelectedReportIds([]);
    } else {
      setStudentReports([]);
      setSelectedReportIds([]);
    }
  }, [selectedStudentId, reports]);

  const checkAuthAndLoadData = async () => {
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

    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);

    const { data: reportsData } = await supabase
      .from('reports')
      .select(`*, students (name, student_id, grade)`)
      .eq('report_type', 'test')
      .order('test_date', { ascending: false });

    setReports(reportsData || []);
    setLoading(false);
  };

  const handleReportSelect = (reportId: number) => {
    setSelectedReportIds(prev => {
      if (prev.includes(reportId)) {
        return prev.filter(id => id !== reportId);
      }
      if (prev.length >= 2) {
        return [prev[1], reportId];
      }
      return [...prev, reportId];
    });
  };

  const handlePrescriptionAdd = () => {
    setPrescriptions(prev => [
      ...prev,
      {
        priority: prev.length + 1,
        type: '개념 교정',
        title: '',
        description: '',
        whatToDo: '',
        where: '',
        howMuch: '',
        howTo: '',
        measurementMethod: '',
      },
    ]);
  };

  const handlePrescriptionRemove = (index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, priority: i + 1 })));
  };

  const handlePrescriptionChange = (index: number, field: keyof ActionablePrescriptionItem, value: string | number) => {
    setPrescriptions(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleGrowthPredictionChange = (index: number, field: keyof GrowthPrediction, value: number | string[]) => {
    setGrowthPredictions(prev =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  };

  const handleSave = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    if (selectedReportIds.length < 2) {
      setError('비교할 리포트를 2개 선택해주세요.');
      return;
    }

    if (!macroAnalysis.summary.trim()) {
      setError('종합 분석 요약을 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const selectedReportsData = studentReports.filter(r => selectedReportIds.includes(r.id));
      const report1 = selectedReportsData.find(r => r.id === selectedReportIds[0]);
      const report2 = selectedReportsData.find(r => r.id === selectedReportIds[1]);

      if (!report1 || !report2) {
        throw new Error('선택된 리포트를 찾을 수 없습니다.');
      }

      const consolidatedData: ConsolidatedReportData = {
        reports: [report1, report2] as [Report, Report],
        allReportsForStudent: studentReports,
        consolidatedQualitative: {
          macroAnalysis,
          actionablePrescription: prescriptions.filter(p => p.title.trim()),
          growthPredictions: growthPredictions.filter(g => g.predictedScore > 0),
        },
      };

      const student = students.find(s => s.id === selectedStudentId);

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'consolidated',
          test_name: `${student?.name} 통합 분석 리포트`,
          test_date: new Date().toISOString().split('T')[0],
          analysis_data: consolidatedData,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 학생 프로필 자동 추출 (취약점, 강점)
      if (insertedReport?.id) {
        const profileResult = await updateStudentProfileFromConsolidated(
          selectedStudentId,
          insertedReport.id,
          consolidatedData
        );
        if (!profileResult.success) {
          console.warn('학생 프로필 업데이트 실패:', profileResult.error);
        }

        // [Anchor Loop] 메타프로필(5대 핵심 지표) 업데이트
        try {
          const metaResponse = await fetch('/api/meta-profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: selectedStudentId,
              reportId: insertedReport.id,
              analysisData: consolidatedData,
              reportType: 'consolidated',
            }),
          });

          const metaResult = await metaResponse.json();
          if (metaResult.success) {
            console.log('[Anchor Loop] 메타프로필 업데이트 완료:', metaResult.message);
          } else {
            console.warn('[Anchor Loop] 메타프로필 업데이트 실패:', metaResult.error);
          }
        } catch (metaError) {
          console.warn('[Anchor Loop] 메타프로필 API 호출 실패:', metaError);
        }
      }

      alert('통합 리포트가 저장되었습니다.');
      router.push('/admin/reports');
    } catch (err: any) {
      console.error('저장 오류:', err);
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/admin/reports/create" className="text-gray-500 hover:text-gray-700">
              ← 리포트 선택
            </a>
            <h1 className="text-xl font-bold text-gray-900">통합 리포트 작성</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* 학생 선택 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 학생 선택</h2>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(Number(e.target.value) || '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">학생을 선택하세요</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                </option>
              ))}
            </select>
          </div>

          {/* 리포트 선택 */}
          {selectedStudentId && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                2. 비교할 리포트 선택 <span className="text-sm font-normal text-gray-500">(2개 선택)</span>
              </h2>

              {studentReports.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  해당 학생의 시험 분석 리포트가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {studentReports.map((report) => (
                    <label
                      key={report.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedReportIds.includes(report.id)
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedReportIds.includes(report.id)}
                        onChange={() => handleReportSelect(report.id)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{report.test_name}</p>
                        <p className="text-sm text-gray-500">
                          {report.test_date} · {report.total_score}/{report.max_score}점
                        </p>
                      </div>
                      {selectedReportIds.includes(report.id) && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded">
                          {selectedReportIds.indexOf(report.id) === 0 ? '이전' : '이후'}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {selectedReportIds.length === 2 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>비교 대상:</strong>{' '}
                    {studentReports.find(r => r.id === selectedReportIds[0])?.test_name} →{' '}
                    {studentReports.find(r => r.id === selectedReportIds[1])?.test_name}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 통합 분석 */}
          {selectedReportIds.length === 2 && (
            <>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 통합 분석</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      종합 요약 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={macroAnalysis.summary}
                      onChange={(e) => setMacroAnalysis(prev => ({ ...prev, summary: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      rows={4}
                      placeholder="두 시험 결과를 비교한 종합적인 분석..."
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">강점</label>
                      <textarea
                        value={macroAnalysis.strengths}
                        onChange={(e) => setMacroAnalysis(prev => ({ ...prev, strengths: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                        placeholder="유지/강화된 강점..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">약점</label>
                      <textarea
                        value={macroAnalysis.weaknesses}
                        onChange={(e) => setMacroAnalysis(prev => ({ ...prev, weaknesses: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                        placeholder="개선이 필요한 약점..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">오류 패턴</label>
                    <textarea
                      value={macroAnalysis.errorPattern}
                      onChange={(e) => setMacroAnalysis(prev => ({ ...prev, errorPattern: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                      placeholder="반복되는 오류 패턴 분석..."
                    />
                  </div>
                </div>
              </div>

              {/* 처방 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">4. 개선 전략</h2>

                {prescriptions.map((prescription, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-gray-900">전략 {index + 1}</span>
                      {prescriptions.length > 1 && (
                        <button
                          onClick={() => handlePrescriptionRemove(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">유형</label>
                        <select
                          value={prescription.type}
                          onChange={(e) => handlePrescriptionChange(index, 'type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="개념 교정">개념 교정</option>
                          <option value="습관 교정">습관 교정</option>
                          <option value="전략 개선">전략 개선</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">제목</label>
                        <input
                          type="text"
                          value={prescription.title}
                          onChange={(e) => handlePrescriptionChange(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="전략 제목"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-1">설명</label>
                      <textarea
                        value={prescription.description}
                        onChange={(e) => handlePrescriptionChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                        placeholder="전략 설명"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">무엇을</label>
                        <input
                          type="text"
                          value={prescription.whatToDo}
                          onChange={(e) => handlePrescriptionChange(index, 'whatToDo', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="학습 내용"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">어디서</label>
                        <input
                          type="text"
                          value={prescription.where}
                          onChange={(e) => handlePrescriptionChange(index, 'where', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="교재/자료"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">얼마나</label>
                        <input
                          type="text"
                          value={prescription.howMuch}
                          onChange={(e) => handlePrescriptionChange(index, 'howMuch', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="분량/시간"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">어떻게</label>
                        <input
                          type="text"
                          value={prescription.howTo}
                          onChange={(e) => handlePrescriptionChange(index, 'howTo', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="학습 방법"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-1">측정 방법</label>
                      <input
                        type="text"
                        value={prescription.measurementMethod}
                        onChange={(e) => handlePrescriptionChange(index, 'measurementMethod', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="성과 측정 방법"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={handlePrescriptionAdd}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  + 전략 추가
                </button>
              </div>

              {/* 성장 예측 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">5. 성장 예측</h2>

                <div className="space-y-4">
                  {growthPredictions.map((prediction, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">{prediction.timeframe} 후</h3>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">예상 점수</label>
                          <input
                            type="number"
                            value={prediction.predictedScore || ''}
                            onChange={(e) => handleGrowthPredictionChange(index, 'predictedScore', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">신뢰도 (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={prediction.confidenceLevel || ''}
                            onChange={(e) => handleGrowthPredictionChange(index, 'confidenceLevel', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-xs text-gray-500 mb-1">전제 조건</label>
                        <input
                          type="text"
                          value={prediction.assumptions[0] || ''}
                          onChange={(e) => handleGrowthPredictionChange(index, 'assumptions', [e.target.value])}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="예: 주 3회 이상 복습 시"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '저장 중...' : '통합 리포트 저장'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
