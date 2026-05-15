'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { updateStudentProfile } from '@/lib/student-profile-extractor';
import { registerReportFeedbackData } from '@/lib/feedback-loop';
import { generateStudyPlanFromPrescription } from '@/lib/study-plan-generator';
import { sendReportCreatedNotification } from '@/lib/notification-helper';
import { indexReportEmbeddings } from '@/lib/embedding-helper';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import MultiFileUpload, { UploadedFile } from '@/components/common/MultiFileUpload';
import type { Student, User, TestAnalysisFormData, AnalysisData, DetailedProblemAnalysis, TestResults } from '@/types';

type VerificationDraft = {
  totalScore: number;
  maxScore: number;
  rank: number | '';
  totalStudents: number | '';
  correctRateByPoint: { name: string; value: number; total: number }[];
  detailedAnalysis: DetailedProblemAnalysis[];
  verificationNote: string;
};

const CORRECTNESS_OPTIONS: DetailedProblemAnalysis['isCorrect'][] = ['O', 'X', '△', '-'];
const ERROR_TYPE_OPTIONS: DetailedProblemAnalysis['errorType'][] = [
  '개념 오류',
  '절차 오류',
  '계산 오류',
  '문제 오독',
  '기타/부주의',
  'N/A',
];

const toNumberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cloneDetailedAnalysis = (items?: DetailedProblemAnalysis[]): DetailedProblemAnalysis[] =>
  (items || []).map((item) => ({ ...item }));

const buildVerificationDraft = (
  analysisData: AnalysisData,
  fallbackMaxScore: number
): VerificationDraft => ({
  totalScore: toNumberOrZero(analysisData.testResults?.totalScore),
  maxScore: toNumberOrZero(analysisData.testResults?.maxScore || fallbackMaxScore),
  rank: analysisData.testResults?.rank || '',
  totalStudents: analysisData.testResults?.totalStudents || '',
  correctRateByPoint: (analysisData.testResults?.correctRateByPoint || []).map((item) => ({ ...item })),
  detailedAnalysis: cloneDetailedAnalysis(analysisData.detailedAnalysis),
  verificationNote: '',
});

const detectAdjustedFields = (analysisData: AnalysisData, draft: VerificationDraft): string[] => {
  const adjusted = new Set<string>();
  const originalResults = analysisData.testResults;

  if (originalResults?.totalScore !== draft.totalScore) adjusted.add('totalScore');
  if (originalResults?.maxScore !== draft.maxScore) adjusted.add('maxScore');
  if ((originalResults?.rank || '') !== draft.rank) adjusted.add('rank');
  if ((originalResults?.totalStudents || '') !== draft.totalStudents) adjusted.add('totalStudents');

  draft.correctRateByPoint.forEach((row, index) => {
    const original = originalResults?.correctRateByPoint?.[index];
    if (!original || original.name !== row.name || original.value !== row.value || original.total !== row.total) {
      adjusted.add('correctRateByPoint');
    }
  });

  draft.detailedAnalysis.forEach((item, index) => {
    const original = analysisData.detailedAnalysis?.[index];
    if (!original || original.isCorrect !== item.isCorrect || original.errorType !== item.errorType) {
      adjusted.add('detailedAnalysis');
    }
  });

  if (draft.verificationNote.trim()) adjusted.add('verificationNote');
  return Array.from(adjusted);
};

const getVerificationError = (draft: VerificationDraft): string | null => {
  if (draft.maxScore <= 0) return '만점은 1점 이상이어야 합니다.';
  if (draft.totalScore < 0) return '최종 점수는 0점 이상이어야 합니다.';
  if (draft.totalScore > draft.maxScore) return '최종 점수는 만점을 초과할 수 없습니다.';
  if (draft.rank !== '' && draft.rank < 1) return '석차는 1 이상이어야 합니다.';
  if (draft.totalStudents !== '' && draft.totalStudents < 1) return '전체 인원은 1 이상이어야 합니다.';
  if (draft.rank !== '' && draft.totalStudents !== '' && draft.rank > draft.totalStudents) {
    return '석차는 전체 인원보다 클 수 없습니다.';
  }

  for (const row of draft.correctRateByPoint) {
    if (row.value < 0 || row.total < 0) return '배점별 정답 수와 전체 수는 0 이상이어야 합니다.';
    if (row.value > row.total) return `${row.name} 정답 수는 전체 수를 초과할 수 없습니다.`;
  }

  return null;
};

const buildTeacherVerifiedAnalysis = (
  analysisData: AnalysisData,
  draft: VerificationDraft
): AnalysisData => {
  const verifiedResults: TestResults = {
    ...(analysisData.testResults || {}),
    totalScore: draft.totalScore,
    maxScore: draft.maxScore,
    rank: draft.rank === '' ? 0 : draft.rank,
    totalStudents: draft.totalStudents === '' ? 0 : draft.totalStudents,
    correctRateByPoint: draft.correctRateByPoint.map((item) => ({ ...item })),
  };
  const verifiedDetailed = cloneDetailedAnalysis(draft.detailedAnalysis);

  return {
    ...analysisData,
    testResults: verifiedResults,
    detailedAnalysis: verifiedDetailed,
    verificationStatus: 'teacher_verified',
    aiInferred: {
      capturedAt: new Date().toISOString(),
      testResults: analysisData.testResults ? { ...analysisData.testResults } : undefined,
      detailedAnalysis: cloneDetailedAnalysis(analysisData.detailedAnalysis),
      note: 'Original AI-inferred values before teacher correction. Do not use as final grading truth.',
    },
    teacherVerified: {
      verifiedAt: new Date().toISOString(),
      testResults: verifiedResults,
      detailedAnalysis: verifiedDetailed,
      verificationNote: draft.verificationNote.trim() || undefined,
      adjustedFields: detectAdjustedFields(analysisData, draft),
    },
  };
};

export default function NewReportPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  // 폼 상태
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [formData, setFormData] = useState<TestAnalysisFormData>({
    testName: '',
    testDate: new Date().toISOString().split('T')[0],
    testRange: '',
    totalQuestions: 20,
    maxScore: 100,
    points2: 0,
    points3: 0,
    points4: 0,
    points5: 0,
    points6: 0,
    pointsEssay: 0,
  });

  // 파일 상태 (MultiFileUpload 사용)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // 분석 결과
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [verificationDraft, setVerificationDraft] = useState<VerificationDraft | null>(null);
  const [isTeacherVerified, setIsTeacherVerified] = useState(false);

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

    // 학생 목록 로드
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);
    setLoading(false);
  };

  // 파일에서 이미지 데이터 추출
  const extractImagesFromFiles = (): string[] => {
    return uploadedFiles
      .filter((f) => f.type === 'image')
      .map((f) => {
        // data:image/jpeg;base64, 부분 제거
        const base64Data = f.data.split(',')[1];
        return base64Data;
      });
  };

  const handleAnalyze = async () => {
    setError('');

    // 유효성 검사
    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }
    if (!formData.testName.trim()) {
      setError('시험명을 입력해주세요.');
      return;
    }
    if (uploadedFiles.length === 0) {
      setError('시험지 파일을 업로드해주세요. (이미지, PDF, CSV 지원)');
      return;
    }

    const selectedStudent = students.find((s) => s.id === selectedStudentId);
    if (!selectedStudent) {
      setError('선택된 학생을 찾을 수 없습니다.');
      return;
    }

    setAnalyzing(true);

    try {
      // 이미지 파일 추출
      const imageFiles = extractImagesFromFiles();

      // PDF와 CSV 파일 데이터 추출
      const pdfFiles = uploadedFiles.filter((f) => f.type === 'pdf').map((f) => f.data);
      const csvFiles = uploadedFiles.filter((f) => f.type === 'csv').map((f) => f.data);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          studentId: selectedStudentId,
          reportType: 'test',
          formData,
          currentImages: imageFiles,
          pdfFiles,
          csvFiles,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '분석에 실패했습니다.');
      }

      setAnalysisResult(result.analysisData);
      setVerificationDraft(buildVerificationDraft(result.analysisData, formData.maxScore));
      setIsTeacherVerified(false);
    } catch (err: unknown) {
      console.error('분석 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveReport = async () => {
    if (!analysisResult || !selectedStudentId) return;
    if (!verificationDraft || !isTeacherVerified) {
      setError('저장 전에 교사가 점수와 문항별 정오를 확인하고 확정해야 합니다.');
      return;
    }
    const verificationError = getVerificationError(verificationDraft);
    if (verificationError) {
      setError(verificationError);
      setIsTeacherVerified(false);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const supabase = createClient();
      const verifiedAnalysis = buildTeacherVerifiedAnalysis(analysisResult, verificationDraft);

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'test',
          test_name: formData.testName,
          test_date: formData.testDate,
          total_score: verifiedAnalysis.testResults.totalScore,
          max_score: verifiedAnalysis.testResults.maxScore,
          rank: verifiedAnalysis.testResults.rank || null,
          total_students: verifiedAnalysis.testResults.totalStudents || null,
          analysis_data: verifiedAnalysis,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 학생 프로필 자동 추출 (취약점, 강점, 패턴)
      if (insertedReport?.id) {
        const profileResult = await updateStudentProfile(
          selectedStudentId,
          insertedReport.id,
          verifiedAnalysis
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
              analysisData: verifiedAnalysis,
              reportType: 'test',
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

        // [Feedback Loop] 전략 추적 및 예측 데이터 등록
        try {
          const feedbackResult = await registerReportFeedbackData(
            insertedReport.id,
            selectedStudentId,
            verifiedAnalysis
          );
          console.log('[Feedback Loop] 등록 결과:', feedbackResult);
        } catch (feedbackError) {
          console.warn('[Feedback Loop] 등록 실패:', feedbackError);
        }

        // [Study Plan] AI 처방 → 학습 계획 자동 생성
        if (verifiedAnalysis.actionablePrescription?.length > 0) {
          try {
            const planResult = await generateStudyPlanFromPrescription(
              selectedStudentId,
              insertedReport.id,
              verifiedAnalysis.actionablePrescription,
              formData.testName
            );
            if (planResult.success) {
              console.log('[Study Plan] 학습 계획 자동 생성 완료:', planResult.planId);
            } else {
              console.warn('[Study Plan] 학습 계획 생성 실패:', planResult.error);
            }
          } catch (planError) {
            console.warn('[Study Plan] 학습 계획 생성 오류:', planError);
          }
        }

        // [Parent Notification] 학부모 알림 발송
        const notifResult = await sendReportCreatedNotification({
          reportId: insertedReport.id,
          studentId: selectedStudentId,
        });
        if (notifResult.success && !notifResult.skipped) {
          console.log('[Notification] 학부모 알림 발송 완료');
        }

        // [Embedding] RAG 기억 서랍 인덱싱 (fire-and-forget)
        indexReportEmbeddings(insertedReport.id, selectedStudentId);
      }

      addToast('리포트가 저장되었습니다.', 'success');
      router.push('/teacher');
    } catch (err) {
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} onRemove={removeToast} />
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/teacher/reports/create" className="text-gray-500 hover:text-gray-700">
              ← 리포트 선택
            </Link>
            <h1 className="text-xl font-bold text-gray-900">시험지 분석</h1>
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

        {!analysisResult ? (
          /* 입력 폼 */
          <div className="space-y-6">
            {/* 학생 선택 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 학생 선택</h2>
              
              {students.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-2">등록된 학생이 없습니다.</p>
                  <a href="/teacher/students" className="text-indigo-600 hover:text-indigo-700">
                    학생 등록하러 가기
                  </a>
                </div>
              ) : (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value) || '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 시험 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 시험 정보</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시험명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.testName}
                    onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 1학기 중간고사"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시험일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.testDate}
                    onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">시험 범위</label>
                  <input
                    type="text"
                    value={formData.testRange}
                    onChange={(e) => setFormData({ ...formData, testRange: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 1단원 ~ 3단원"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">총 문항 수</label>
                  <input
                    type="number"
                    value={formData.totalQuestions}
                    onChange={(e) => setFormData({ ...formData, totalQuestions: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">만점</label>
                  <input
                    type="number"
                    value={formData.maxScore}
                    onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 배점 정보 */}
              <div className="mt-4 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">배점별 문항 수</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[2, 3, 4, 5, 6].map((points) => (
                    <div key={points}>
                      <label className="block text-xs text-gray-500 mb-1">{points}점</label>
                      <input
                        type="number"
                        value={formData[`points${points}` as keyof TestAnalysisFormData] as number}
                        onChange={(e) =>
                          setFormData({ ...formData, [`points${points}`]: Number(e.target.value) })
                        }
                        min={0}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">서술형</label>
                    <input
                      type="number"
                      value={formData.pointsEssay}
                      onChange={(e) =>
                        setFormData({ ...formData, pointsEssay: Number(e.target.value) })
                      }
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 파일 업로드 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 시험지 파일</h2>
              <MultiFileUpload
                files={uploadedFiles}
                onFilesChange={setUploadedFiles}
                acceptedTypes={['image', 'pdf', 'csv']}
                maxFiles={20}
                maxSizeMB={10}
                label=""
                helpText="시험지 이미지, 성적표 PDF, 또는 점수 CSV 파일을 업로드하세요."
                required
              />
            </div>

            {/* 교사 관찰 코멘트 (선택) */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. 교사 관찰 코멘트 (선택)</h2>
              <p className="text-sm text-gray-500 mb-4">
                이미지 분석만으로는 알기 어려운 학생의 행동 데이터를 입력하면 AI가 더 정밀한 분석을 제공합니다.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">문제 풀이 태도 및 집중도</label>
                  <textarea
                    value={formData.teacherComments?.attitudeAndFocus || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      teacherComments: { ...(formData.teacherComments || {}), attitudeAndFocus: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 산만함, 끈기 등 태도 관련 관찰 사항"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">망설임 및 체공 시간</label>
                  <textarea
                    value={formData.teacherComments?.hesitationAndTime || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      teacherComments: { ...(formData.teacherComments || {}), hesitationAndTime: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 유독 시간을 많이 끈 문제, 지우개 사용이 잦았던 문제 등"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">메타인지 상태 및 기타 특이사항</label>
                  <textarea
                    value={formData.teacherComments?.metacognition || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      teacherComments: { ...(formData.teacherComments || {}), metacognition: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 풀이에 대한 확신 유무, 질문 빈도, 기타 특이사항 등"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* 문항별 행동 데이터 (선택) */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. 문항별 메타인지 및 체공 시간 (선택)</h2>
              <p className="text-sm text-gray-500 mb-4">
                학생 스스로 확신도를 평가하게 하거나 유독 오래 걸린 문제를 기록하세요. AI가 오답 원인을 더 정확히 좁혀줍니다.
              </p>
              
              <div className="space-y-3">
                {formData.problemBehaviorData?.map((item, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <input
                      type="text"
                      placeholder="문항 번호"
                      value={item.problemNumber}
                      onChange={(e) => {
                        const newData = [...(formData.problemBehaviorData || [])];
                        newData[index].problemNumber = e.target.value;
                        setFormData({ ...formData, problemBehaviorData: newData });
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <select
                      value={item.selfConfidence || ''}
                      onChange={(e) => {
                        const newData = [...(formData.problemBehaviorData || [])];
                        newData[index].selfConfidence = e.target.value ? Number(e.target.value) as 1 | 2 | 3 : undefined;
                        setFormData({ ...formData, problemBehaviorData: newData });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="">확신도 (선택)</option>
                      <option value="1">1 (찍음)</option>
                      <option value="2">2 (헷갈림)</option>
                      <option value="3">3 (확신함)</option>
                    </select>
                    <input
                      type="number"
                      placeholder="시간(분)"
                      value={item.timeSpentMins || ''}
                      onChange={(e) => {
                        const newData = [...(formData.problemBehaviorData || [])];
                        newData[index].timeSpentMins = e.target.value ? Number(e.target.value) : undefined;
                        setFormData({ ...formData, problemBehaviorData: newData });
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newData = [...(formData.problemBehaviorData || [])];
                        newData.splice(index, 1);
                        setFormData({ ...formData, problemBehaviorData: newData });
                      }}
                      className="text-red-500 hover:text-red-700 font-medium px-2 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    const newData = [...(formData.problemBehaviorData || [])];
                    newData.push({ problemNumber: '' });
                    setFormData({ ...formData, problemBehaviorData: newData });
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 mt-2"
                >
                  + 특이 문항 기록 추가
                </button>
              </div>
            </div>

            {/* 분석 버튼 */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !selectedStudentId || uploadedFiles.length === 0}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> AI 분석 중... (1~2분 소요)
                </span>
              ) : (
                '🔍 AI 분석 시작'
              )}
            </button>
          </div>
        ) : (
          /* 분석 결과 */
          <div className="space-y-6">
            {/* 결과 헤더 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">분석 완료</h2>
                  <p className="text-gray-600 mt-1">
                    {students.find((s) => s.id === selectedStudentId)?.name} · {formData.testName}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-indigo-600">
                    {verificationDraft?.totalScore ?? analysisResult.testResults?.totalScore ?? 0}점
                  </div>
                  <div className="text-gray-500">/ {verificationDraft?.maxScore ?? formData.maxScore}점</div>
                </div>
              </div>
            </div>

            {/* 교사 확정 */}
            {verificationDraft && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-amber-950">교사 확인 및 최종값 확정</h3>
                    <p className="text-sm text-amber-800 mt-1">
                      AI 분석은 초안입니다. 점수, 석차, 배점별 정답 수, 문항별 정오는 교사가 확인한 값만 최종 리포트와 성장 데이터에 저장됩니다.
                    </p>
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                    isTeacherVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isTeacherVerified ? '확정 완료' : '확정 필요'}
                  </span>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">최종 점수</label>
                    <input
                      type="number"
                      min={0}
                      value={verificationDraft.totalScore}
                      onChange={(e) => {
                        setVerificationDraft({ ...verificationDraft, totalScore: toNumberOrZero(e.target.value) });
                        setIsTeacherVerified(false);
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                    <p className="text-xs text-amber-700 mt-1">AI 추정: {analysisResult.testResults?.totalScore ?? '-'}점</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">만점</label>
                    <input
                      type="number"
                      min={1}
                      value={verificationDraft.maxScore}
                      onChange={(e) => {
                        setVerificationDraft({ ...verificationDraft, maxScore: toNumberOrZero(e.target.value) });
                        setIsTeacherVerified(false);
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">석차</label>
                    <input
                      type="number"
                      min={1}
                      value={verificationDraft.rank}
                      onChange={(e) => {
                        setVerificationDraft({ ...verificationDraft, rank: e.target.value ? Number(e.target.value) : '' });
                        setIsTeacherVerified(false);
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      placeholder="선택"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">전체 인원</label>
                    <input
                      type="number"
                      min={1}
                      value={verificationDraft.totalStudents}
                      onChange={(e) => {
                        setVerificationDraft({ ...verificationDraft, totalStudents: e.target.value ? Number(e.target.value) : '' });
                        setIsTeacherVerified(false);
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      placeholder="선택"
                    />
                  </div>
                </div>

                {verificationDraft.correctRateByPoint.length > 0 && (
                  <div className="mt-5">
                    <h4 className="font-medium text-gray-900 mb-2">배점별 정답 수 확인</h4>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {verificationDraft.correctRateByPoint.map((row, index) => (
                        <div key={`${row.name}-${index}`} className="bg-white border border-amber-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-800 mb-2">{row.name}</div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-gray-500">
                              정답 수
                              <input
                                type="number"
                                min={0}
                                value={row.value}
                                onChange={(e) => {
                                  const next = [...verificationDraft.correctRateByPoint];
                                  next[index] = { ...row, value: toNumberOrZero(e.target.value) };
                                  setVerificationDraft({ ...verificationDraft, correctRateByPoint: next });
                                  setIsTeacherVerified(false);
                                }}
                                className="mt-1 w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            </label>
                            <label className="text-xs text-gray-500">
                              전체 수
                              <input
                                type="number"
                                min={0}
                                value={row.total}
                                onChange={(e) => {
                                  const next = [...verificationDraft.correctRateByPoint];
                                  next[index] = { ...row, total: toNumberOrZero(e.target.value) };
                                  setVerificationDraft({ ...verificationDraft, correctRateByPoint: next });
                                  setIsTeacherVerified(false);
                                }}
                                className="mt-1 w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">확정 메모</label>
                  <textarea
                    value={verificationDraft.verificationNote}
                    onChange={(e) => {
                      setVerificationDraft({ ...verificationDraft, verificationNote: e.target.value });
                      setIsTeacherVerified(false);
                    }}
                    rows={2}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    placeholder="예: 실제 채점표 기준으로 총점과 서술형 정오를 보정함"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const verificationError = getVerificationError(verificationDraft);
                    if (verificationError) {
                      setError(verificationError);
                      setIsTeacherVerified(false);
                      return;
                    }
                    setIsTeacherVerified(true);
                    setError('');
                  }}
                  className="mt-5 w-full py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors"
                >
                  최종값 확인 완료
                </button>
              </div>
            )}

            {/* 거시 분석 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 종합 분석</h3>
              <p className="text-gray-700 leading-relaxed">
                {analysisResult.macroAnalysis?.summary || '분석 결과 없음'}
              </p>

              {analysisResult.macroAnalysis?.strengths && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-1">💪 강점</h4>
                  <p className="text-green-700 text-sm">{analysisResult.macroAnalysis.strengths}</p>
                </div>
              )}

              {analysisResult.macroAnalysis?.weaknesses && (
                <div className="mt-3 p-4 bg-red-50 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-1">⚠️ 약점</h4>
                  <p className="text-red-700 text-sm">{analysisResult.macroAnalysis.weaknesses}</p>
                </div>
              )}
            </div>

            {/* 개선 전략 */}
            {analysisResult.actionablePrescription && analysisResult.actionablePrescription.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 개선 전략</h3>
                <div className="space-y-4">
                  {analysisResult.actionablePrescription.map((item, index) => (
                    <div key={index} className="border-l-4 border-indigo-500 pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                          {item.priority}순위
                        </span>
                        <span className="font-medium text-gray-900">{item.title}</span>
                      </div>
                      <p className="text-gray-600 text-sm">{item.description}</p>
                      {item.whatToDo && (
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <p>📚 무엇을: {item.whatToDo}</p>
                          <p>📍 어디서: {item.where}</p>
                          <p>⏱️ 얼마나: {item.howMuch}</p>
                          <p>💡 어떻게: {item.howTo}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 문항별 분석 */}
            {verificationDraft?.detailedAnalysis && verificationDraft.detailedAnalysis.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">문항별 분석 및 정오 확인</h3>
                <p className="text-sm text-gray-500 mb-4">
                  AI가 추정한 문항별 정오와 오류 유형을 실제 채점 기준에 맞게 보정하세요.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">번호</th>
                        <th className="px-3 py-2 text-left">정오</th>
                        <th className="px-3 py-2 text-left">핵심 개념</th>
                        <th className="px-3 py-2 text-left">오류 유형</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {verificationDraft.detailedAnalysis.map((item, index) => (
                        <tr key={index} className={item.isCorrect === 'X' ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2">{item.problemNumber}</td>
                          <td className="px-3 py-2">
                            <select
                              value={item.isCorrect}
                              onChange={(e) => {
                                const next = [...verificationDraft.detailedAnalysis];
                                next[index] = {
                                  ...item,
                                  isCorrect: e.target.value as DetailedProblemAnalysis['isCorrect'],
                                };
                                setVerificationDraft({ ...verificationDraft, detailedAnalysis: next });
                                setIsTeacherVerified(false);
                              }}
                              className={`px-2 py-1 border rounded font-bold bg-white ${
                                item.isCorrect === 'O' ? 'text-green-600' : item.isCorrect === 'X' ? 'text-red-600' : 'text-yellow-600'
                              }`}
                            >
                              {CORRECTNESS_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">{item.keyConcept}</td>
                          <td className="px-3 py-2 text-gray-600">
                            <select
                              value={item.errorType || 'N/A'}
                              onChange={(e) => {
                                const next = [...verificationDraft.detailedAnalysis];
                                next[index] = {
                                  ...item,
                                  errorType: e.target.value as DetailedProblemAnalysis['errorType'],
                                };
                                setVerificationDraft({ ...verificationDraft, detailedAnalysis: next });
                                setIsTeacherVerified(false);
                              }}
                              className="px-2 py-1 border border-gray-300 rounded bg-white"
                            >
                              {ERROR_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setAnalysisResult(null);
                  setVerificationDraft(null);
                  setIsTeacherVerified(false);
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                다시 분석하기
              </button>
              <button
                onClick={handleSaveReport}
                disabled={saving || !isTeacherVerified}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : isTeacherVerified ? '💾 확정 리포트 저장' : '교사 확인 후 저장 가능'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
