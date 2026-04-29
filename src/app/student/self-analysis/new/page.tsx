'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User, SelfAnalysisReport, SelfAnalysisProblemType } from '@/types';

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

export default function StudentSelfAnalysisPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const [problemType, setProblemType] = useState<SelfAnalysisProblemType>('연습문제');
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [studentNote, setStudentNote] = useState('');
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

    if (!userData || userData.role !== 'student') {
      router.push('/');
      return;
    }

    setUser(userData);
    setLoading(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 10) {
      setError('이미지는 최대 10장까지 업로드 가능합니다.');
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setPreviewUrls((prev) => [...prev, dataUrl]);
        // base64 데이터만 추출 (data:image/...;base64, 제거)
        const base64 = dataUrl.split(',')[1];
        setImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
    setError('');
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
          images,
          problemType,
          topicTags,
          studentNote: studentNote.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
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
    setStudentNote('');
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/student" className="text-gray-500 hover:text-gray-700">← 대시보드</Link>
            <h1 className="text-lg font-bold text-gray-900">내 풀이 분석받기</h1>
          </div>
          <span className="text-sm text-gray-500">{user?.name}</span>
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
              <h2 className="text-xl font-bold mb-2">✨ 내 풀이를 AI가 분석해드려요</h2>
              <p className="text-indigo-100 text-sm leading-relaxed">
                문제풀이 사진을 올리면 지금까지 쌓인 나의 학습 데이터를 바탕으로
                잘한 점, 개선할 점, 변화된 부분을 자세히 알려드릴게요!
              </p>
            </div>

            {/* 문제 유형 선택 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">1. 어떤 종류의 문제를 풀었나요?</h3>
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
              <h3 className="text-base font-semibold text-gray-900 mb-4">2. 어떤 단원을 공부했나요? (선택)</h3>
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
              {/* 추천 태그 */}
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
              {/* 선택된 태그 */}
              {topicTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {topicTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                    >
                      {tag}
                      <button onClick={() => removeTopicTag(tag)} className="text-indigo-400 hover:text-indigo-700">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 메모 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">3. 어려웠던 점이 있었나요? (선택)</h3>
              <textarea
                value={studentNote}
                onChange={(e) => setStudentNote(e.target.value)}
                placeholder="예: 3번 문제에서 식을 어떻게 세워야 할지 몰랐어요. 분수 계산이 잘 안 돼요."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{studentNote.length}/500</p>
            </div>

            {/* 이미지 업로드 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">4. 풀이 사진 업로드</h3>
              <p className="text-sm text-gray-500 mb-4">문제지와 풀이를 함께 찍어주세요. 최대 10장 업로드 가능합니다.</p>

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
                      <img
                        src={url}
                        alt={`풀이 ${idx + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 분석 버튼 */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || images.length === 0}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  AI가 분석하는 중... (30초~1분 소요)
                </>
              ) : (
                <>✨ 내 풀이 분석받기</>
              )}
            </button>
          </div>
        ) : (
          /* 분석 결과 */
          <SelfAnalysisResult
            result={result}
            reportId={savedReportId}
            onReset={resetForm}
          />
        )}
      </main>
    </div>
  );
}

function SelfAnalysisResult({
  result,
  reportId,
  onReset,
}: {
  result: SelfAnalysisReport;
  reportId: number | null;
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
      {/* 저장 완료 알림 */}
      {reportId && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span className="text-green-700 text-sm">분석 결과가 저장되었습니다.</span>
          <Link href={`/student/reports/${reportId}`} className="ml-auto text-sm text-green-600 underline">
            저장된 리포트 보기
          </Link>
        </div>
      )}

      {/* 헤더 카드 */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-indigo-200 text-sm mb-1">{result.problemType} · {result.topicTags.join(', ') || '일반'}</p>
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

      {/* 종합 평가 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-3">📊 종합 평가</h3>
        <p className="text-gray-700 leading-relaxed">{result.overallAssessment}</p>
      </div>

      {/* 잘한 점 & 개선할 점 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl p-5 border border-green-100">
          <h3 className="font-semibold text-green-800 mb-3">✅ 잘한 점</h3>
          <ul className="space-y-2">
            {result.strengthsObserved.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <span className="mt-1 text-green-400">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
          <h3 className="font-semibold text-amber-800 mb-3">💡 이렇게 해보세요</h3>
          <ul className="space-y-2">
            {result.areasToImprove.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="mt-1 text-amber-400">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 과거 데이터와 비교 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-1">🔄 지난번과 비교해보면</h3>
        <p className="text-sm text-gray-500 mb-4">{result.comparisonWithHistory.trendSummary}</p>
        <div className="space-y-4">
          {result.comparisonWithHistory.improvements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 mb-2">👏 나아진 점</p>
              <ul className="space-y-1">
                {result.comparisonWithHistory.improvements.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-500">↑</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.comparisonWithHistory.persistentIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 mb-2">🎯 계속 신경 써야 할 부분</p>
              <ul className="space-y-1">
                {result.comparisonWithHistory.persistentIssues.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-amber-500">→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.comparisonWithHistory.newObservations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-600 mb-2">🔍 이번에 새로 발견된 것</p>
              <ul className="space-y-1">
                {result.comparisonWithHistory.newObservations.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500">★</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 문항별 피드백 */}
      {result.problemFeedback.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📝 문제별 피드백</h3>
          <div className="space-y-4">
            {result.problemFeedback.map((fb, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4">
                {fb.problemIdentifier && (
                  <p className="text-xs font-semibold text-indigo-600 mb-2">{fb.problemIdentifier}</p>
                )}
                <p className="text-sm text-gray-700 mb-2">{fb.observation}</p>
                {fb.whatWentWell && (
                  <p className="text-xs text-green-600">✓ {fb.whatWentWell}</p>
                )}
                {fb.suggestion && (
                  <p className="text-xs text-amber-600 mt-1">💡 {fb.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다음 단계 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🚀 다음 단계</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-indigo-700 mb-2">⚡ 오늘 바로 해보세요</p>
            <ul className="space-y-2">
              {result.nextSteps.immediate.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
          {result.nextSteps.thisWeek.length > 0 && (
            <div>
              <p className="text-sm font-medium text-purple-700 mb-2">📅 이번 주 목표</p>
              <ul className="space-y-2">
                {result.nextSteps.thisWeek.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.nextSteps.studyTip && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-1">💬 AI 학습 팁</p>
              <p className="text-sm text-blue-700">{result.nextSteps.studyTip}</p>
            </div>
          )}
        </div>
      </div>

      {/* 격려 메시지 */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-amber-100">
        <div className="flex items-start gap-3">
          <span className="text-3xl">💪</span>
          <div>
            <h3 className="font-semibold text-amber-800 mb-2">응원 메시지</h3>
            <p className="text-amber-700 leading-relaxed">{result.encouragement}</p>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 border-2 border-indigo-300 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 transition-colors"
        >
          다시 분석하기
        </button>
        <Link
          href="/student"
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium text-center hover:bg-indigo-700 transition-colors"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
