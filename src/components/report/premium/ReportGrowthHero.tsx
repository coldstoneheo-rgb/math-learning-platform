'use client';

/**
 * ReportGrowthHero Component
 *
 * 리포트의 Hero 섹션 - 성장 한 줄 요약
 * 학부모가 3초 만에 핵심 메시지를 파악할 수 있도록 설계
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Target,
  Award,
  AlertCircle,
  ChevronRight,
  Calendar,
  User,
} from 'lucide-react';
import type { ReportType } from '@/types';

interface ReportGrowthHeroProps {
  reportType: ReportType;
  studentName: string;
  reportDate: string;
  headline: string;
  subheadline?: string;
  currentScore?: number;
  previousScore?: number;
  targetScore?: number;
  percentile?: number;
  emotionType?: 'celebrate' | 'encourage' | 'neutral' | 'alert';
  reportNumber?: number;
}

const EMOTION_CONFIGS = {
  celebrate: {
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgGradient: 'from-emerald-50 via-teal-50 to-cyan-50',
    icon: Award,
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-200/60',
  },
  encourage: {
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    bgGradient: 'from-blue-50 via-indigo-50 to-violet-50',
    icon: TrendingUp,
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200/60',
  },
  neutral: {
    gradient: 'from-slate-500 via-gray-500 to-zinc-500',
    bgGradient: 'from-slate-50 via-gray-50 to-zinc-50',
    icon: Minus,
    iconColor: 'text-slate-600',
    borderColor: 'border-slate-200/60',
  },
  alert: {
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    bgGradient: 'from-amber-50 via-orange-50 to-red-50',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-200/60',
  },
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  level_test: '레벨 테스트',
  test: '시험 분석',
  weekly: '주간 리포트',
  monthly: '월간 리포트',
  semi_annual: '반기 리포트',
  annual: '연간 리포트',
  consolidated: '통합 분석',
};

function CountUpNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count}</span>;
}

function ReportGrowthHero({
  reportType,
  studentName,
  reportDate,
  headline,
  subheadline,
  currentScore,
  previousScore,
  targetScore,
  percentile,
  emotionType = 'neutral',
  reportNumber,
}: ReportGrowthHeroProps) {
  const config = EMOTION_CONFIGS[emotionType];
  const EmotionIcon = config.icon;

  const scoreDiff = currentScore && previousScore ? currentScore - previousScore : 0;
  const isImproved = scoreDiff > 0;
  const isDeclined = scoreDiff < 0;

  const formattedDate = new Date(reportDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.bgGradient} border ${config.borderColor} shadow-xl`}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full bg-gradient-to-br ${config.gradient} opacity-10 blur-3xl`} />
        <div className={`absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-gradient-to-br ${config.gradient} opacity-10 blur-2xl`} />
      </div>

      <div className="relative p-6 md:p-8">
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${config.gradient} text-white shadow-lg`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 500 }}
            >
              {REPORT_TYPE_LABELS[reportType]}
            </motion.span>
            {reportNumber && (
              <span className="text-xs text-slate-500 bg-white/60 px-2 py-1 rounded-full backdrop-blur-sm">
                #{reportNumber} 리포트
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            {formattedDate}
          </div>
        </div>

        {/* Student Info */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-slate-600" />
          </div>
          <span className="font-medium text-slate-700">{studentName} 학생</span>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Headline Section */}
          <div className="md:col-span-2">
            <motion.div
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={`p-3 rounded-xl bg-white/80 shadow-sm ${config.iconColor}`}>
                <EmotionIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight mb-2">
                  {headline}
                </h1>
                {subheadline && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {subheadline}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Quick Stats */}
            {(currentScore !== undefined || percentile !== undefined) && (
              <motion.div
                className="flex flex-wrap gap-3 mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {currentScore !== undefined && (
                  <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs text-slate-500 mb-1">현재 점수</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-800">
                        <CountUpNumber value={currentScore} />
                      </span>
                      <span className="text-sm text-slate-500">점</span>
                      {scoreDiff !== 0 && (
                        <span className={`text-sm font-medium ml-2 flex items-center ${isImproved ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isImproved ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                          {isImproved ? '+' : ''}{scoreDiff}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {percentile !== undefined && (
                  <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs text-slate-500 mb-1">학년 내 위치</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-slate-600">상위</span>
                      <span className="text-2xl font-bold text-indigo-600">
                        <CountUpNumber value={percentile} />
                      </span>
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  </div>
                )}

                {targetScore !== undefined && (
                  <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs text-slate-500 mb-1">목표 점수</div>
                    <div className="flex items-baseline gap-1">
                      <Target className="w-4 h-4 text-teal-600 mr-1" />
                      <span className="text-2xl font-bold text-teal-600">{targetScore}</span>
                      <span className="text-sm text-slate-500">점</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Right Side - Celebration/Alert Visual */}
          <motion.div
            className="hidden md:flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          >
            <div className="relative">
              <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${config.gradient} opacity-20 absolute inset-0 animate-pulse`} />
              <div className={`w-28 h-28 rounded-full bg-white/80 flex items-center justify-center shadow-lg backdrop-blur-sm relative`}>
                {emotionType === 'celebrate' && (
                  <Sparkles className="w-12 h-12 text-amber-500" />
                )}
                {emotionType === 'encourage' && (
                  <TrendingUp className="w-12 h-12 text-blue-500" />
                )}
                {emotionType === 'neutral' && (
                  <Target className="w-12 h-12 text-slate-500" />
                )}
                {emotionType === 'alert' && (
                  <AlertCircle className="w-12 h-12 text-amber-500" />
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-6 pt-4 border-t border-slate-200/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <button className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors group">
            <span>상세 분석 보기</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default memo(ReportGrowthHero);
