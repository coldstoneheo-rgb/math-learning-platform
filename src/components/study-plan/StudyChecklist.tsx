'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Pencil,
  Library,
  FileText,
  Target,
  Rocket,
  Pin,
  Check,
  X,
  Clock,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

const CATEGORY_CONFIG: Record<StudyTaskCategory, { Icon: LucideIcon; label: string; color: string }> = {
  concept_review: { Icon: BookOpen, label: '개념 복습', color: 'text-violet-600' },
  problem_solving: { Icon: Pencil, label: '문제 풀이', color: 'text-blue-600' },
  workbook: { Icon: Library, label: '교재 진도', color: 'text-emerald-600' },
  test_prep: { Icon: FileText, label: '시험 대비', color: 'text-amber-600' },
  weakness_practice: { Icon: Target, label: '취약점 연습', color: 'text-rose-600' },
  enrichment: { Icon: Rocket, label: '심화 학습', color: 'text-indigo-600' },
  custom: { Icon: Pin, label: '기타', color: 'text-slate-600' },
};

const PRIORITY_STYLES: Record<StudyTaskPriority, { border: string; bg: string; dot: string }> = {
  high: {
    border: 'border-l-rose-500',
    bg: 'bg-gradient-to-r from-rose-50 to-pink-50',
    dot: 'bg-rose-500',
  },
  medium: {
    border: 'border-l-amber-500',
    bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
    dot: 'bg-amber-500',
  },
  low: {
    border: 'border-l-blue-500',
    bg: 'bg-gradient-to-r from-blue-50 to-cyan-50',
    dot: 'bg-blue-500',
  },
};

const STATUS_CHECKBOX_STYLES: Record<StudyTaskStatus, string> = {
  pending: 'border-slate-300 bg-white hover:border-slate-400',
  in_progress: 'border-indigo-500 bg-indigo-100',
  completed: 'border-emerald-500 bg-emerald-500 text-white',
  skipped: 'border-slate-400 bg-slate-200',
};

const taskVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }
  }),
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

const checkboxVariants = {
  unchecked: { scale: 1 },
  checked: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.3 }
  },
};

const feedbackVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    marginTop: '0.5rem',
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2 }
  },
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
      onTaskStatusChange(task.id, 'pending');
    } else if (showFeedback) {
      setExpandedTaskId(task.id);
    } else {
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
    setFeedbackData({ completion_note: '', actual_minutes: '', difficulty_feedback: '' });
  };

  const handleSkip = (taskId: number) => {
    onTaskStatusChange(taskId, 'skipped');
    setExpandedTaskId(null);
  };

  if (tasks.length === 0) {
    return (
      <motion.div
        className="text-center py-12 text-slate-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Library className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>등록된 학습 항목이 없습니다.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {tasks.map((task, index) => {
          const categoryConfig = CATEGORY_CONFIG[task.category];
          const priorityStyles = PRIORITY_STYLES[task.priority];
          const CategoryIcon = categoryConfig?.Icon || Pin;

          return (
            <motion.div
              key={task.id}
              custom={index}
              variants={taskVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <motion.div
                className={`
                  border-l-4 rounded-xl p-4 transition-all shadow-sm hover:shadow-md
                  ${priorityStyles.border} ${priorityStyles.bg}
                  ${task.status === 'completed' ? 'opacity-75' : ''}
                  ${task.status === 'skipped' ? 'opacity-50' : ''}
                  backdrop-blur-sm border border-slate-200/50
                `}
                whileHover={{ scale: editable ? 1.01 : 1, y: editable ? -2 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="flex items-start gap-3">
                  <motion.button
                    onClick={() => handleCheckboxClick(task)}
                    disabled={!editable}
                    className={`
                      flex-shrink-0 w-6 h-6 rounded-lg border-2
                      flex items-center justify-center transition-all
                      ${STATUS_CHECKBOX_STYLES[task.status]}
                      ${editable ? 'cursor-pointer' : 'cursor-default'}
                    `}
                    variants={checkboxVariants}
                    animate={task.status === 'completed' ? 'checked' : 'unchecked'}
                    whileHover={editable ? { scale: 1.1 } : {}}
                    whileTap={editable ? { scale: 0.95 } : {}}
                  >
                    {task.status === 'completed' && <Check className="w-4 h-4" />}
                    {task.status === 'skipped' && <X className="w-4 h-4 text-slate-500" />}
                    {task.status === 'in_progress' && (
                      <div className={`w-2 h-2 ${priorityStyles.dot} rounded-full`} />
                    )}
                  </motion.button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryIcon className={`w-4 h-4 ${categoryConfig?.color || 'text-slate-600'}`} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-slate-600 border border-slate-200/50 backdrop-blur-sm">
                        {categoryConfig?.label || '기타'}
                      </span>

                      {task.estimated_minutes && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          ~{task.estimated_minutes}분
                        </span>
                      )}
                    </div>

                    <h4 className={`
                      font-medium mt-1.5
                      ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800'}
                    `}>
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                    )}

                    {(task.source || task.page_range || task.problem_numbers) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {task.source && (
                          <span className="text-xs px-2 py-1 bg-white/80 rounded-lg border border-slate-200/50 text-slate-600 backdrop-blur-sm">
                            {task.source}
                          </span>
                        )}
                        {task.page_range && (
                          <span className="text-xs px-2 py-1 bg-white/80 rounded-lg border border-slate-200/50 text-slate-600 backdrop-blur-sm">
                            p.{task.page_range}
                          </span>
                        )}
                        {task.problem_numbers && (
                          <span className="text-xs px-2 py-1 bg-white/80 rounded-lg border border-slate-200/50 text-slate-600 backdrop-blur-sm">
                            #{task.problem_numbers}
                          </span>
                        )}
                      </div>
                    )}

                    {task.status === 'completed' && task.completed_at && (
                      <motion.div
                        className="mt-2 text-xs text-slate-500 flex items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Check className="w-3 h-3 text-emerald-500" />
                        완료: {new Date(task.completed_at).toLocaleDateString('ko-KR')}
                        {task.actual_minutes && ` (${task.actual_minutes}분 소요)`}
                        {task.difficulty_feedback && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100">
                            {task.difficulty_feedback === 'easy' && '쉬웠음'}
                            {task.difficulty_feedback === 'appropriate' && '적절함'}
                            {task.difficulty_feedback === 'hard' && '어려웠음'}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {showFeedback && task.status !== 'completed' && task.status !== 'skipped' && (
                    <motion.button
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      animate={{ rotate: expandedTaskId === task.id ? 180 : 0 }}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </motion.div>

              <AnimatePresence>
                {expandedTaskId === task.id && (
                  <motion.div
                    variants={feedbackVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="ml-9 p-4 bg-white rounded-xl shadow-lg border border-slate-200/50 backdrop-blur-sm overflow-hidden"
                  >
                    <h5 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      완료 피드백
                    </h5>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">
                          실제 소요 시간 (분)
                        </label>
                        <input
                          type="number"
                          value={feedbackData.actual_minutes}
                          onChange={(e) => setFeedbackData({
                            ...feedbackData,
                            actual_minutes: e.target.value,
                          })}
                          className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          placeholder={task.estimated_minutes?.toString() || ''}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">
                          난이도는 어땠나요?
                        </label>
                        <div className="flex gap-2">
                          {(['easy', 'appropriate', 'hard'] as const).map((level) => (
                            <motion.button
                              key={level}
                              onClick={() => setFeedbackData({
                                ...feedbackData,
                                difficulty_feedback: level,
                              })}
                              className={`
                                px-4 py-2 text-sm rounded-lg border transition-all
                                ${feedbackData.difficulty_feedback === level
                                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700 shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }
                              `}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {level === 'easy' && '쉬웠어요'}
                              {level === 'appropriate' && '적절해요'}
                              {level === 'hard' && '어려웠어요'}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">
                          추가 메모 (선택)
                        </label>
                        <textarea
                          value={feedbackData.completion_note}
                          onChange={(e) => setFeedbackData({
                            ...feedbackData,
                            completion_note: e.target.value,
                          })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          rows={2}
                          placeholder="어려웠던 점이나 기억할 내용을 메모하세요"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <motion.button
                          onClick={() => handleFeedbackSubmit(task.id)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          완료
                        </motion.button>
                        <motion.button
                          onClick={() => handleSkip(task.id)}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 transition-all"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          건너뛰기
                        </motion.button>
                        <motion.button
                          onClick={() => setExpandedTaskId(null)}
                          className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700 transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          취소
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
