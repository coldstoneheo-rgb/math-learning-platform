'use client';

/**
 * AnnualGrowthStory Component
 *
 * 연간 성장 스토리 — 타임라인 형태로 1년 여정 시각화
 * - 시작/종료 상태 카드
 * - 주요 마일스톤 & 전환점 타임라인
 * - 성장 카테고리 배지 (exceptional/excellent/good/steady/needs_attention)
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Star, Zap, TrendingUp, ArrowRight, Flag } from 'lucide-react';

interface Milestone {
  date: string;
  milestone: string;
  significance: string;
}

interface TurningPoint {
  date: string;
  event: string;
  impact: string;
}

interface StateSnapshot {
  date: string;
  description: string;
  keyMetrics?: Record<string, number>;
}

export interface GrowthStoryData {
  beginningState: StateSnapshot;
  majorMilestones: Milestone[];
  turningPoints: TurningPoint[];
  endingState: StateSnapshot;
  narrativeSummary: string;
}

interface AnnualGrowthStoryProps {
  growthStory: GrowthStoryData;
  growthCategory?: 'exceptional' | 'excellent' | 'good' | 'steady' | 'needs_attention';
  overallGrowthRate?: number;
  compact?: boolean;
}

const CATEGORY_CONFIG = {
  exceptional: { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', label: '최우수 성장', emoji: '🏆' },
  excellent:   { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: '우수 성장', emoji: '🌟' },
  good:        { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: '양호한 성장', emoji: '📈' },
  steady:      { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: '꾸준한 성장', emoji: '➡️' },
  needs_attention: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: '집중 관리 필요', emoji: '💪' },
};

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 bg-white/70 rounded-full px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-200">
      {label}: <span className="font-bold">{value}</span>
    </span>
  );
}

function AnnualGrowthStory({ growthStory, growthCategory = 'good', overallGrowthRate, compact = false }: AnnualGrowthStoryProps) {
  if (!growthStory) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">성장 스토리 데이터가 없어요</p>
      </div>
    );
  }

  const cfg = CATEGORY_CONFIG[growthCategory];
  const allEvents = [
    ...growthStory.majorMilestones.map((m) => ({ ...m, kind: 'milestone' as const, text: m.milestone, sub: m.significance })),
    ...growthStory.turningPoints.map((t) => ({ ...t, kind: 'turning' as const, text: t.event, sub: t.impact })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <motion.div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">1년 성장 스토리</h3>
        </div>
        <div className="flex items-center gap-2">
          {overallGrowthRate !== undefined && (
            <span className="text-sm font-bold text-emerald-600">+{overallGrowthRate}% 성장</span>
          )}
          <span className={`text-xs px-2 py-1 rounded-full font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            {cfg.emoji} {cfg.label}
          </span>
        </div>
      </div>

      {/* Begin → End Summary */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 mb-5 items-center">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">{growthStory.beginningState.date} · 시작</p>
          <p className="text-sm text-gray-700 font-medium leading-snug">{growthStory.beginningState.description}</p>
          {growthStory.beginningState.keyMetrics && !compact && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(growthStory.beginningState.keyMetrics).slice(0, 3).map(([k, v]) => (
                <MetricPill key={k} label={k} value={v} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-indigo-400">
          <ArrowRight className="w-5 h-5" />
          <span className="text-xs text-gray-400">1년</span>
        </div>

        <div className={`${cfg.bg} rounded-xl p-3 border ${cfg.border}`}>
          <p className={`text-xs mb-1 ${cfg.color} opacity-70`}>{growthStory.endingState.date} · 현재</p>
          <p className={`text-sm font-medium leading-snug ${cfg.color}`}>{growthStory.endingState.description}</p>
          {growthStory.endingState.keyMetrics && !compact && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(growthStory.endingState.keyMetrics).slice(0, 3).map(([k, v]) => (
                <MetricPill key={k} label={k} value={v} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {!compact && allEvents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-3">주요 성장 이벤트</p>
          <div className="relative pl-5">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-3">
              {allEvents.map((ev, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="relative"
                >
                  <div className={`absolute -left-3 top-1 w-3 h-3 rounded-full border-2 border-white ${
                    ev.kind === 'milestone' ? 'bg-amber-400' : 'bg-indigo-400'
                  }`} />
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-start gap-2">
                      {ev.kind === 'milestone'
                        ? <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        : <Zap className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                      }
                      <div>
                        <span className="text-xs text-gray-400 mr-1">{ev.date}</span>
                        <span className="text-sm font-medium text-gray-700">{ev.text}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{ev.sub}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Narrative Summary */}
      <div className={`${cfg.bg} rounded-lg p-3 border ${cfg.border}`}>
        <div className="flex items-start gap-2">
          <Flag className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}`} />
          <p className={`text-sm leading-relaxed ${cfg.color}`}>{growthStory.narrativeSummary}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(AnnualGrowthStory);
