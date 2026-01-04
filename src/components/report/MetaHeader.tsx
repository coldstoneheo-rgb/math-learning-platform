'use client';

/**
 * MetaHeader Component
 *
 * 리포트 상단에 표시되는 학생 메타프로필 요약 헤더
 * - 5대 핵심 지표 시각화
 * - 현재 상태 및 트렌드 표시
 */

import type { StudentMetaProfile } from '@/types';

interface MetaHeaderProps {
  metaProfile?: StudentMetaProfile | null;
  studentName: string;
  studentGrade: number;
  compact?: boolean;
}

// 학년을 한국어 형식으로 변환 (7 → 중1)
function getGradeLabel(grade: number): string {
  if (grade <= 6) return `초${grade}`;
  if (grade <= 9) return `중${grade - 6}`;
  return `고${grade - 9}`;
}

// 학습 유형 한글 설명
function getLearningTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'fast-starter': '빠른 습득형',
    'slow-but-deep': '깊은 이해형',
    'steady-grower': '꾸준한 성장형',
  };
  return labels[type] || type;
}

// 피로 패턴 한글 설명
function getFatiguePatternLabel(pattern: string): string {
  const labels: Record<string, string> = {
    'consistent': '일정 유지형',
    'early-fatigue': '초반 집중형',
    'late-fatigue': '후반 피로형',
  };
  return labels[pattern] || pattern;
}

// 발달 단계 한글 설명
function getDevelopmentStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    'emerging': '초기 단계',
    'developing': '발달 중',
    'proficient': '숙달 단계',
    'advanced': '고급 단계',
  };
  return labels[stage] || stage;
}

export default function MetaHeader({
  metaProfile,
  studentName,
  studentGrade,
  compact = false,
}: MetaHeaderProps) {
  const gradeLabel = getGradeLabel(studentGrade);

  if (!metaProfile) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{studentName}</h2>
            <p className="text-sm text-gray-500">{gradeLabel}</p>
          </div>
          <div className="text-sm text-gray-400">
            메타프로필 미설정
            <span className="ml-2 text-xs text-indigo-500">
              레벨 테스트 후 활성화됩니다
            </span>
          </div>
        </div>
      </div>
    );
  }

  const indicators = [
    {
      key: 'absorption',
      label: '학습 흡수율',
      value: metaProfile.absorptionRate?.overallScore ?? 50,
      icon: '📚',
      color: 'indigo',
      description: getLearningTypeLabel(metaProfile.absorptionRate?.learningType || 'steady-grower'),
      tooltip: '새로운 개념을 얼마나 빨리 이해하고 적용하는지',
    },
    {
      key: 'stamina',
      label: '문제풀이 지구력',
      value: metaProfile.solvingStamina?.overallScore ?? 50,
      icon: '💪',
      color: 'green',
      description: getFatiguePatternLabel(metaProfile.solvingStamina?.fatiguePattern || 'consistent'),
      tooltip: '긴 시간 동안 집중력을 유지하며 문제를 푸는 능력',
    },
    {
      key: 'metacognition',
      label: '메타인지 수준',
      value: metaProfile.metaCognitionLevel?.overallScore ?? 50,
      icon: '🧠',
      color: 'purple',
      description: getDevelopmentStageLabel(metaProfile.metaCognitionLevel?.developmentStage || 'developing'),
      tooltip: '자신의 학습 상태를 인식하고 조절하는 능력',
    },
    {
      key: 'errorPatterns',
      label: '파악된 오류 유형',
      value: metaProfile.errorSignature?.primaryErrorTypes?.length ?? 0,
      icon: '🎯',
      color: 'orange',
      description: metaProfile.errorSignature?.primaryErrorTypes?.length
        ? metaProfile.errorSignature.primaryErrorTypes.map(e => e.type).slice(0, 2).join(', ')
        : '분석 대기',
      tooltip: '반복적으로 나타나는 실수 유형 (개념 오류, 계산 오류 등)',
      isCount: true,
    },
  ];

  // 날짜 포맷팅 (Invalid Date 방지)
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('ko-KR');
    } catch {
      return '-';
    }
  };

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <span className="font-semibold text-gray-800">{studentName}</span>
              <span className="text-sm text-gray-500 ml-2">{gradeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {indicators.slice(0, 3).map((ind) => (
              <div key={ind.key} className="flex items-center gap-1" title={ind.tooltip}>
                <span className="text-sm">{ind.icon}</span>
                <span className="text-sm font-medium text-gray-700">
                  {ind.isCount ? ind.value : `${ind.value}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const baselineGradeLabel = metaProfile.baseline?.initialLevel?.grade
    ? getGradeLabel(metaProfile.baseline.initialLevel.grade)
    : gradeLabel;

  return (
    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-6 mb-6 shadow-sm">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{studentName}</h2>
          <p className="text-sm text-gray-500">{gradeLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">마지막 업데이트</p>
          <p className="text-sm text-gray-600">
            {formatDate(
              metaProfile.lastUpdated ||
              metaProfile.errorSignature?.lastUpdated ||
              metaProfile.baseline?.assessmentDate
            )}
          </p>
        </div>
      </div>

      {/* Baseline Info - 더 명확한 설명 */}
      {metaProfile.baseline?.assessmentDate && (
        <div className="bg-white/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎯</span>
            <span className="font-semibold text-gray-700">학습 기준점 (Baseline)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500">설정일:</span>
              <span className="ml-1 font-medium text-gray-700">
                {formatDate(metaProfile.baseline.assessmentDate)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">초기 수준:</span>
              <span className="ml-1 font-medium text-gray-700">
                {baselineGradeLabel} 수준
              </span>
            </div>
            <div>
              <span className="text-gray-500">백분위:</span>
              <span className="ml-1 font-medium text-gray-700">
                상위 {100 - (metaProfile.baseline.initialLevel?.percentile ?? 50)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 지표 설명 섹션 */}
      <div className="bg-white/30 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-500">
          💡 아래 지표들은 레벨 테스트 기준 초기값(50%)입니다. 시험 분석을 통해 실제 데이터가 반영됩니다.
        </p>
      </div>

      {/* Indicators Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {indicators.map((ind) => (
          <IndicatorCard
            key={ind.key}
            label={ind.label}
            value={ind.value}
            icon={ind.icon}
            color={ind.color}
            description={ind.description}
            tooltip={ind.tooltip}
            isCount={ind.isCount}
          />
        ))}
      </div>

      {/* Error Signature Preview */}
      {metaProfile.errorSignature?.signaturePatterns && metaProfile.errorSignature.signaturePatterns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">주요 오류 패턴</p>
          <div className="flex flex-wrap gap-2">
            {metaProfile.errorSignature.signaturePatterns.slice(0, 3).map((pattern, idx) => (
              <span
                key={idx}
                className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full"
              >
                {pattern.length > 30 ? pattern.substring(0, 30) + '...' : pattern}
              </span>
            ))}
            {metaProfile.errorSignature.signaturePatterns.length > 3 && (
              <span className="text-xs text-gray-400">
                +{metaProfile.errorSignature.signaturePatterns.length - 3}개 더
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface IndicatorCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  description: string;
  tooltip?: string;
  isCount?: boolean;
}

function IndicatorCard({
  label,
  value,
  icon,
  color,
  description,
  tooltip,
  isCount = false,
}: IndicatorCardProps) {
  const colorClasses: Record<string, { bg: string; text: string; bar: string }> = {
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', bar: 'bg-indigo-500' },
    green: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  const getValueColor = (val: number): string => {
    if (isCount) return 'text-gray-700';
    if (val >= 70) return 'text-green-600';
    if (val >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getValueLabel = (val: number): string => {
    if (isCount) return '';
    if (val >= 80) return '우수';
    if (val >= 60) return '양호';
    if (val >= 40) return '보통';
    return '보완 필요';
  };

  return (
    <div className={`${colors.bg} rounded-lg p-3`} title={tooltip}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <div className="text-right">
          <span className={`text-2xl font-bold ${getValueColor(value)}`}>
            {isCount ? value : `${value}`}
            {!isCount && <span className="text-sm font-normal text-gray-400">%</span>}
          </span>
          {!isCount && (
            <span className={`block text-xs ${getValueColor(value)}`}>
              {getValueLabel(value)}
            </span>
          )}
        </div>
      </div>
      <p className={`text-sm font-medium ${colors.text}`}>{label}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
      {!isCount && (
        <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${value}%` }}
          />
        </div>
      )}
    </div>
  );
}
