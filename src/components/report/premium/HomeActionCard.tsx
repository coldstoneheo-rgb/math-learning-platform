'use client';

/**
 * HomeActionCard Component
 *
 * 학부모 행동 유도 카드
 * - "이번 주말, 아이에게 칭찬할 포인트 1가지"
 * - "주의 깊게 관찰할 포인트 1가지"
 * - 극도로 구체적인 가정 내 가이드 제공
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - "Actionable Parenting"
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Heart,
  Eye,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
  ThumbsUp,
  Target,
} from 'lucide-react';

type ActionType = 'praise' | 'observe' | 'question' | 'activity';

interface ActionItem {
  type: ActionType;
  title: string;
  description: string;
  timing?: string;
  example?: string;
  importance?: 'high' | 'medium' | 'low';
}

interface HomeActionCardProps {
  studentName: string;
  praisePoint?: string;
  praiseExample?: string;
  observePoint?: string;
  questionToAsk?: string;
  weekendActivity?: string;
  actions?: ActionItem[];
  expanded?: boolean;
}

const ACTION_CONFIGS: Record<ActionType, {
  icon: typeof Heart;
  gradient: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  label: string;
  emoji: string;
}> = {
  praise: {
    icon: Heart,
    gradient: 'from-rose-500 to-pink-500',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    label: '칭찬 포인트',
    emoji: '💝',
  },
  observe: {
    icon: Eye,
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    label: '관찰 포인트',
    emoji: '👀',
  },
  question: {
    icon: MessageCircle,
    gradient: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    label: '대화 주제',
    emoji: '💬',
  },
  activity: {
    icon: Target,
    gradient: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    label: '주말 활동',
    emoji: '🎯',
  },
};

function ActionCard({ action, index }: { action: ActionItem; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = ACTION_CONFIGS[action.type];
  const Icon = config.icon;

  return (
    <motion.div
      className={`${config.bgColor} rounded-xl border ${config.borderColor} p-4 cursor-pointer`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={() => setIsExpanded(!isExpanded)}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${config.textColor} opacity-80`}>
              {config.emoji} {config.label}
            </span>
            {action.timing && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {action.timing}
              </span>
            )}
          </div>

          <h4 className={`font-semibold ${config.textColor} mt-1 text-sm leading-snug`}>
            {action.title}
          </h4>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className={`text-xs ${config.textColor} opacity-80 mt-2 leading-relaxed`}>
                  {action.description}
                </p>

                {action.example && (
                  <div className="mt-3 bg-white/60 rounded-lg p-3 border border-white/50">
                    <p className="text-xs text-slate-600 flex items-start gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-700">예시: </strong>
                        &ldquo;{action.example}&rdquo;
                      </span>
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className={`${config.textColor} opacity-50`}
          animate={{ rotate: isExpanded ? 180 : 0 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.div>
  );
}

function HomeActionCard({
  studentName,
  praisePoint,
  praiseExample,
  observePoint,
  questionToAsk,
  weekendActivity,
  actions: customActions,
  expanded = false,
}: HomeActionCardProps) {
  const [showAll, setShowAll] = useState(expanded);

  const defaultActions: ActionItem[] = [];

  if (praisePoint) {
    defaultActions.push({
      type: 'praise',
      title: praisePoint,
      description: `${studentName} 학생이 이번 주 특히 잘한 부분입니다. 구체적으로 칭찬해주세요.`,
      example: praiseExample || `"${studentName}아, 이번에 ${praisePoint} 정말 잘했더라! 노력한 게 보여서 엄마/아빠가 기뻐."`,
      timing: '식사 시간',
    });
  }

  if (observePoint) {
    defaultActions.push({
      type: 'observe',
      title: observePoint,
      description: '점수로 꾸중하지 마세요. 대신 이 부분을 주의 깊게 관찰해주세요.',
      timing: '학습 시간',
      importance: 'high',
    });
  }

  if (questionToAsk) {
    defaultActions.push({
      type: 'question',
      title: questionToAsk,
      description: '자연스러운 대화로 아이의 학습 상황을 파악할 수 있습니다.',
      example: questionToAsk,
      timing: '저녁 식사',
    });
  }

  if (weekendActivity) {
    defaultActions.push({
      type: 'activity',
      title: weekendActivity,
      description: '주말에 아이와 함께 할 수 있는 학습 연계 활동입니다.',
      timing: '주말',
    });
  }

  const allActions = customActions || defaultActions;
  const visibleActions = showAll ? allActions : allActions.slice(0, 2);

  if (allActions.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-lg border border-slate-200/60 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              가정 학습 가이드
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {studentName} 맞춤
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              이번 주 가정에서 실천해주세요
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          <span>{allActions.length}가지 액션</span>
        </div>
      </div>

      {/* Action Cards */}
      <div className="space-y-3">
        {visibleActions.map((action, index) => (
          <ActionCard key={index} action={action} index={index} />
        ))}
      </div>

      {/* Show More/Less Button */}
      {allActions.length > 2 && (
        <motion.button
          className="w-full mt-4 py-2 text-sm text-slate-600 hover:text-slate-800 flex items-center justify-center gap-1 border-t border-slate-100 pt-4"
          onClick={() => setShowAll(!showAll)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {allActions.length - 2}개 더 보기
            </>
          )}
        </motion.button>
      )}

      {/* Footer Tip */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          <ThumbsUp className="w-4 h-4 flex-shrink-0 text-slate-400 mt-0.5" />
          <p>
            <strong className="text-slate-600">Tip:</strong> 구체적인 행동을 칭찬하면 아이의 자존감과 학습 동기가 높아집니다.
            &ldquo;잘했어&rdquo;보다 &ldquo;어려운 문제를 끝까지 풀어본 게 대단해&rdquo;가 더 효과적입니다.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(HomeActionCard);
