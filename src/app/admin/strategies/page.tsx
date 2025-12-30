'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface StrategyTracking {
  id: number;
  report_id: number;
  student_id: number;
  strategy_index: number;
  strategy_content: {
    type?: string;
    title?: string;
    description?: string;
    whatToDo?: string;
    where?: string;
    howMuch?: string;
    howTo?: string;
    measurementMethod?: string;
  };
  execution_status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'partial';
  execution_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  target_concept: string | null;
  pre_score: number | null;
  post_score: number | null;
  improvement_rate: number | null;
  effectiveness_rating: number | null;
  difficulty_rating: number | null;
  feedback: string | null;
  reports: {
    id: number;
    test_name: string;
    test_date: string;
    report_type: string;
  };
  students: {
    id: number;
    name: string;
    student_id: string;
    grade: number;
  };
}

interface Student {
  id: number;
  name: string;
  student_id: string;
  grade: number;
}

const STATUS_LABELS = {
  pending: { text: '대기', color: 'bg-gray-100 text-gray-700' },
  in_progress: { text: '진행중', color: 'bg-blue-100 text-blue-700' },
  completed: { text: '완료', color: 'bg-green-100 text-green-700' },
  skipped: { text: '건너뜀', color: 'bg-red-100 text-red-700' },
  partial: { text: '부분완료', color: 'bg-amber-100 text-amber-700' },
};

export default function StrategiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<StrategyTracking[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [editingStrategy, setEditingStrategy] = useState<StrategyTracking | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadStrategies();
    }
  }, [selectedStudent, selectedStatus]);

  const checkAuthAndLoadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'teacher') {
      router.push('/');
      return;
    }

    // 학생 목록 로드
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, name, student_id, grade')
      .order('name');

    setStudents(studentsData || []);
    await loadStrategies();
    setLoading(false);
  };

  const loadStrategies = async () => {
    let url = '/api/strategies?';

    if (selectedStudent) {
      url += `studentId=${selectedStudent}&`;
    }
    if (selectedStatus !== 'all') {
      url += `status=${selectedStatus}&`;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('Failed to load strategies:', error);
    }
  };

  const updateStrategy = async (id: number, updates: Partial<StrategyTracking>) => {
    try {
      const response = await fetch(`/api/strategies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        loadStrategies();
        setEditingStrategy(null);
      }
    } catch (error) {
      console.error('Failed to update strategy:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">전략 관리</h1>
          </div>
          <Link
            href="/admin/analytics"
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            분석 대시보드
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">학생 선택</label>
            <select
              value={selectedStudent || ''}
              onChange={(e) => setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체 학생</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.student_id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">전체</option>
              <option value="pending">대기</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="skipped">건너뜀</option>
            </select>
          </div>
        </div>

        {/* Strategies List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">
              전략 목록 ({strategies.length}개)
            </h2>
          </div>

          {strategies.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {strategies.map(strategy => (
                <div
                  key={strategy.id}
                  className="p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_LABELS[strategy.execution_status].color
                        }`}>
                          {STATUS_LABELS[strategy.execution_status].text}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          strategy.strategy_content?.type === '개념 교정' ? 'bg-blue-100 text-blue-700' :
                          strategy.strategy_content?.type === '습관 교정' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {strategy.strategy_content?.type || '미분류'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {strategy.students?.name} | {strategy.reports?.test_name || '시험'}
                        </span>
                      </div>

                      <h3 className="text-lg font-medium text-gray-800 mb-1">
                        {strategy.strategy_content?.title || '제목 없음'}
                      </h3>

                      <p className="text-sm text-gray-600 mb-2">
                        {strategy.strategy_content?.description}
                      </p>

                      {strategy.execution_status === 'completed' && (
                        <div className="flex items-center gap-4 text-sm">
                          {strategy.improvement_rate !== null && (
                            <span className={`font-medium ${
                              strategy.improvement_rate > 0 ? 'text-green-600' :
                              strategy.improvement_rate < 0 ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              개선율: {strategy.improvement_rate > 0 ? '+' : ''}{strategy.improvement_rate}%
                            </span>
                          )}
                          {strategy.effectiveness_rating && (
                            <span className="text-gray-600">
                              효과: {'★'.repeat(strategy.effectiveness_rating)}{'☆'.repeat(5 - strategy.effectiveness_rating)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {strategy.execution_status === 'pending' && (
                        <button
                          onClick={() => updateStrategy(strategy.id, { execution_status: 'in_progress' })}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          시작
                        </button>
                      )}

                      {strategy.execution_status === 'in_progress' && (
                        <button
                          onClick={() => setEditingStrategy(strategy)}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          완료 기록
                        </button>
                      )}

                      {strategy.execution_status !== 'completed' && strategy.execution_status !== 'skipped' && (
                        <button
                          onClick={() => updateStrategy(strategy.id, { execution_status: 'skipped' })}
                          className="px-3 py-1.5 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                        >
                          건너뛰기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              {selectedStudent || selectedStatus !== 'all'
                ? '해당 조건에 맞는 전략이 없습니다.'
                : '추적 중인 전략이 없습니다. 리포트 생성 시 전략이 자동으로 추가됩니다.'
              }
            </div>
          )}
        </div>
      </main>

      {/* Complete Strategy Modal */}
      {editingStrategy && (
        <CompleteStrategyModal
          strategy={editingStrategy}
          onClose={() => setEditingStrategy(null)}
          onSave={(updates) => updateStrategy(editingStrategy.id, updates)}
        />
      )}
    </div>
  );
}

interface CompleteStrategyModalProps {
  strategy: StrategyTracking;
  onClose: () => void;
  onSave: (updates: Partial<StrategyTracking>) => void;
}

function CompleteStrategyModal({ strategy, onClose, onSave }: CompleteStrategyModalProps) {
  const [preScore, setPreScore] = useState<string>('');
  const [postScore, setPostScore] = useState<string>('');
  const [effectivenessRating, setEffectivenessRating] = useState<number>(3);
  const [difficultyRating, setDifficultyRating] = useState<number>(3);
  const [feedback, setFeedback] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      execution_status: 'completed',
      pre_score: preScore ? parseFloat(preScore) : undefined,
      post_score: postScore ? parseFloat(postScore) : undefined,
      effectiveness_rating: effectivenessRating,
      difficulty_rating: difficultyRating,
      feedback: feedback || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">전략 완료 기록</h3>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-800">{strategy.strategy_content?.title}</p>
            <p className="text-sm text-gray-600">{strategy.students?.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  실행 전 점수 (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={preScore}
                  onChange={(e) => setPreScore(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  실행 후 점수 (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={postScore}
                  onChange={(e) => setPostScore(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="0-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                효과 평가 (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setEffectivenessRating(rating)}
                    className={`w-10 h-10 rounded-full text-lg ${
                      rating <= effectivenessRating
                        ? 'bg-yellow-400 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                실행 난이도 (1=쉬움, 5=어려움)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setDifficultyRating(rating)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      rating === difficultyRating
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                피드백
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="전략 실행 후 느낀 점, 개선 사항 등"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
