'use client';

import React, { useState } from 'react';
import type {
  StudyTask,
  StudyTaskStatus,
  StudyTaskCategory,
  StudyTaskPriority,
} from '@/types';

interface StudyChecklistProps {
  tasks: StudyTask[];
  onTaskStatusChange: (taskId: number, status: StudyTaskStatus, feedback?: {
    completion_note?: string;
    actual_minutes?: number;
    difficulty_feedback?: 'easy' | 'appropriate' | 'hard';
  }) => void;
  editable?: boolean;
  showFeedback?: boolean;
}

// 카테고리별 아이콘 및 라벨
const CATEGORY_CONFIG: Record<StudyTaskCategory, { icon: string; label: string }> = {
  concept_review: { icon: '📖', label: '개념 복습' },
  problem_solving: { icon: '✏️', label: '문제 풀이' },
  workbook: { icon: '📚', label: '교재 진도' },
  test_prep: { icon: '📝', label: '시험 대비' },
  weakness_practice: { icon: '🎯', label: '취약점 연습' },
  enrichment: { icon: '🚀', label: '심화 학습' },
  custom: { icon: '📌', label: '기타' },
};

// 우선순위별 스타일
const PRIORITY_STYLES: Record<StudyTaskPriority, string> = {
  high: 'border-l-red-500 bg-red-50',
  medium: 'border-l-yellow-500 bg-yellow-50',
  low: 'border-l-blue-500 bg-blue-50',
};

// 상태별 체크박스 스타일
const STATUS_CHECKBOX_STYLES: Record<StudyTaskStatus, string> = {
  pending: 'border-gray-300 bg-white',
  in_progress: 'border-indigo-500 bg-indigo-100',
  completed: 'border-green-500 bg-green-500 text-white',
  skipped: 'border-gray-400 bg-gray-200',
};

export default function StudyChecklist({
  tasks,
  onTaskStatusChange,
  editable = true,
  showFeedback = false,
}: StudyChecklistProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [feedbackData, setFeedbackData] = useState<{
    completion_note: string;
    actual_minutes: string;
    difficulty_feedback: 'easy' | 'appropriate' | 'hard' | '';
  }>({
    completion_note: '',
    actual_minutes: '',
    difficulty_feedback: '',
  });

  const handleCheckboxClick = (task: StudyTask) => {
    if (!editable) return;

    if (task.status === 'completed') {
      // 완료 상태에서 클릭하면 pending으로
      onTaskStatusChange(task.id, 'pending');
    } else if (showFeedback) {
      // 피드백 입력 필요한 경우 확장
      setExpandedTaskId(task.id);
    } else {
      // 바로 완료 처리
      onTaskStatusChange(task.id, 'completed');
    }
  };

  const handleFeedbackSubmit = (taskId: number) => {
    onTaskStatusChange(taskId, 'completed', {
      completion_note: feedbackData.completion_note || undefined,
      actual_minutes: feedbackData.actual_minutes ? parseInt(feedbackData.actual_minutes) : undefined,
      difficulty_feedback: feedbackData.difficulty_feedback || undefined,
    });
    setExpandedTaskId(null);
    setFeedbackData({
      completion_note: '',
      actual_minutes: '',
      difficulty_feedback: '',
    });
  };

  const handleSkip = (taskId: number) => {
    onTaskStatusChange(taskId, 'skipped');
    setExpandedTaskId(null);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>등록된 학습 항목이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id}>
          {/* 메인 태스크 카드 */}
          <div
            className={`
              border-l-4 rounded-lg p-4 transition-all
              ${PRIORITY_STYLES[task.priority]}
              ${task.status === 'completed' ? 'opacity-75' : ''}
              ${task.status === 'skipped' ? 'opacity-50' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              {/* 체크박스 */}
              <button
                onClick={() => handleCheckboxClick(task)}
                disabled={!editable}
                className={`
                  flex-shrink-0 w-6 h-6 rounded-md border-2
                  flex items-center justify-center transition-all
                  ${STATUS_CHECKBOX_STYLES[task.status]}
                  ${editable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                `}
              >
                {task.status === 'completed' && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {task.status === 'skipped' && (
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {task.status === 'in_progress' && (
                  <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                )}
              </button>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 카테고리 배지 */}
                  <span className="text-sm">
                    {CATEGORY_CONFIG[task.category]?.icon}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                    {CATEGORY_CONFIG[task.category]?.label}
                  </span>

                  {/* 예상 시간 */}
                  {task.estimated_minutes && (
                    <span className="text-xs text-gray-500">
                      ~{task.estimated_minutes}분
                    </span>
                  )}
                </div>

                {/* 제목 */}
                <h4
                  className={`
                    font-medium mt-1
                    ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-800'}
                  `}
                >
                  {task.title}
                </h4>

                {/* 설명 */}
                {task.description && (
                  <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                )}

                {/* 학습 자료 정보 */}
                {(task.source || task.page_range || task.problem_numbers) && (
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                    {task.source && (
                      <span className="px-2 py-1 bg-white rounded border">
                        {task.source}
                      </span>
                    )}
                    {task.page_range && (
                      <span className="px-2 py-1 bg-white rounded border">
                        p.{task.page_range}
                      </span>
                    )}
                    {task.problem_numbers && (
                      <span className="px-2 py-1 bg-white rounded border">
                        #{task.problem_numbers}
                      </span>
                    )}
                  </div>
                )}

                {/* 완료 정보 */}
                {task.status === 'completed' && task.completed_at && (
                  <div className="mt-2 text-xs text-gray-500">
                    완료: {new Date(task.completed_at).toLocaleDateString('ko-KR')}
                    {task.actual_minutes && ` (${task.actual_minutes}분 소요)`}
                    {task.difficulty_feedback && (
                      <span className="ml-2">
                        {task.difficulty_feedback === 'easy' && '쉬웠음'}
                        {task.difficulty_feedback === 'appropriate' && '적절함'}
                        {task.difficulty_feedback === 'hard' && '어려웠음'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 피드백 입력 폼 (확장 시) */}
          {expandedTaskId === task.id && (
            <div className="mt-2 ml-9 p-4 bg-white border rounded-lg shadow-sm">
              <h5 className="font-medium text-gray-700 mb-3">완료 피드백</h5>

              <div className="space-y-3">
                {/* 소요 시간 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    실제 소요 시간 (분)
                  </label>
                  <input
                    type="number"
                    value={feedbackData.actual_minutes}
                    onChange={(e) => setFeedbackData({
                      ...feedbackData,
                      actual_minutes: e.target.value,
                    })}
                    className="w-24 px-3 py-1 border rounded-lg text-sm"
                    placeholder={task.estimated_minutes?.toString() || ''}
                  />
                </div>

                {/* 난이도 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    난이도는 어땠나요?
                  </label>
                  <div className="flex gap-2">
                    {(['easy', 'appropriate', 'hard'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setFeedbackData({
                          ...feedbackData,
                          difficulty_feedback: level,
                        })}
                        className={`
                          px-3 py-1 text-sm rounded-lg border transition-colors
                          ${feedbackData.difficulty_feedback === level
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }
                        `}
                      >
                        {level === 'easy' && '쉬웠어요'}
                        {level === 'appropriate' && '적절해요'}
                        {level === 'hard' && '어려웠어요'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    추가 메모 (선택)
                  </label>
                  <textarea
                    value={feedbackData.completion_note}
                    onChange={(e) => setFeedbackData({
                      ...feedbackData,
                      completion_note: e.target.value,
                    })}
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    rows={2}
                    placeholder="어려웠던 점이나 기억할 내용을 메모하세요"
                  />
                </div>

                {/* 버튼 */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleFeedbackSubmit(task.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    완료
                  </button>
                  <button
                    onClick={() => handleSkip(task.id)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={() => setExpandedTaskId(null)}
                    className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
