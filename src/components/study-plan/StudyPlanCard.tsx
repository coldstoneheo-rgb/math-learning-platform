'use client';

import React from 'react';
import type { StudyPlanSummary, StudyPlanStatus } from '@/types';

interface StudyPlanCardProps {
  plan: StudyPlanSummary;
  onClick?: () => void;
}

// 상태별 스타일 및 라벨
const STATUS_CONFIG: Record<StudyPlanStatus, {
  label: string;
  bgColor: string;
  textColor: string;
}> = {
  draft: {
    label: '작성 중',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
  },
  active: {
    label: '진행 중',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
  },
  completed: {
    label: '완료',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
  },
  cancelled: {
    label: '취소됨',
    bgColor: 'bg-red-100',
    textColor: 'text-red-600',
  },
};

// 기간 타입별 라벨
const PERIOD_TYPE_LABELS = {
  weekly: '주간',
  monthly: '월간',
  custom: '사용자 정의',
};

export default function StudyPlanCard({ plan, onClick }: StudyPlanCardProps) {
  const statusConfig = STATUS_CONFIG[plan.status];
  const periodLabel = PERIOD_TYPE_LABELS[plan.period_type];

  // 남은 일수 계산
  const today = new Date();
  const endDate = new Date(plan.end_date);
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 진행률 색상
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl border border-gray-200 p-4
        hover:shadow-md transition-shadow
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
              {periodLabel}
            </span>
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full
                ${statusConfig.bgColor} ${statusConfig.textColor}
              `}
            >
              {statusConfig.label}
            </span>
          </div>
          <h3 className="font-semibold text-gray-800">{plan.title}</h3>
        </div>

        {/* 남은 일수 표시 */}
        {plan.status === 'active' && daysRemaining > 0 && (
          <div className="text-right">
            <span className="text-2xl font-bold text-indigo-600">
              {daysRemaining}
            </span>
            <span className="text-xs text-gray-500 block">일 남음</span>
          </div>
        )}
      </div>

      {/* 기간 */}
      <p className="text-sm text-gray-500 mb-3">
        {new Date(plan.start_date).toLocaleDateString('ko-KR')} ~{' '}
        {new Date(plan.end_date).toLocaleDateString('ko-KR')}
      </p>

      {/* 진행률 */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">
            {plan.completed_tasks} / {plan.total_tasks} 완료
          </span>
          <span className="font-medium text-gray-800">
            {plan.progress_percentage}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor(plan.progress_percentage)}`}
            style={{ width: `${plan.progress_percentage}%` }}
          />
        </div>
      </div>

      {/* 학생 이름 (있는 경우) */}
      {plan.student_name && (
        <p className="text-xs text-gray-400 mt-2">
          {plan.student_name}
        </p>
      )}
    </div>
  );
}
