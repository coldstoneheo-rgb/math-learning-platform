'use client';

/**
 * EvidenceBadge Component
 *
 * 데이터 근거를 표시하는 배지
 * - 모든 인사이트에 출처, 관찰 시점, 시험지 이미지 링크 등을 제공
 * - 학부모의 신뢰 구축을 위한 Evidence-Based Trust 원칙 적용
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - "신뢰의 시각화"
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Calendar,
  Image,
  Database,
  Clock,
  Eye,
  CheckCircle,
  ExternalLink,
  Info,
} from 'lucide-react';

type EvidenceType = 'test_paper' | 'weekly_data' | 'monthly_data' | 'class_record' | 'ai_analysis' | 'teacher_observation';

interface EvidenceSource {
  type: EvidenceType;
  label: string;
  date?: string;
  link?: string;
  description?: string;
}

interface EvidenceBadgeProps {
  sources: EvidenceSource[];
  compact?: boolean;
  showDetails?: boolean;
}

const EVIDENCE_ICONS: Record<EvidenceType, typeof FileText> = {
  test_paper: Image,
  weekly_data: Calendar,
  monthly_data: Database,
  class_record: FileText,
  ai_analysis: Eye,
  teacher_observation: CheckCircle,
};

const EVIDENCE_COLORS: Record<EvidenceType, { bg: string; text: string; border: string }> = {
  test_paper: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  weekly_data: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  monthly_data: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  class_record: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  ai_analysis: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  teacher_observation: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  test_paper: '시험지',
  weekly_data: '주간 데이터',
  monthly_data: '월간 데이터',
  class_record: '수업 기록',
  ai_analysis: 'AI 분석',
  teacher_observation: '선생님 관찰',
};

function EvidenceBadge({
  sources,
  compact = false,
  showDetails = true,
}: EvidenceBadgeProps) {
  if (sources.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <motion.div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
      >
        <Database className="w-3 h-3" />
        <span>데이터 {sources.length}건 기반</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="bg-white/60 rounded-xl border border-slate-200/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-medium text-slate-600">분석 근거</span>
        <span className="text-xs text-slate-400">({sources.length}건의 데이터)</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sources.map((source, idx) => {
          const Icon = EVIDENCE_ICONS[source.type];
          const colors = EVIDENCE_COLORS[source.type];

          return (
            <motion.div
              key={idx}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg} ${colors.text} border ${colors.border} text-xs`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02, y: -1 }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="font-medium">{source.label || EVIDENCE_LABELS[source.type]}</span>
              {source.date && (
                <>
                  <span className="opacity-50">|</span>
                  <Clock className="w-3 h-3 opacity-70" />
                  <span className="opacity-80">{source.date}</span>
                </>
              )}
              {source.link && (
                <ExternalLink className="w-3 h-3 ml-1 opacity-60 cursor-pointer hover:opacity-100" />
              )}
            </motion.div>
          );
        })}
      </div>

      {showDetails && sources.some(s => s.description) && (
        <div className="mt-3 pt-3 border-t border-slate-200/50">
          {sources.filter(s => s.description).map((source, idx) => (
            <p key={idx} className="text-xs text-slate-500 mb-1 last:mb-0">
              • {source.description}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default memo(EvidenceBadge);

/**
 * InlineEvidenceBadge - 문장 내 인라인으로 사용하는 근거 표시
 */
export const InlineEvidenceBadge = memo(function InlineEvidenceBadge({
  type,
  date,
  children,
}: {
  type: EvidenceType;
  date?: string;
  children: React.ReactNode;
}) {
  const Icon = EVIDENCE_ICONS[type];
  const colors = EVIDENCE_COLORS[type];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} text-xs mx-0.5`}
      title={`${EVIDENCE_LABELS[type]}${date ? ` (${date})` : ''}`}
    >
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
});
