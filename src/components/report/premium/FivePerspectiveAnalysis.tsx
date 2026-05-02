'use client';

/**
 * FivePerspectiveAnalysis Component
 *
 * 시험 분석 리포트의 5관점 심층 분석 카드 UI
 * 1️⃣ 사고의 출발점 분석
 * 2️⃣ 풀이 진행 과정 분석
 * 3️⃣ 계산 및 실수 패턴
 * 4️⃣ 문제 해석 능력
 * 5️⃣ 풀이 습관 관찰
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  GitBranch,
  Calculator,
  FileSearch,
  PenTool,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Info,
  BarChart3,
} from 'lucide-react';

type PerspectiveType = 'thinking_start' | 'solving_process' | 'calculation_pattern' | 'problem_interpretation' | 'solving_habit';

interface PerspectiveData {
  type: PerspectiveType;
  title: string;
  summary: string;
  details?: string;
  status: 'good' | 'warning' | 'critical';
  frequency?: number;
  trend?: 'improving' | 'stable' | 'declining';
  previousComparison?: string;
  examples?: string[];
}

interface FivePerspectiveAnalysisProps {
  perspectives: PerspectiveData[];
  studentName?: string;
  testName?: string;
  compact?: boolean;
}

const PERSPECTIVE_CONFIG: Record<PerspectiveType, {
  icon: typeof Lightbulb;
  label: string;
  shortLabel: string;
  gradient: string;
  description: string;
}> = {
  thinking_start: {
    icon: Lightbulb,
    label: '사고의 출발점',
    shortLabel: '사고출발점',
    gradient: 'from-amber-500 to-orange-500',
    description: '문제를 보고 가장 먼저 무엇을 시도했는가?',
  },
  solving_process: {
    icon: GitBranch,
    label: '풀이 진행 과정',
    shortLabel: '풀이과정',
    gradient: 'from-blue-500 to-indigo-500',
    description: '풀이의 어느 단계에서 막혔거나 틀렸는가?',
  },
  calculation_pattern: {
    icon: Calculator,
    label: '계산 및 실수 패턴',
    shortLabel: '계산패턴',
    gradient: 'from-rose-500 to-pink-500',
    description: '단순 계산 실수인가, 개념적 오류인가?',
  },
  problem_interpretation: {
    icon: FileSearch,
    label: '문제 해석 능력',
    shortLabel: '문제해석',
    gradient: 'from-emerald-500 to-teal-500',
    description: '문제의 조건을 정확히 파악했는가?',
  },
  solving_habit: {
    icon: PenTool,
    label: '풀이 습관 관찰',
    shortLabel: '풀이습관',
    gradient: 'from-violet-500 to-purple-500',
    description: '풀이 과정을 단계적으로 기록했는가?',
  },
};

const STATUS_CONFIG = {
  good: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircle2,
    label: '양호',
  },
  warning: {
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertTriangle,
    label: '주의',
  },
  critical: {
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: AlertTriangle,
    label: '집중 필요',
  },
};

function PerspectiveCard({
  perspective,
  isActive,
  onClick,
  index,
}: {
  perspective: PerspectiveData;
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  const config = PERSPECTIVE_CONFIG[perspective.type];
  const statusConfig = STATUS_CONFIG[perspective.status];
  const Icon = config.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      className={`cursor-pointer rounded-xl border-2 transition-all ${
        isActive
          ? `border-slate-300 shadow-lg bg-white`
          : `border-transparent bg-slate-50 hover:bg-slate-100`
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">{config.label}</h4>
              <p className="text-xs text-slate-500">{config.description}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed mb-2">{perspective.summary}</p>

        {perspective.frequency !== undefined && (
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${config.gradient}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, perspective.frequency * 20)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{perspective.frequency}/5문제</span>
          </div>
        )}

        {perspective.trend && (
          <div className="flex items-center gap-1 text-xs">
            {perspective.trend === 'improving' && (
              <span className="text-emerald-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                이전 대비 개선됨
              </span>
            )}
            {perspective.trend === 'declining' && (
              <span className="text-rose-600 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                이전 대비 악화
              </span>
            )}
            {perspective.trend === 'stable' && (
              <span className="text-slate-500 flex items-center gap-1">
                유지 중
              </span>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isActive && perspective.details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="p-4 bg-slate-50">
              <p className="text-sm text-slate-600 leading-relaxed mb-3">{perspective.details}</p>

              {perspective.examples && perspective.examples.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">관찰된 예시:</p>
                  {perspective.examples.map((example, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-white rounded-lg p-2 border border-slate-200">
                      <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                      {example}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FivePerspectiveAnalysis({
  perspectives,
  studentName,
  testName,
  compact = false,
}: FivePerspectiveAnalysisProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const criticalCount = perspectives.filter(p => p.status === 'critical').length;
  const warningCount = perspectives.filter(p => p.status === 'warning').length;
  const goodCount = perspectives.filter(p => p.status === 'good').length;

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              5관점 심층 분석
              {testName && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {testName}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              문제 풀이 과정을 5가지 관점에서 분석합니다
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
              집중 필요 {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
              주의 {warningCount}
            </span>
          )}
          {goodCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
              양호 {goodCount}
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation (Compact Mode) */}
      {compact && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          {perspectives.map((p, i) => {
            const config = PERSPECTIVE_CONFIG[p.type];
            const statusConfig = STATUS_CONFIG[p.status];
            return (
              <button
                key={p.type}
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeIndex === i
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-sm`
                    : `bg-slate-100 text-slate-600 hover:bg-slate-200`
                }`}
              >
                {config.shortLabel}
                <span className={`ml-1 ${activeIndex === i ? 'text-white/80' : statusConfig.color}`}>
                  {p.status === 'critical' ? '⚠️' : p.status === 'warning' ? '⚡' : '✓'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Perspective Cards */}
      <div className={compact ? '' : 'space-y-3'}>
        {compact ? (
          activeIndex !== null && (
            <PerspectiveCard
              perspective={perspectives[activeIndex]}
              isActive={true}
              onClick={() => {}}
              index={0}
            />
          )
        ) : (
          perspectives.map((perspective, index) => (
            <PerspectiveCard
              key={perspective.type}
              perspective={perspective}
              isActive={activeIndex === index}
              onClick={() => setActiveIndex(activeIndex === index ? null : index)}
              index={index}
            />
          ))
        )}
      </div>

      {/* Footer Tip */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          <Info className="w-4 h-4 flex-shrink-0 text-slate-400 mt-0.5" />
          <p>
            {criticalCount > 0 ? (
              <>
                <strong className="text-rose-600">집중 필요</strong> 영역이 {criticalCount}개 발견되었습니다.
                해당 영역에 대한 맞춤 훈련을 권장합니다.
              </>
            ) : warningCount > 0 ? (
              <>
                대부분 양호하나 <strong className="text-amber-600">주의</strong> 영역이 {warningCount}개 있습니다.
                지속적인 모니터링이 필요합니다.
              </>
            ) : (
              <>
                모든 영역에서 양호한 수준을 보이고 있습니다.
                {studentName && ` ${studentName} 학생, 잘하고 있어요!`}
              </>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(FivePerspectiveAnalysis);
