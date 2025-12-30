'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateStudentProfile } from '@/lib/student-profile-extractor';
import type { Student, User, TestAnalysisFormData, AnalysisData } from '@/types';

export default function NewReportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // 폼 상태
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [formData, setFormData] = useState<TestAnalysisFormData>({
    testName: '',
    testDate: new Date().toISOString().split('T')[0],
    testRange: '',
    totalQuestions: 20,
    maxScore: 100,
    points3: 0,
    points4: 0,
    points5: 0,
    points6: 0,
  });
  
  // 이미지 상태
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  
  // 분석 결과
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: File[] = [];
    const newImages: string[] = [];

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        newFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          // data:image/jpeg;base64, 부분 제거
          const base64Data = base64.split(',')[1];
          setImages((prev) => [...prev, base64Data]);
        };
        reader.readAsDataURL(file);
      }
    });

    setImageFiles((prev) => [...prev, ...newFiles]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
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
    if (images.length === 0) {
      setError('시험지 이미지를 업로드해주세요.');
      return;
    }

    const selectedStudent = students.find((s) => s.id === selectedStudentId);
    if (!selectedStudent) {
      setError('선택된 학생을 찾을 수 없습니다.');
      return;
    }

    setAnalyzing(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          studentId: selectedStudentId,
          reportType: 'test',
          formData,
          currentImages: images,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '분석에 실패했습니다.');
      }

      setAnalysisResult(result.analysisData);
    } catch (err: any) {
      console.error('분석 오류:', err);
      setError(err.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveReport = async () => {
    if (!analysisResult || !selectedStudentId) return;

    setSaving(true);
    setError('');

    try {
      const supabase = createClient();

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'test',
          test_name: formData.testName,
          test_date: formData.testDate,
          total_score: analysisResult.testResults?.totalScore || 0,
          max_score: formData.maxScore,
          rank: analysisResult.testResults?.rank || null,
          total_students: analysisResult.testResults?.totalStudents || null,
          analysis_data: analysisResult,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 학생 프로필 자동 추출 (취약점, 강점, 패턴)
      if (insertedReport?.id) {
        const profileResult = await updateStudentProfile(
          selectedStudentId,
          insertedReport.id,
          analysisResult
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
              analysisData: analysisResult,
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
      }

      alert('리포트가 저장되었습니다.');
      router.push('/admin');
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
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/admin/reports/create" className="text-gray-500 hover:text-gray-700">
              ← 리포트 선택
            </a>
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
                  <a href="/admin/students" className="text-indigo-600 hover:text-indigo-700">
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
                <div className="grid grid-cols-4 gap-3">
                  {[3, 4, 5, 6].map((points) => (
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
                </div>
              </div>
            </div>

            {/* 이미지 업로드 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 시험지 이미지</h2>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="text-4xl mb-2">📷</div>
                <p className="text-gray-600">클릭하여 이미지 업로드</p>
                <p className="text-sm text-gray-400 mt-1">여러 장 선택 가능</p>
              </div>

              {/* 업로드된 이미지 미리보기 */}
              {imageFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {imageFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`시험지 ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 분석 버튼 */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !selectedStudentId || images.length === 0}
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
                    {analysisResult.testResults?.totalScore || 0}점
                  </div>
                  <div className="text-gray-500">/ {formData.maxScore}점</div>
                </div>
              </div>
            </div>

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
            {analysisResult.detailedAnalysis && analysisResult.detailedAnalysis.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 문항별 분석</h3>
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
                      {analysisResult.detailedAnalysis.map((item, index) => (
                        <tr key={index} className={item.isCorrect === 'X' ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2">{item.problemNumber}</td>
                          <td className="px-3 py-2">
                            <span className={`font-bold ${item.isCorrect === 'O' ? 'text-green-600' : item.isCorrect === 'X' ? 'text-red-600' : 'text-yellow-600'}`}>
                              {item.isCorrect}
                            </span>
                          </td>
                          <td className="px-3 py-2">{item.keyConcept}</td>
                          <td className="px-3 py-2 text-gray-600">{item.errorType || '-'}</td>
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
                onClick={() => setAnalysisResult(null)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                다시 분석하기
              </button>
              <button
                onClick={handleSaveReport}
                disabled={saving}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : '💾 리포트 저장'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
