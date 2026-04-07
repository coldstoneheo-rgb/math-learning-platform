'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { registerReportFeedbackData } from '@/lib/feedback-loop';
import MultiFileUpload, { UploadedFile } from '@/components/common/MultiFileUpload';
import type { Student, User, LevelTestAnalysis, StudentMetaProfile, AnalysisData } from '@/types';

export default function NewLevelTestPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [testDate, setTestDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState({
    previousExperience: '',
    parentExpectations: '',
  });

  const [analysisResult, setAnalysisResult] = useState<LevelTestAnalysis | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

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

    // 학생 목록 로드 (Baseline 미설정 학생 우선 표시)
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);
    setLoading(false);
  };

  // 업로드된 이미지에서 base64 추출 (시험 분석과 동일한 형식)
  const getImageBase64List = (): string[] => {
    return uploadedFiles
      .filter(f => f.type === 'image')
      .map(f => {
        // data:image/jpeg;base64,xxxx 형식에서 base64 부분만 추출
        return f.data.split(',')[1] || f.data;
      });
  };

  // 분석 가능한 이미지가 있는지 확인
  const hasAnalyzableImages = (): boolean => {
    return uploadedFiles.some(f => f.type === 'image');
  };

  const handleAnalyze = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    if (!hasAnalyzableImages()) {
      setError('테스트 이미지를 업로드해주세요. (PDF는 이미지로 변환 후 업로드)');
      return;
    }

    setAnalyzing(true);

    try {
      const testImages = getImageBase64List();
      const response = await fetch('/api/level-test/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          testImages: testImages,  // base64 이미지 배열 (시험 분석과 동일)
          additionalInfo: {
            previousExperience: additionalInfo.previousExperience || undefined,
            parentExpectations: additionalInfo.parentExpectations || undefined,
          },
        }),
      });

      // 응답이 JSON인지 먼저 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON response:', textResponse);
        if (response.status === 504) {
          throw new Error('분석 시간이 초과되었습니다. 파일 크기를 줄여 다시 시도해주세요.');
        }
        throw new Error(`서버 오류가 발생했습니다. (${response.status})`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `서버 오류 (${response.status})`);
      }

      if (result.success && result.analysis) {
        setAnalysisResult(result.analysis);
      } else {
        setError(result.error || 'AI 분석에 실패했습니다.');
      }
    } catch (err) {
      console.error('분석 오류:', err);
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!analysisResult || !selectedStudentId) return;

    setSaving(true);
    setError('');

    try {
      const supabase = createClient();
      const student = students.find(s => s.id === selectedStudentId);

      // 1. 리포트 저장
      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'level_test',
          test_name: `${student?.name} 레벨 테스트`,
          test_date: testDate,  // 선택한 날짜 사용
          total_score: analysisResult.testResults?.totalScore || 0,
          max_score: analysisResult.testResults?.maxScore || 100,
          analysis_data: analysisResult,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 2. [Anchor Loop] 메타프로필 Baseline 설정
      if (insertedReport?.id) {
        try {
          const now = new Date().toISOString();
          const testDateISO = new Date(testDate).toISOString();

          // Baseline 데이터 구성 (TypeScript Baseline 타입에 맞게)
          const baseline = {
            assessmentDate: testDateISO,  // 선택한 테스트 날짜 사용
            levelTestReportId: insertedReport.id,
            initialLevel: {
              grade: analysisResult.gradeLevelAssessment?.assessedLevel || student?.grade || 7,
              percentile: analysisResult.domainDiagnosis?.reduce((sum, d) => sum + (d.percentile || 0), 0) /
                         (analysisResult.domainDiagnosis?.length || 1) || 50,
              evaluatedAt: testDateISO,  // 선택한 테스트 날짜 사용
            },
            domainScores: analysisResult.domainDiagnosis?.map(d => ({
              domain: d.domain,
              score: d.score,
              maxScore: d.maxScore,
              percentile: d.percentile,
            })) || [],
            initialStrengths: analysisResult.initialBaseline?.strengths
              ? [analysisResult.initialBaseline.strengths]
              : [],
            initialWeaknesses: analysisResult.initialBaseline?.weaknesses
              ? [analysisResult.initialBaseline.weaknesses]
              : [],
            initialLearningStyle: analysisResult.learningStyleDiagnosis?.style || 'mixed',
          };

          // 직접 학생의 meta_profile 업데이트 (Baseline 설정)
          // detailedErrorPatterns를 primaryErrorTypes 형식으로 변환
          const primaryErrorTypes = (analysisResult.initialBaseline?.detailedErrorPatterns || []).map(ep => ({
            type: ep.type,
            frequency: ep.frequency,
            recentTrend: 'stable' as const, // 초기값은 stable
          }));

          // 오답이 있는지 점수로 판단
          const scorePercent = analysisResult.testResults?.totalScore && analysisResult.testResults?.maxScore
            ? (analysisResult.testResults.totalScore / analysisResult.testResults.maxScore) * 100
            : 100;
          const hasErrors = scorePercent < 100;

          const newMetaProfile: Partial<StudentMetaProfile> = {
            baseline,
            errorSignature: {
              primaryErrorTypes: primaryErrorTypes.length > 0 ? primaryErrorTypes : [
                // AI가 패턴을 못 찾았으면 점수 기반으로 추론
                ...(hasErrors ? [{
                  type: '기타/부주의' as const,
                  frequency: Math.round(100 - scorePercent),
                  recentTrend: 'stable' as const,
                }] : [])
              ],
              signaturePatterns: [
                ...(analysisResult.initialBaseline?.errorPatterns ? [analysisResult.initialBaseline.errorPatterns] : []),
                ...(analysisResult.initialBaseline?.detailedErrorPatterns?.map(ep => ep.description) || []),
              ].filter(Boolean),
              domainVulnerability: analysisResult.domainDiagnosis?.map(d => ({
                domain: d.domain,
                vulnerabilityScore: 100 - (d.percentile || 50),
                lastAssessed: now,
              })) || [],
              lastUpdated: now,
            },
            absorptionRate: {
              overallScore: 50, // 초기값
              byDomain: [],
              learningType: analysisResult.learningStyleDiagnosis?.style === 'visual' ? 'fast-starter' :
                           analysisResult.learningStyleDiagnosis?.style === 'logical' ? 'slow-but-deep' : 'steady-grower',
              optimalConditions: analysisResult.learningStyleDiagnosis?.recommendations || [],
              recentTrend: [],
              lastUpdated: now,
            },
            solvingStamina: {
              overallScore: 50, // 초기값
              optimalDuration: 60,
              accuracyBySequence: [],
              fatiguePattern: 'consistent',
              recoveryStrategies: [],
              lastUpdated: now,
            },
            metaCognitionLevel: {
              overallScore: 50, // 초기값
              subScores: {
                selfAssessmentAccuracy: 50,
                errorRecognition: 50,
                strategySelection: 50,
                timeManagement: 50,
              },
              developmentStage: 'developing',
              improvementAreas: [],
              lastUpdated: now,
            },
            lastUpdated: now,
            version: '1.0',
          };

          const { error: updateError } = await supabase
            .from('students')
            .update({ meta_profile: newMetaProfile })
            .eq('id', selectedStudentId);

          if (updateError) {
            console.warn('[Level Test] Meta profile update failed:', updateError);
          } else {
            console.log('[Level Test] Baseline set successfully');
          }

          // 메타프로필 API 호출 (추가 업데이트)
          await fetch('/api/meta-profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: selectedStudentId,
              reportId: insertedReport.id,
              analysisData: analysisResult,
              reportType: 'level_test',
            }),
          });

          // [Feedback Loop] 전략 추적 및 예측 데이터 등록
          try {
            const feedbackResult = await registerReportFeedbackData(
              insertedReport.id,
              selectedStudentId,
              analysisResult as unknown as AnalysisData
            );
            console.log('[Feedback Loop] 등록 결과:', feedbackResult);
          } catch (feedbackError) {
            console.warn('[Feedback Loop] 등록 실패:', feedbackError);
          }
        } catch (metaError) {
          console.warn('[Level Test] Meta profile API error:', metaError);
        }
      }

      alert('레벨 테스트 리포트가 저장되었습니다. Baseline이 설정되었습니다.');
      router.push('/admin/reports');
    } catch (err: unknown) {
      console.error('저장 오류:', err);
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const hasBaseline = (student: Student): boolean => {
    const profile = student.meta_profile as StudentMetaProfile | null;
    return !!profile?.baseline?.assessmentDate;
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

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
            <Link href="/admin/reports/create" className="text-gray-500 hover:text-gray-700">
              ← 리포트 선택
            </Link>
            <h1 className="text-xl font-bold text-gray-900">레벨 테스트 (Baseline 설정)</h1>
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
          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-2">📋 레벨 테스트란?</h3>
            <p className="text-blue-700 text-sm">
              신규 학생의 현재 수학 실력을 진단하고 <strong>Baseline(기준점)</strong>을 설정하는 테스트입니다.
              이 데이터는 향후 모든 리포트의 성장 비교 기준으로 사용됩니다.
            </p>
            <ul className="text-blue-600 text-sm mt-2 list-disc list-inside">
              <li>영역별 수준 진단 (연산, 방정식, 도형, 확률통계 등)</li>
              <li>학년 수준 평가 및 선수학습 결손 분석</li>
              <li>학습 성향 진단 (시각형/언어형/논리형)</li>
              <li>맞춤 커리큘럼 제안</li>
            </ul>
          </div>

          {/* 학생 선택 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 학생 선택</h2>

            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(Number(e.target.value) || '');
                setAnalysisResult(null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">학생을 선택하세요</option>
              <optgroup label="⭐ Baseline 미설정 (권장)">
                {students.filter(s => !hasBaseline(s)).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                  </option>
                ))}
              </optgroup>
              <optgroup label="✅ Baseline 설정됨 (재측정)">
                {students.filter(s => hasBaseline(s)).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                  </option>
                ))}
              </optgroup>
            </select>

            {selectedStudent && hasBaseline(selectedStudent) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ 이 학생은 이미 Baseline이 설정되어 있습니다. 재측정 시 기존 Baseline이 업데이트됩니다.
              </div>
            )}
          </div>

          {/* 테스트 날짜 선택 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              2. 테스트 날짜 <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              레벨 테스트를 실시한 날짜를 선택하세요. 과거 날짜도 선택 가능합니다.
            </p>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 추가 정보 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 추가 정보 (선택)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이전 학습 경험
                </label>
                <textarea
                  value={additionalInfo.previousExperience}
                  onChange={(e) => setAdditionalInfo(prev => ({
                    ...prev,
                    previousExperience: e.target.value
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="예: 초등학교 때 학원 2년 수강, 중1 1학기까지 선행..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학부모 기대 사항
                </label>
                <textarea
                  value={additionalInfo.parentExpectations}
                  onChange={(e) => setAdditionalInfo(prev => ({
                    ...prev,
                    parentExpectations: e.target.value
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="예: 기초 개념 확립, 내신 대비, 수학 흥미 유발..."
                />
              </div>
            </div>
          </div>

          {/* 테스트 파일 업로드 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              4. 테스트 파일 업로드 <span className="text-red-500">*</span>
            </h2>

            <MultiFileUpload
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              acceptedTypes={['image', 'pdf']}
              maxFiles={20}
              maxSizeMB={10}
              label="레벨 테스트 답안지"
              helpText="이미지(JPG, PNG) 또는 PDF 파일을 드래그하거나 클릭하여 업로드하세요. 이미지는 자동 압축됩니다."
              required
            />
          </div>

          {/* 분석 버튼 */}
          {!analysisResult && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !selectedStudentId || !hasAnalyzableImages()}
              className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  AI 분석 중... (약 30초 소요)
                </>
              ) : (
                <>
                  <span>🤖</span>
                  레벨 테스트 AI 분석 시작
                </>
              )}
            </button>
          )}

          {/* 분석 결과 */}
          {analysisResult && (
            <div className="space-y-6">
              {/* 분석 완료 헤더 */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h3 className="font-semibold text-green-800">AI 분석 완료</h3>
                    <p className="text-sm text-green-600">아래 결과를 확인 후 저장 버튼을 눌러주세요.</p>
                  </div>
                </div>
              </div>

              {/* 테스트 점수 요약 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 테스트 점수</h3>
                <div className="flex items-center justify-between">
                  <div>
                    {(() => {
                      const totalScore = analysisResult.testResults?.totalScore ?? 0;
                      const maxScore = analysisResult.testResults?.maxScore || 100;
                      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
                      return (
                        <>
                          <div className="text-4xl font-bold text-indigo-600">
                            {totalScore}
                            <span className="text-xl text-gray-400">/{maxScore}점</span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            정답률 {percentage}%
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    테스트 일자: {testDate}
                  </div>
                </div>
              </div>

              {/* 오류 패턴 분석 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 파악된 오류 패턴</h3>

                {analysisResult.initialBaseline?.detailedErrorPatterns && analysisResult.initialBaseline.detailedErrorPatterns.length > 0 ? (
                  <div className="space-y-3">
                    {analysisResult.initialBaseline.detailedErrorPatterns.map((pattern, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            pattern.type === '개념 오류' ? 'bg-red-100 text-red-700' :
                            pattern.type === '절차 오류' ? 'bg-yellow-100 text-yellow-700' :
                            pattern.type === '계산 오류' ? 'bg-blue-100 text-blue-700' :
                            pattern.type === '문제 오독' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {pattern.type}
                          </span>
                          <span className="text-gray-700">{pattern.description}</span>
                        </div>
                        <span className="text-sm font-medium text-orange-600">{pattern.frequency}%</span>
                      </div>
                    ))}
                  </div>
                ) : analysisResult.initialBaseline?.errorPatterns ? (
                  <p className="text-gray-600 p-3 bg-gray-50 rounded-lg">
                    {analysisResult.initialBaseline.errorPatterns}
                  </p>
                ) : (
                  <p className="text-gray-400 p-3 bg-gray-50 rounded-lg italic">
                    오답이 없거나 오류 패턴이 감지되지 않았습니다.
                  </p>
                )}
              </div>

              {/* 초기 진단 요약 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 초기 진단 요약 (Baseline)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-700 mb-2">💪 강점</h4>
                    <p className="text-sm text-green-600">{analysisResult.initialBaseline?.strengths || '분석 결과 없음'}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-700 mb-2">📌 개선 필요</h4>
                    <p className="text-sm text-red-600">{analysisResult.initialBaseline?.weaknesses || '분석 결과 없음'}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-700 mb-2">📊 현재 수준</h4>
                    <p className="text-sm text-blue-600">{analysisResult.initialBaseline?.overallLevel || '분석 결과 없음'}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-700 mb-2">🚀 성장 잠재력</h4>
                    <p className="text-sm text-purple-600">{analysisResult.initialBaseline?.learningPotential || '분석 결과 없음'}</p>
                  </div>
                </div>
              </div>

              {/* 학년 수준 평가 */}
              {analysisResult.gradeLevelAssessment && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 학년 수준 평가</h3>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm text-gray-500">현재 학년</div>
                      <div className="text-2xl font-bold text-gray-700">
                        {getGradeLabel(analysisResult.gradeLevelAssessment.currentGrade)}
                      </div>
                    </div>
                    <div className="text-3xl">→</div>
                    <div className="text-center">
                      <div className="text-sm text-gray-500">평가된 수준</div>
                      <div className={`text-2xl font-bold ${
                        analysisResult.gradeLevelAssessment.gap >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {getGradeLabel(analysisResult.gradeLevelAssessment.assessedLevel)}
                        {analysisResult.gradeLevelAssessment.gap !== 0 && (
                          <span className="text-sm ml-1">
                            ({analysisResult.gradeLevelAssessment.gap > 0 ? '+' : ''}
                            {analysisResult.gradeLevelAssessment.gap}학년)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-gray-600">{analysisResult.gradeLevelAssessment.explanation}</p>
                </div>
              )}

              {/* 영역별 진단 */}
              {analysisResult.domainDiagnosis && analysisResult.domainDiagnosis.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 영역별 진단</h3>
                  <div className="space-y-3">
                    {analysisResult.domainDiagnosis.map((domain, idx) => (
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
              {analysisResult.prerequisiteGaps && analysisResult.prerequisiteGaps.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 선수학습 결손</h3>
                  <div className="space-y-3">
                    {analysisResult.prerequisiteGaps.map((gap, idx) => (
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
              {analysisResult.learningStyleDiagnosis && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 학습 성향</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`px-4 py-2 rounded-lg font-medium ${
                      analysisResult.learningStyleDiagnosis.style === 'visual' ? 'bg-purple-100 text-purple-700' :
                      analysisResult.learningStyleDiagnosis.style === 'verbal' ? 'bg-blue-100 text-blue-700' :
                      analysisResult.learningStyleDiagnosis.style === 'logical' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {analysisResult.learningStyleDiagnosis.style === 'visual' ? '👁️ 시각형' :
                       analysisResult.learningStyleDiagnosis.style === 'verbal' ? '💬 언어형' :
                       analysisResult.learningStyleDiagnosis.style === 'logical' ? '🧮 논리형' : '🔀 복합형'}
                    </div>
                    <span className="text-gray-500">
                      신뢰도: {analysisResult.learningStyleDiagnosis.confidence}%
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-700 mb-2">특성</h4>
                      <ul className="text-sm text-gray-600 list-disc list-inside">
                        {analysisResult.learningStyleDiagnosis.characteristics.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <h4 className="font-medium text-indigo-700 mb-2">권장 학습법</h4>
                      <ul className="text-sm text-indigo-600 list-disc list-inside">
                        {analysisResult.learningStyleDiagnosis.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 커리큘럼 제안 */}
              {analysisResult.suggestedCurriculum && analysisResult.suggestedCurriculum.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 맞춤 커리큘럼 (6개월)</h3>
                  <div className="space-y-4">
                    {analysisResult.suggestedCurriculum.map((phase, idx) => (
                      <div key={idx} className="border-l-4 border-indigo-500 pl-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-indigo-600">{phase.phase}</span>
                          <span className="text-sm text-gray-500">({phase.duration})</span>
                        </div>
                        <p className="text-gray-700 font-medium">{phase.focus}</p>
                        <ul className="mt-1 text-sm text-gray-600">
                          {phase.goals.map((goal, i) => (
                            <li key={i}>• {goal}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 부모님 브리핑 */}
              {analysisResult.parentBriefing && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
                  <h3 className="text-lg font-semibold mb-3">👨‍👩‍👧 학부모님께 전달할 내용</h3>
                  <p className="leading-relaxed">{analysisResult.parentBriefing}</p>
                </div>
              )}

              {/* 저장 버튼 */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '저장 중...' : '💾 레벨 테스트 리포트 저장 (Baseline 설정)'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
