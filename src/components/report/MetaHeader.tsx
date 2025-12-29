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

export default function MetaHeader({
  metaProfile,
  studentName,
  studentGrade,
  compact = false,
}: MetaHeaderProps) {
  if (!metaProfile) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{studentName}</h2>
            <p className="text-sm text-gray-500">{studentGrade}학년</p>
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
      label: '흡수율',
      value: metaProfile.absorptionRate.overallScore,
      icon: '📚',
      color: 'indigo',
      description: metaProfile.absorptionRate.learningType,
    },
    {
      key: 'stamina',
      label: '지구력',
      value: metaProfile.solvingStamina.overallScore,
      icon: '💪',
      color: 'green',
      description: metaProfile.solvingStamina.fatiguePattern,
    },
    {
      key: 'metacognition',
      label: '메타인지',
      value: metaProfile.metaCognitionLevel.overallScore,
      icon: '🧠',
      color: 'purple',
      description: metaProfile.metaCognitionLevel.developmentStage,
    },
    {
      key: 'errorPatterns',
      label: '오류 패턴',
      value: metaProfile.errorSignature.signaturePatterns.length,
      icon: '🎯',
      color: 'orange',
      description: `${metaProfile.errorSignature.primaryErrorTypes.length}개 유형`,
      isCount: true,
    },
  ];

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <span className="font-semibold text-gray-800">{studentName}</span>
              <span className="text-sm text-gray-500 ml-2">{studentGrade}학년</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {indicators.slice(0, 3).map((ind) => (
              <div key={ind.key} className="flex items-center gap-1">
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

  return (
    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-6 mb-6 shadow-sm">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{studentName}</h2>
          <p className="text-sm text-gray-500">
            {studentGrade}학년 | 프로필 v{metaProfile.version}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">마지막 업데이트</p>
          <p className="text-sm text-gray-600">
            {new Date(metaProfile.lastUpdated).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>

      {/* Baseline Info */}
      {metaProfile.baseline.assessmentDate && (
        <div className="bg-white/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Baseline:</span>
            <span className="font-medium text-gray-700">
              {new Date(metaProfile.baseline.assessmentDate).toLocaleDateString('ko-KR')} 설정
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              초기 수준: {metaProfile.baseline.initialLevel.grade}학년{' '}
              {metaProfile.baseline.initialLevel.percentile}%tile
            </span>
          </div>
        </div>
      )}

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
            isCount={ind.isCount}
          />
        ))}
      </div>

      {/* Error Signature Preview */}
      {metaProfile.errorSignature.signaturePatterns.length > 0 && (
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
  isCount?: boolean;
}

function IndicatorCard({
  label,
  value,
  icon,
  color,
  description,
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

  return (
    <div className={`${colors.bg} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-2xl font-bold ${getValueColor(value)}`}>
          {isCount ? value : `${value}`}
          {!isCount && <span className="text-sm font-normal text-gray-400">%</span>}
        </span>
      </div>
      <p className={`text-sm font-medium ${colors.text}`}>{label}</p>
      <p className="text-xs text-gray-500 mt-1 capitalize">{description}</p>
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
