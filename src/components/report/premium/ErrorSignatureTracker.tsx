'use client';

/**
 * ErrorSignatureTracker Component
 *
 * 오답 서명(Error Signature) 심층 분석 및 추적
 * - 단순히 '계산 실수'가 아니라 '분수 덧셈에서 통분 후 분자 곱셈 누락'처럼 핀포인트
 * - 오류 패턴의 반복/해결 추적
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - "오답 서명 심층 분석"
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  Hash,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Info,
} from 'lucide-react';

type ErrorStatus = 'recurring' | 'active' | 'improving' | 'resolved';
type ErrorCategory = 'concept' | 'calculation' | 'interpretation' | 'habit' | 'careless';

interface ErrorSignature {
  id: string;
  signature: string;
  category: ErrorCategory;
  status: ErrorStatus;
  occurrenceCount: number;
  lastOccurrence?: string;
  firstDetected?: string;
  frequency: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  details?: string;
  affectedProblems?: number[];
  resolution?: string;
}

interface ErrorSignatureTrackerProps {
  signatures: ErrorSignature[];
  studentName?: string;
  testName?: string;
  showResolved?: boolean;
}

const STATUS_CONFIG: Record<ErrorStatus, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
  label: string;
  emoji: string;
}> = {
  recurring: {
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    icon: AlertTriangle,
    label: '반복 발생',
    emoji: '🔴',
  },
  active: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Zap,
    label: '활성',
    emoji: '🟡',
  },
  improving: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: TrendingUp,
    label: '개선 중',
    emoji: '🔵',
  },
  resolved: {
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: CheckCircle2,
    label: '해결됨',
    emoji: '🟢',
  },
};

const CATEGORY_CONFIG: Record<ErrorCategory, {
  label: string;
  description: string;
  color: string;
}> = {
  concept: { label: '개념 오류', description: '수학 개념 이해 부족', color: 'bg-violet-100 text-violet-700' },
  calculation: { label: '계산 오류', description: '연산 과정 실수', color: 'bg-rose-100 text-rose-700' },
  interpretation: { label: '해석 오류', description: '문제 조건 파악 실패', color: 'bg-amber-100 text-amber-700' },
  habit: { label: '습관 오류', description: '풀이 습관 문제', color: 'bg-blue-100 text-blue-700' },
  careless: { label: '부주의', description: '단순 실수', color: 'bg-slate-100 text-slate-700' },
};

function SignatureCard({
  signature,
  index,
}: {
  signature: ErrorSignature;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[signature.status];
  const categoryConfig = CATEGORY_CONFIG[signature.category];
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      className={`${statusConfig.bgColor} rounded-xl border ${statusConfig.borderColor} overflow-hidden`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Status Icon */}
            <div className={`p-2 rounded-lg ${statusConfig.bgColor} border ${statusConfig.borderColor}`}>
              <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
            </div>

            <div className="flex-1">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{statusConfig.emoji}</span>
                <span className={`text-xs font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${categoryConfig.color}`}>
                  {categoryConfig.label}
                </span>
              </div>

              {/* Signature */}
              <h4 className={`font-semibold ${statusConfig.color} text-sm leading-snug`}>
                {signature.signature}
              </h4>

              {/* Quick Stats */}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {signature.occurrenceCount}회 발생
                </span>
                {signature.lastOccurrence && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    최근: {signature.lastOccurrence}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Frequency Bar */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-1">발생 빈도</div>
              <div className="flex items-center gap-1">
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      signature.frequency >= 80 ? 'bg-rose-500' :
                      signature.frequency >= 50 ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${signature.frequency}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">{signature.frequency}%</span>
              </div>
            </div>

            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="text-slate-400"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </div>
        </div>

        {/* Trend Indicator */}
        <div className="flex items-center gap-2 mt-3">
          {signature.trend === 'increasing' && (
            <span className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              빈도 증가 중 - 주의 필요
            </span>
          )}
          {signature.trend === 'decreasing' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingDown className="w-3 h-3" />
              빈도 감소 중 - 개선 조짐
            </span>
          )}
          {signature.trend === 'stable' && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              빈도 유지 중
            </span>
          )}

          {signature.affectedProblems && signature.affectedProblems.length > 0 && (
            <span className="text-xs text-slate-500">
              영향 문항: {signature.affectedProblems.join(', ')}번
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-slate-200/50">
              {signature.details && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">상세 분석</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{signature.details}</p>
                </div>
              )}

              {signature.resolution && (
                <div className="bg-white/60 rounded-lg p-3 border border-slate-200/50">
                  <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    교정 전략
                  </p>
                  <p className="text-sm text-slate-700">{signature.resolution}</p>
                </div>
              )}

              {signature.firstDetected && (
                <p className="text-xs text-slate-400 mt-3">
                  첫 발견: {signature.firstDetected}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ErrorSignatureTracker({
  signatures,
  studentName,
  testName,
  showResolved = false,
}: ErrorSignatureTrackerProps) {
  const [showResolvedItems, setShowResolvedItems] = useState(showResolved);

  const activeSignatures = signatures.filter(s => s.status !== 'resolved');
  const resolvedSignatures = signatures.filter(s => s.status === 'resolved');
  const recurringCount = signatures.filter(s => s.status === 'recurring').length;
  const resolutionRate = signatures.length > 0
    ? Math.round((resolvedSignatures.length / signatures.length) * 100)
    : 0;

  const displaySignatures = showResolvedItems ? signatures : activeSignatures;

  if (signatures.length === 0) {
    return (
      <div className="bg-emerald-50 rounded-xl p-6 text-center border border-emerald-200">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <p className="text-emerald-700 font-medium">추적 중인 오류 패턴이 없어요!</p>
        <p className="text-emerald-600 text-sm mt-1">
          {studentName ? `${studentName} 학생이` : ''} 안정적인 풀이 패턴을 보이고 있습니다.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              오답 서명(Error Signature) 추적
              {testName && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {testName}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              반복되는 오류 패턴을 핀포인트로 분석합니다
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          {recurringCount > 0 && (
            <div className="text-center px-3 py-1 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-lg font-bold text-rose-600">{recurringCount}</div>
              <div className="text-xs text-rose-600">반복 오류</div>
            </div>
          )}
          <div className="text-center px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-lg font-bold text-emerald-600">{resolutionRate}%</div>
            <div className="text-xs text-emerald-600">해결률</div>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = signatures.filter(s => s.status === status as ErrorStatus).length;
          return (
            <div key={status} className={`${config.bgColor} rounded-lg p-2 text-center border ${config.borderColor}`}>
              <div className={`text-lg font-bold ${config.color}`}>{count}</div>
              <div className={`text-xs ${config.color}`}>{config.emoji} {config.label}</div>
            </div>
          );
        })}
      </div>

      {/* Signature Cards */}
      <div className="space-y-3">
        {displaySignatures.map((signature, index) => (
          <SignatureCard key={signature.id} signature={signature} index={index} />
        ))}
      </div>

      {/* Show Resolved Toggle */}
      {resolvedSignatures.length > 0 && (
        <button
          onClick={() => setShowResolvedItems(!showResolvedItems)}
          className="w-full mt-4 py-2 text-sm text-slate-600 hover:text-slate-800 flex items-center justify-center gap-1 border-t border-slate-100 pt-4"
        >
          {showResolvedItems ? (
            <>
              <ChevronUp className="w-4 h-4" />
              해결된 오류 숨기기
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              해결된 오류 {resolvedSignatures.length}개 보기
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          <Info className="w-4 h-4 flex-shrink-0 text-slate-400 mt-0.5" />
          <p>
            <strong className="text-rose-600">🔴 반복 발생</strong> 오류는 즉각적인 개입이 필요합니다.
            해당 오류에 대한 맞춤 훈련을 진행하고 있습니다.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(ErrorSignatureTracker);
