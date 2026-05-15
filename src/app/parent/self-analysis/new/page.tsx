'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, SelfAnalysisReport, SelfAnalysisProblemType } from '@/types';

const PROBLEM_TYPES: { value: SelfAnalysisProblemType; label: string; icon: string }[] = [
  { value: '연습문제', label: '연습문제', icon: '✏️' },
  { value: '교재', label: '교재 풀기', icon: '📖' },
  { value: '숙제', label: '숙제', icon: '📝' },
  { value: '시험대비', label: '시험대비', icon: '📋' },
  { value: '자유학습', label: '자유학습', icon: '🎯' },
];

const SUGGESTED_TOPICS = [
  '일차방정식', '이차방정식', '인수분해', '연립방정식',
  '함수', '도형', '확률', '통계', '수열', '미적분',
  '집합', '행렬', '벡터', '삼각함수',
];

export default function ParentSelfAnalysisPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const [problemType, setProblemType] = useState<SelfAnalysisProblemType>('연습문제');
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [parentNote, setParentNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [result, setResult] = useState<SelfAnalysisReport | null>(null);
  const [savedReportId, setSavedReportId] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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

    const { data: childrenData } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', authUser.id);

    setChildren(childrenData || []);
    if (childrenData && childrenData.length === 1) {
      setSelectedChild(childrenData[0]);
    }
    setLoading(false);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 10) {
      setError('이미지는 최대 10장까지 업로드 가능합니다.');
      return;
    }

    try {
      const compressedDataUrls = await Promise.all(files.map(compressImage));
      
      compressedDataUrls.forEach((dataUrl) => {
        setPreviewUrls((prev) => [...prev, dataUrl]);
        const base64 = dataUrl.split(',')[1];
        setImages((prev) => [...prev, base64]);
      });
      setError('');
    } catch (err) {
      console.error('이미지 압축 오류:', err);
      setError('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const addTopicTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || topicTags.includes(trimmed) || topicTags.length >= 10) return;
    setTopicTags((prev) => [...prev, trimmed]);
    setTopicInput('');
  };

  const removeTopicTag = (tag: string) => {
    setTopicTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleAnalyze = async () => {
    setError('');
    if (!selectedChild) {
      setError('분석할 자녀를 선택해주세요.');
      return;
    }
    if (images.length === 0) {
      setError('문제풀이 사진을 최소 1장 업로드해주세요.');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch('/api/self-analysis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedChild.id,
          images,
          problemType,
          topicTags,
          studentNote: parentNote.trim() || undefined,
        }),
      });

      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        if (response.status === 413 || textResponse.includes('Request Entity Too Large')) {
          throw new Error('업로드한 이미지 용량이 너무 큽니다. 사진 화질을 낮추거나 개수를 줄여주세요.');
        }
        throw new Error('서버 응답을 처리할 수 없습니다.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || '분석에 실패했습니다.');
      }

      setResult(data.analysisData);
      if (data.reportId) setSavedReportId(data.reportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setSavedReportId(null);
    setImages([]);
    setPreviewUrls([]);
    setTopicTags([]);
    setParentNote('');
    setError('');
  };

  const getGradeLabel = (grade: number) => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/parent" className="text-gray-500 hover:text-gray-700">← 대시보드</Link>
            <h1 className="text-lg font-bold text-gray-900">아이 풀이 분석받기</h1>
          </div>
          <span className="text-sm text-gray-500">{user?.name}님</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!result ? (
          <div className="space-y-6">
            {/* 안내 배너 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
              <h2 className="text-xl font-bold mb-2">📸 아이 풀이를 AI가 분석해드려요</h2>
              <p className="text-indigo-100 text-sm leading-relaxed">
                아이가 푼 문제지 사진을 올려주세요. 지금까지 쌓인 학습 데이터를 바탕으로
                잘한 점, 개선할 점, 성장한 부분을 상세히 분석해드립니다.
              </p>
            </div>

            {/* 자녀 선택 */}
            {children.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">1. 어떤 자녀의 풀이인가요?</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChild(child)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        selectedChild?.id === child.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                        {child.name[0]}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 text-sm">{child.name}</p>
                        <p className="text-xs text-gray-500">{getGradeLabel(child.grade)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {children.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-gray-500">연결된 자녀가 없습니다. 선생님께 자녀 연결을 요청해주세요.</p>
              </div>
            )}

            {/* 문제 유형 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {children.length > 1 ? '2' : '1'}. 어떤 종류의 문제인가요?
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PROBLEM_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setProblemType(type.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      problemType === type.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-2xl">{type.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 주제 태그 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {children.length > 1 ? '3' : '2'}. 어떤 단원인가요? (선택)
              </h3>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTopicTag(topicInput)}
                  placeholder="단원명 입력 후 Enter"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  maxLength={30}
                />
                <button
                  onClick={() => addTopicTag(topicInput)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                >
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {SUGGESTED_TOPICS.filter((t) => !topicTags.includes(t)).slice(0, 8).map((topic) => (
                  <button
                    key={topic}
                    onClick={() => addTopicTag(topic)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-indigo-100 hover:text-indigo-700"
                  >
                    + {topic}
                  </button>
                ))}
              </div>
              {topicTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {topicTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                      {tag}
                      <button onClick={() => removeTopicTag(tag)} className="text-indigo-400 hover:text-indigo-700">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 학부모 메모 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {children.length > 1 ? '4' : '3'}. 특별히 알려주실 내용이 있나요? (선택)
              </h3>
              <textarea
                value={parentNote}
                onChange={(e) => setParentNote(e.target.value)}
                placeholder="예: 오늘 3번 문제에서 한참 고민했어요. 분수가 나오면 많이 어려워하는 것 같아요."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{parentNote.length}/500</p>
            </div>

            {/* 이미지 업로드 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {children.length > 1 ? '5' : '4'}. 풀이 사진 업로드
              </h3>
              <p className="text-sm text-gray-500 mb-4">문제지와 풀이가 모두 보이도록 찍어주세요. 최대 10장 업로드 가능합니다.</p>

              <label className="block w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <span className="text-4xl">📸</span>
                <p className="mt-2 text-sm font-medium text-gray-700">사진을 선택하거나 여기에 끌어다 놓으세요</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG (최대 10장)</p>
              </label>

              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`풀이 ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 분석 버튼 */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || images.length === 0 || (children.length > 1 && !selectedChild)}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  AI가 분석하는 중... (30초~1분 소요)
                </>
              ) : (
                <>✨ 아이 풀이 분석받기</>
              )}
            </button>
          </div>
        ) : (
          <ParentSelfAnalysisResult
            result={result}
            reportId={savedReportId}
            childName={selectedChild?.name || ''}
            onReset={resetForm}
          />
        )}
      </main>
    </div>
  );
}

function ParentSelfAnalysisResult({
  result,
  reportId,
  childName,
  onReset,
}: {
  result: SelfAnalysisReport;
  reportId: number | null;
  childName: string;
  onReset: () => void;
}) {
  const trendColors = {
    improving: 'bg-green-100 text-green-700',
    stable: 'bg-blue-100 text-blue-700',
    needs_attention: 'bg-amber-100 text-amber-700',
  };
  const trendLabels = {
    improving: '📈 성장 중',
    stable: '➡️ 유지',
    needs_attention: '⚠️ 주의 필요',
  };

  return (
    <div className="space-y-6">
      {reportId && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span className="text-green-700 text-sm">분석 결과가 저장되었습니다.</span>
          <Link href={`/parent/reports/${reportId}`} className="ml-auto text-sm text-green-600 underline">
            저장된 리포트 보기
          </Link>
        </div>
      )}

      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-indigo-200 text-sm mb-1">{childName} · {result.problemType}</p>
            <h2 className="text-xl font-bold">{result.oneLineSummary}</h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${trendColors[result.comparisonWithHistory.overallTrend]}`}>
            {trendLabels[result.comparisonWithHistory.overallTrend]}
          </span>
        </div>
        {result.milestone && (
          <div className="mt-4 bg-white/20 rounded-lg px-4 py-2">
            <p className="text-sm">🏆 {result.milestone}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-3">📊 오늘 풀이 종합 평가</h3>
        <p className="text-gray-700 leading-relaxed">{result.overallAssessment}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl p-5 border border-green-100">
          <h3 className="font-semibold text-green-800 mb-3">✅ 잘했어요</h3>
          <ul className="space-y-2">
            {result.strengthsObserved.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <span className="mt-1 text-green-400">•</span><span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
          <h3 className="font-semibold text-amber-800 mb-3">💡 이렇게 도와주세요</h3>
          <ul className="space-y-2">
            {result.areasToImprove.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="mt-1 text-amber-400">•</span><span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-1">🔄 이전과 비교해보면</h3>
        <p className="text-sm text-gray-500 mb-4">{result.comparisonWithHistory.trendSummary}</p>
        <div className="space-y-3">
          {result.comparisonWithHistory.improvements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 mb-1">👏 나아진 점</p>
              {result.comparisonWithHistory.improvements.map((item, i) => (
                <p key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-500">↑</span>{item}</p>
              ))}
            </div>
          )}
          {result.comparisonWithHistory.persistentIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1">🎯 계속 신경 써야 할 부분</p>
              {result.comparisonWithHistory.persistentIssues.map((item, i) => (
                <p key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-amber-500">→</span>{item}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🚀 다음에 이렇게 도와주세요</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-indigo-700 mb-2">⚡ 오늘 해볼 수 있는 것</p>
            {result.nextSteps.immediate.map((step, i) => (
              <p key={i} className="text-sm text-gray-700 flex items-start gap-2 mb-1">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </p>
            ))}
          </div>
          {result.nextSteps.studyTip && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-1">💬 AI 학습 팁</p>
              <p className="text-sm text-blue-700">{result.nextSteps.studyTip}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-amber-100">
        <div className="flex items-start gap-3">
          <span className="text-3xl">💪</span>
          <div>
            <h3 className="font-semibold text-amber-800 mb-2">{childName}에게 전하는 응원 메시지</h3>
            <p className="text-amber-700 leading-relaxed">{result.encouragement}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 border-2 border-indigo-300 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 transition-colors"
        >
          다시 분석하기
        </button>
        <Link
          href="/parent"
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium text-center hover:bg-indigo-700 transition-colors"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
