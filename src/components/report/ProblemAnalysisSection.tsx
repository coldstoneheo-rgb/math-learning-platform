'use client';

/**
 * ProblemAnalysisSection — 문항별 분석 아코디언 카드
 *
 * 기존 테이블/단순카드 방식 대신 아코디언 + 스텝 인디케이터로
 * 모바일/PC 모두에서 가독성을 극대화합니다.
 *
 * 외부 의존성 없이 순수 React + Tailwind로 구현.
 *
 * @see docs/CODEX_REVIEW_FEEDBACK.md Phase 10
 */

import { memo, useState } from 'react';
import type { DetailedProblemAnalysis } from '@/types';
import { parseAnalysisToSteps, type AnalysisStep } from '@/lib/format-ai-text';

interface ProblemAnalysisCardProps {
  item: DetailedProblemAnalysis;
  /** 기본 펼침 여부 (오답이면 true) */
  defaultOpen?: boolean;
}

const CORRECT_BADGE = {
  O: { bg: 'bg-emerald-500', ringColor: 'ring-emerald-200' },
  X: { bg: 'bg-red-500', ringColor: 'ring-red-200' },
  '△': { bg: 'bg-amber-500', ringColor: 'ring-amber-200' },
  '-': { bg: 'bg-gray-400', ringColor: 'ring-gray-200' },
} as const;

const ERROR_TYPE_COLOR: Record<string, string> = {
  '개념 오류': 'bg-red-100 text-red-700',
  '절차 오류': 'bg-orange-100 text-orange-700',
  '계산 오류': 'bg-amber-100 text-amber-700',
  '문제 오독': 'bg-purple-100 text-purple-700',
  '기타/부주의': 'bg-gray-100 text-gray-600',
  'N/A': 'bg-gray-50 text-gray-400',
};

const STRATEGY_LABEL: Record<string, { text: string; color: string }> = {
  '최적 풀이': { text: '최적', color: 'text-emerald-600' },
  '차선 풀이': { text: '차선', color: 'text-amber-600' },
  '창의적 접근': { text: '창의적', color: 'text-blue-600' },
  'N/A': { text: '-', color: 'text-gray-400' },
};

function StepIndicator({ steps }: { steps: AnalysisStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          {/* 타임라인 */}
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-sm shrink-0">
              {step.emoji}
            </div>
            {i < steps.length - 1 && (
              <div className="w-px flex-1 bg-indigo-200 min-h-[16px]" />
            )}
          </div>
          {/* 콘텐츠 */}
          <div className="pb-4 min-w-0 flex-1">
            <p className="text-xs font-semibold text-indigo-600 mb-1">{step.label}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{step.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 화살표 SVG 아이콘 (lucide-react 대체) */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ProblemAnalysisCard({ item, defaultOpen = false }: ProblemAnalysisCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const badge = CORRECT_BADGE[item.isCorrect] || CORRECT_BADGE['-'];
  const errorColor = ERROR_TYPE_COLOR[item.errorType] || ERROR_TYPE_COLOR['N/A'];
  const strategy = STRATEGY_LABEL[item.solutionStrategy] || STRATEGY_LABEL['N/A'];
  const steps = parseAnalysisToSteps(item.analysis || '');
  const isWrong = item.isCorrect === 'X';

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isWrong
          ? 'border-red-200 bg-red-50/50'
          : item.isCorrect === '△'
          ? 'border-amber-200 bg-amber-50/30'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* 요약 헤더 — 항상 노출 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        {/* 정오 배지 */}
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm ring-2 ${badge.bg} ${badge.ringColor} shrink-0`}>
          {item.isCorrect}
        </span>

        {/* 문제 번호 + 핵심 개념 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">
              {item.problemNumber}번
            </span>
            <span className="text-sm text-gray-700 truncate">
              {item.keyConcept}
            </span>
          </div>
          {/* 메타 태그 */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.errorType && item.errorType !== 'N/A' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${errorColor}`}>
                {item.errorType}
              </span>
            )}
            {strategy.text !== '-' && (
              <span className={`text-xs font-medium ${strategy.color}`}>
                {strategy.text}
              </span>
            )}
          </div>
        </div>

        {/* 화살표 */}
        <ChevronDownIcon
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 상세 분석 — 펼치면 노출 (CSS transition) */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {steps.length > 0 && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100">
            <StepIndicator steps={steps} />
          </div>
        )}
      </div>
    </div>
  );
}

/** 문항별 분석 전체 섹션 */
interface ProblemAnalysisSectionProps {
  items: DetailedProblemAnalysis[];
}

function ProblemAnalysisSection({ items }: ProblemAnalysisSectionProps) {
  const [expandAll, setExpandAll] = useState(false);

  // 오답 개수
  const wrongCount = items.filter(i => i.isCorrect === 'X').length;
  const correctCount = items.filter(i => i.isCorrect === 'O').length;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📝 문항별 분석</h3>
          <p className="text-xs text-gray-500 mt-1">
            총 {items.length}문항 ·{' '}
            <span className="text-emerald-600 font-medium">정답 {correctCount}</span>{' · '}
            <span className="text-red-600 font-medium">오답 {wrongCount}</span>
          </p>
        </div>
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          {expandAll ? '모두 접기' : '모두 펼치기'}
        </button>
      </div>

      {/* 문항 카드 목록 */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <ProblemAnalysisCard
            key={index}
            item={item}
            defaultOpen={expandAll || item.isCorrect === 'X'}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(ProblemAnalysisSection);
export { ProblemAnalysisCard };
