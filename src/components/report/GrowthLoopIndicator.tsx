'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  FileText,
  Calendar,
  CalendarDays,
  BarChart3,
  TrendingUp,
  ClipboardList,
  RefreshCw,
  Trophy,
  AlertTriangle,
  MapPin,
  Rocket,
  TrendingDown,
  Lightbulb,
  Flag,
  Sparkles,
  Star,
  BookOpen,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * GrowthLoopIndicator Component
 *
 * 리포트가 Growth Loop 시스템에서 어떤 위치에 있는지 표시
 * - Baseline (레벨 테스트)
 * - Micro Loop (시험, 주간, 월간)
 * - Macro Loop (반기, 연간)
 */

type ReportType = 'level_test' | 'test' | 'weekly' | 'monthly' | 'semi_annual' | 'annual' | 'consolidated';

interface GrowthLoopIndicatorProps {
  reportType: ReportType;
  baselineDate?: string;
  hasBaseline?: boolean;
  compact?: boolean;
}

const LOOP_INFO: Record<ReportType, {
  loop: 'baseline' | 'micro' | 'macro';
  label: string;
  Icon: LucideIcon;
  description: string;
  color: string;
}> = {
  level_test: {
    loop: 'baseline',
    label: 'Baseline (t₀)',
    Icon: Target,
    description: '학습 기준점 설정',
    color: 'indigo',
  },
  test: {
    loop: 'micro',
    label: 'Micro Loop',
    Icon: FileText,
    description: '시험 분석 → 전술적 개선',
    color: 'blue',
  },
  weekly: {
    loop: 'micro',
    label: 'Micro Loop',
    Icon: Calendar,
    description: '주간 전술 실행 피드백',
    color: 'blue',
  },
  monthly: {
    loop: 'micro',
    label: 'Micro Loop',
    Icon: CalendarDays,
    description: '월간 전술 점검 및 조정',
    color: 'blue',
  },
  semi_annual: {
    loop: 'macro',
    label: 'Macro Loop',
    Icon: BarChart3,
    description: '반기 전략 피봇 분석',
    color: 'purple',
  },
  annual: {
    loop: 'macro',
    label: 'Macro Loop',
    Icon: TrendingUp,
    description: '연간 성장 서사 완성',
    color: 'purple',
  },
  consolidated: {
    loop: 'macro',
    label: 'Macro Loop',
    Icon: ClipboardList,
    description: '통합 분석',
    color: 'purple',
  },
};

const LOOP_COLORS = {
  baseline: {
    bg: 'bg-gradient-to-br from-indigo-50 to-violet-50',
    border: 'border-indigo-200/60',
    text: 'text-indigo-700',
    badge: 'bg-indigo-100/80 text-indigo-800 border border-indigo-200/50',
    icon: 'text-indigo-600',
    glow: 'shadow-indigo-100',
  },
  micro: {
    bg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
    border: 'border-blue-200/60',
    text: 'text-blue-700',
    badge: 'bg-blue-100/80 text-blue-800 border border-blue-200/50',
    icon: 'text-blue-600',
    glow: 'shadow-blue-100',
  },
  macro: {
    bg: 'bg-gradient-to-br from-purple-50 to-fuchsia-50',
    border: 'border-purple-200/60',
    text: 'text-purple-700',
    badge: 'bg-purple-100/80 text-purple-800 border border-purple-200/50',
    icon: 'text-purple-600',
    glow: 'shadow-purple-100',
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }
  },
};

const iconVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 20, delay: 0.1 }
  },
};

function GrowthLoopIndicator({
  reportType,
  baselineDate,
  hasBaseline = true,
  compact = false,
}: GrowthLoopIndicatorProps) {
  const info = LOOP_INFO[reportType];
  const colors = LOOP_COLORS[info.loop];
  const IconComponent = info.Icon;

  const showBaselineWarning = !hasBaseline && reportType !== 'level_test';

  if (compact) {
    return (
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${colors.badge}`}>
          <IconComponent className="w-3.5 h-3.5" />
          {info.label}
        </span>
        {showBaselineWarning && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            Baseline 미설정
          </span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`rounded-xl p-5 mb-6 ${colors.bg} border ${colors.border} shadow-lg ${colors.glow} backdrop-blur-sm`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            className={`p-3 rounded-xl ${colors.bg} border ${colors.border} shadow-sm`}
            variants={iconVariants}
            initial="hidden"
            animate="visible"
          >
            <IconComponent className={`w-6 h-6 ${colors.icon}`} />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${colors.text}`}>
                {info.label}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${colors.badge}`}>
                {reportType === 'level_test' ? '기준점' :
                 info.loop === 'micro' ? '전술 루프' : '전략 루프'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">{info.description}</p>
          </div>
        </div>

        <div className="text-right">
          {reportType === 'level_test' ? (
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              이 리포트가 Baseline입니다
            </div>
          ) : hasBaseline && baselineDate ? (
            <div>
              <div className="text-xs text-slate-500">Baseline 기준</div>
              <div className="text-sm font-medium text-slate-700">
                {new Date(baselineDate).toLocaleDateString('ko-KR')}
              </div>
            </div>
          ) : showBaselineWarning ? (
            <motion.div
              className="text-xs text-amber-700 bg-amber-50/80 px-3 py-2 rounded-lg border border-amber-200/50 backdrop-blur-sm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Baseline(레벨테스트) 미설정
              </div>
              <span className="text-amber-600 block mt-0.5">성장 측정이 불완전합니다</span>
            </motion.div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-200/50">
        <div className="flex items-center justify-center gap-3 text-xs">
          <motion.span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${reportType === 'level_test' ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-slate-500'}`}
            whileHover={{ scale: 1.05 }}
          >
            <Target className="w-3.5 h-3.5" />
            Baseline
          </motion.span>
          <div className="w-6 h-px bg-slate-300" />
          <motion.span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${info.loop === 'micro' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-500'}`}
            whileHover={{ scale: 1.05 }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Micro Loop
          </motion.span>
          <div className="w-6 h-px bg-slate-300" />
          <motion.span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${info.loop === 'macro' ? 'bg-purple-100 text-purple-700 font-semibold' : 'text-slate-500'}`}
            whileHover={{ scale: 1.05 }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Macro Loop
          </motion.span>
          <div className="w-6 h-px bg-slate-300" />
          <motion.span
            className="flex items-center gap-1.5 text-slate-500 px-2.5 py-1"
            whileHover={{ scale: 1.05 }}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Goal
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * BaselineReferenceCard Component
 */
interface BaselineReferenceCardProps {
  baselineScore?: number;
  currentScore?: number;
  baselineDate?: string;
  studentName?: string;
}

export function BaselineReferenceCard({
  baselineScore,
  currentScore,
  baselineDate,
  studentName,
}: BaselineReferenceCardProps) {
  const daysSinceBaseline = baselineDate
    ? Math.floor((new Date().getTime() - new Date(baselineDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (!baselineScore) {
    return (
      <motion.div
        className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-5 mb-6 shadow-lg shadow-amber-100/50 backdrop-blur-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-100/80 border border-amber-200/50">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-800">Baseline 미설정</h4>
            <p className="text-sm text-amber-700 mt-1">
              {studentName ? `${studentName} 학생의 ` : ''}레벨 테스트를 먼저 진행하여 학습 기준점을 설정해주세요.
              <br />
              <span className="text-amber-600">Baseline이 설정되어야 정확한 성장 측정이 가능합니다.</span>
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const growth = currentScore && baselineScore
    ? Math.round(((currentScore - baselineScore) / baselineScore) * 100)
    : 0;

  const GrowthIcon = growth >= 10 ? Rocket : growth >= 0 ? TrendingUp : TrendingDown;
  const growthColor = growth >= 10 ? 'text-emerald-600' : growth >= 0 ? 'text-blue-600' : 'text-rose-600';

  return (
    <motion.div
      className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200/60 rounded-xl p-5 mb-6 shadow-lg shadow-indigo-100/50 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-indigo-600" />
        <h4 className="font-semibold text-slate-800">Baseline 대비 현재 위치</h4>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <motion.div
          className="bg-white/60 rounded-xl p-4 border border-indigo-100/50 backdrop-blur-sm"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className="text-xs text-slate-500">Baseline (t₀)</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{baselineScore}점</div>
          {baselineDate && (
            <div className="text-xs text-slate-400 mt-1">
              {new Date(baselineDate).toLocaleDateString('ko-KR')}
            </div>
          )}
        </motion.div>

        <motion.div
          className="flex flex-col items-center justify-center bg-white/60 rounded-xl p-4 border border-indigo-100/50 backdrop-blur-sm"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className={`text-lg font-bold ${growthColor}`}>
            {growth >= 0 ? '+' : ''}{growth}%
          </div>
          <GrowthIcon className={`w-6 h-6 ${growthColor} mt-1`} />
          {daysSinceBaseline > 0 && (
            <div className="text-xs text-slate-400 mt-1">{daysSinceBaseline}일 경과</div>
          )}
        </motion.div>

        <motion.div
          className="bg-white/60 rounded-xl p-4 border border-indigo-100/50 backdrop-blur-sm"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className="text-xs text-slate-500">현재</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{currentScore || '-'}점</div>
          <div className="text-xs text-slate-400 mt-1">지금</div>
        </motion.div>
      </div>

      <div className="mt-4 pt-4 border-t border-indigo-100/50 text-center">
        <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
          {growth >= 20 ? <><Star className="w-4 h-4 text-amber-500" /> 탁월한 성장을 보여주고 있습니다!</> :
           growth >= 10 ? <><Sparkles className="w-4 h-4 text-violet-500" /> 꾸준히 성장하고 있습니다!</> :
           growth >= 0 ? <><BookOpen className="w-4 h-4 text-blue-500" /> 조금씩 발전하고 있습니다.</> :
           <><Zap className="w-4 h-4 text-amber-500" /> 포기하지 마세요! 곧 성장 곡선이 올라갑니다.</>}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * VisionDistanceFooter Component
 */
interface VisionDistanceFooterProps {
  currentScore?: number;
  targetScore?: number;
  targetDate?: string;
  studentName: string;
  reportType: ReportType;
}

export function VisionDistanceFooter({
  currentScore,
  targetScore = 90,
  targetDate,
  studentName,
  reportType,
}: VisionDistanceFooterProps) {
  const progress = currentScore && targetScore
    ? Math.min(100, Math.round((currentScore / targetScore) * 100))
    : 0;

  const remaining = targetScore && currentScore
    ? Math.max(0, targetScore - currentScore)
    : targetScore;

  const getNextStep = () => {
    switch (reportType) {
      case 'level_test':
        return '다음 단계: 첫 시험 분석으로 학습 전략을 수립하세요';
      case 'test':
        return '다음 단계: 주간 리포트에서 실행 결과를 확인하세요';
      case 'weekly':
        return '다음 단계: 월간 리포트에서 종합 점검을 진행하세요';
      case 'monthly':
        return '다음 단계: 다음 시험 분석으로 성장을 확인하세요';
      case 'semi_annual':
        return '다음 단계: 후반기 전략을 수립하고 실행하세요';
      case 'annual':
        return '다음 단계: 새 학년 레벨 테스트로 새로운 Baseline을 설정하세요';
      default:
        return '꾸준한 학습으로 목표를 달성하세요';
    }
  };

  return (
    <motion.div
      className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-xl p-6 mt-6 shadow-lg shadow-emerald-100/50 border border-emerald-200/60 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Flag className="w-5 h-5 text-emerald-600" />
        <h4 className="font-semibold text-slate-800">목표까지의 거리</h4>
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-600">현재: {currentScore || 0}점</span>
          <span className="text-emerald-600 font-medium">목표: {targetScore}점</span>
        </div>
        <div className="h-3 bg-slate-200/60 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>시작</span>
          <span className="font-medium text-emerald-600">{progress}% 달성</span>
          <span>목표</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <motion.div
          className="bg-white/60 rounded-xl p-4 text-center border border-emerald-100/50 backdrop-blur-sm"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className="text-xs text-slate-500">남은 거리</div>
          <div className="text-xl font-bold text-teal-600 mt-1">{remaining}점</div>
        </motion.div>
        <motion.div
          className="bg-white/60 rounded-xl p-4 text-center border border-emerald-100/50 backdrop-blur-sm"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className="text-xs text-slate-500">예상 도달</div>
          <div className="text-xl font-bold text-cyan-600 mt-1">
            {targetDate || '목표 달성 예정'}
          </div>
        </motion.div>
      </div>

      <div className="bg-white/40 rounded-xl p-4 border border-emerald-100/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-slate-700">{getNextStep()}</p>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-teal-700">
          {studentName} 학생, {progress >= 80 ? '거의 다 왔어요! 조금만 더!' :
            progress >= 50 ? '절반을 넘었어요! 화이팅!' :
            progress >= 20 ? '좋은 출발이에요! 꾸준히 가요!' :
            '첫 걸음을 뗐어요! 함께 목표를 향해 가요!'}
        </p>
      </div>
    </motion.div>
  );
}

export default memo(GrowthLoopIndicator);
