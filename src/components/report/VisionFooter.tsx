'use client';

/**
 * VisionFooter Component
 *
 * 리포트 하단에 표시되는 미래 비전 및 성장 예측 섹션
 * - 단기/중기/장기 비전 표시
 * - 격려 메시지
 * - 성장 예측 차트
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Calendar, CalendarDays, CalendarRange, Flame } from 'lucide-react';
import type {
  FutureVisionExtended,
  GrowthPrediction,
  MacroAnalysis,
} from '@/types';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }
  },
};

const encouragementVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.5, duration: 0.4 }
  },
};

interface VisionFooterProps {
  // 확장된 미래 비전 (새 형식)
  futureVision?: FutureVisionExtended;
  // 기존 형식 호환
  legacyVision?: MacroAnalysis['futureVision'];
  // 성장 예측
  growthPredictions?: GrowthPrediction[];
  // 학생 이름 (격려 메시지 개인화)
  studentName: string;
  // 간소화 모드
  compact?: boolean;
}

function VisionFooter({
  futureVision,
  legacyVision,
  growthPredictions,
  studentName,
  compact = false,
}: VisionFooterProps) {
  // 데이터가 없으면 표시하지 않음
  if (!futureVision && !legacyVision && (!growthPredictions || growthPredictions.length === 0)) {
    return null;
  }

  // 확장된 비전 사용 또는 레거시 변환
  const vision = futureVision || convertLegacyVision(legacyVision);

  if (compact) {
    return (
      <motion.div
        className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-gray-800 mb-1">성장 비전</h4>
            <p className="text-sm text-gray-600">
              {vision?.encouragementMessage || `${studentName} 학생, 꾸준히 성장하고 있습니다!`}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-xl p-6 mt-8 shadow-sm"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Eye className="w-6 h-6 text-teal-600" />
        <h3 className="text-lg font-bold text-gray-800">미래 성장 비전</h3>
      </div>

      {/* Vision Timeline */}
      {vision && (
        <div className="space-y-4 mb-6">
          <motion.div variants={itemVariants}>
            <VisionTimelineItem
              timeframe="1개월"
              Icon={Calendar}
              goals={vision.shortTerm?.goals || []}
              predictedScore={vision.shortTerm?.predictedScore}
              confidenceLevel={vision.shortTerm?.confidenceLevel}
              milestones={vision.shortTerm?.milestones || []}
              color="emerald"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <VisionTimelineItem
              timeframe="3개월"
              Icon={CalendarDays}
              goals={vision.midTerm?.goals || []}
              predictedScore={vision.midTerm?.predictedScore}
              confidenceLevel={vision.midTerm?.confidenceLevel}
              milestones={vision.midTerm?.milestones || []}
              color="teal"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <VisionTimelineItem
              timeframe="6개월~1년"
              Icon={CalendarRange}
              goals={vision.longTerm?.goals || []}
              predictedScore={vision.longTerm?.predictedScore}
              confidenceLevel={vision.longTerm?.confidenceLevel}
              milestones={vision.longTerm?.milestones || []}
              color="cyan"
            />
          </motion.div>
        </div>
      )}

      {/* Growth Predictions Chart */}
      {growthPredictions && growthPredictions.length > 0 && (
        <div className="bg-white/50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">예상 성장 곡선</h4>
          <div className="flex items-end justify-between h-32 px-4">
            {growthPredictions.map((pred, idx) => (
              <GrowthBar
                key={idx}
                timeframe={pred.timeframe}
                score={pred.predictedScore}
                confidence={pred.confidenceLevel}
                maxScore={100}
              />
            ))}
          </div>
        </div>
      )}

      {/* Growth Narrative */}
      {vision?.growthNarrative && (
        <div className="bg-white/30 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">성장 경로</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            {vision.growthNarrative}
          </p>
        </div>
      )}

      {/* Encouragement Message */}
      <motion.div
        className="bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg p-4"
        variants={encouragementVariants}
      >
        <div className="flex items-start gap-3">
          <Flame className="w-6 h-6 text-amber-500 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-800 mb-1">
              {studentName} 학생에게
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed">
              {vision?.encouragementMessage ||
                legacyVision?.encouragement ||
                `${studentName} 학생, 지금처럼만 꾸준히 노력하면 반드시 목표를 달성할 수 있습니다.
                작은 진전도 모두 의미 있는 성장입니다. 화이팅!`}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default memo(VisionFooter);

interface VisionTimelineItemProps {
  timeframe: string;
  Icon: React.ComponentType<{ className?: string }>;
  goals: string[];
  predictedScore?: number;
  confidenceLevel?: number;
  milestones: string[];
  color: 'emerald' | 'teal' | 'cyan';
}

function VisionTimelineItem({
  timeframe,
  Icon,
  goals,
  predictedScore,
  confidenceLevel,
  milestones,
  color,
}: VisionTimelineItemProps) {
  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-100',
      border: 'border-emerald-300',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    teal: {
      bg: 'bg-teal-100',
      border: 'border-teal-300',
      text: 'text-teal-700',
      dot: 'bg-teal-500',
    },
    cyan: {
      bg: 'bg-cyan-100',
      border: 'border-cyan-300',
      text: 'text-cyan-700',
      dot: 'bg-cyan-500',
    },
  };

  const colors = colorClasses[color];

  return (
    <div className="flex gap-4">
      {/* Timeline Dot */}
      <div className="flex flex-col items-center">
        <div className={`w-4 h-4 rounded-full ${colors.dot}`} />
        <div className={`w-0.5 flex-1 ${colors.bg}`} />
      </div>

      {/* Content */}
      <div className={`flex-1 ${colors.bg} rounded-lg p-4 border ${colors.border}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${colors.text}`} />
            <span className={`font-semibold ${colors.text}`}>{timeframe} 후</span>
          </div>
          {predictedScore && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600">예상 점수:</span>
              <span className="font-bold text-gray-700">{predictedScore}점</span>
              {confidenceLevel && (
                <span className="text-xs text-gray-500">
                  (신뢰도 {confidenceLevel}%)
                </span>
              )}
            </div>
          )}
        </div>

        {goals.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-gray-600 mb-1">목표</p>
            <ul className="text-sm text-gray-700 space-y-1">
              {goals.slice(0, 3).map((goal, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {milestones.length > 0 && (
          <div>
            <p className="text-xs text-gray-600 mb-1">마일스톤</p>
            <div className="flex flex-wrap gap-1">
              {milestones.slice(0, 4).map((milestone, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-white/50 text-gray-600 px-2 py-0.5 rounded"
                >
                  {milestone}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface GrowthBarProps {
  timeframe: string;
  score: number;
  confidence: number;
  maxScore: number;
}

function GrowthBar({ timeframe, score, confidence, maxScore }: GrowthBarProps) {
  const heightPercent = (score / maxScore) * 100;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-12 flex items-end">
        {/* Confidence Range */}
        <div
          className="absolute w-full bg-teal-200 rounded-t opacity-50"
          style={{
            height: `${heightPercent + (100 - confidence) / 5}%`,
            bottom: 0,
          }}
        />
        {/* Main Bar */}
        <div
          className="w-full bg-gradient-to-t from-teal-500 to-emerald-400 rounded-t"
          style={{ height: `${heightPercent}%` }}
        />
        {/* Score Label */}
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold text-gray-700">
          {score}
        </span>
      </div>
      <span className="text-xs text-gray-500">{timeframe}</span>
    </div>
  );
}

/**
 * 레거시 비전 형식을 확장 형식으로 변환
 */
function convertLegacyVision(
  legacy?: MacroAnalysis['futureVision']
): FutureVisionExtended | undefined {
  if (!legacy) return undefined;

  return {
    shortTerm: {
      timeframe: '1개월',
      goals: [],
      confidenceLevel: 70,
      milestones: [],
    },
    midTerm: {
      timeframe: '3개월',
      goals: legacy.threeMonths ? [legacy.threeMonths] : [],
      confidenceLevel: 60,
      milestones: [],
    },
    longTerm: {
      timeframe: '6개월',
      goals: legacy.sixMonths ? [legacy.sixMonths] : [],
      confidenceLevel: 50,
      milestones: legacy.longTerm ? [legacy.longTerm] : [],
    },
    growthNarrative: legacy.longTerm || '',
    encouragementMessage: legacy.encouragement || '',
  };
}
