'use client';

import React, { useState } from 'react';
import type { Achievement } from '@/lib/badge-service';

interface BadgeDisplayProps {
  achievement: Achievement;
  earnedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  isLocked?: boolean;
}

// 색상 스타일 매핑
const COLOR_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  gold: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700' },
  silver: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' },
  bronze: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  green: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' },
};

// 크기 스타일 매핑
const SIZE_STYLES = {
  sm: { wrapper: 'w-12 h-12', icon: 'text-xl', name: 'text-xs' },
  md: { wrapper: 'w-16 h-16', icon: 'text-2xl', name: 'text-sm' },
  lg: { wrapper: 'w-24 h-24', icon: 'text-4xl', name: 'text-base' },
};

export default function BadgeDisplay({
  achievement,
  earnedAt,
  size = 'md',
  showDetails = false,
  isLocked = false,
}: BadgeDisplayProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const colorStyle = COLOR_STYLES[achievement.color] || COLOR_STYLES.gold;
  const sizeStyle = SIZE_STYLES[size];

  return (
    <div className="relative inline-block">
      <div
        className={`
          relative ${sizeStyle.wrapper} rounded-full border-2
          flex items-center justify-center transition-all
          ${isLocked
            ? 'bg-gray-200 border-gray-300 opacity-50 grayscale'
            : `${colorStyle.bg} ${colorStyle.border} hover:scale-110 cursor-pointer`
          }
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={sizeStyle.icon}>
          {isLocked ? '🔒' : achievement.icon}
        </span>

        {/* 티어 표시 (lg 사이즈일 때만) */}
        {size === 'lg' && !isLocked && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
            {achievement.tier}
          </div>
        )}
      </div>

      {/* 배지 이름 (showDetails일 때) */}
      {showDetails && (
        <div className="mt-1 text-center">
          <p className={`font-medium ${sizeStyle.name} ${isLocked ? 'text-gray-400' : colorStyle.text}`}>
            {isLocked ? '???' : achievement.name}
          </p>
          {earnedAt && !isLocked && (
            <p className="text-xs text-gray-500">
              {new Date(earnedAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      )}

      {/* 툴팁 */}
      {showTooltip && !isLocked && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          <div className="font-bold mb-1">{achievement.name}</div>
          <div className="text-gray-300">{achievement.description}</div>
          <div className="mt-1 text-yellow-400">{achievement.points}pt</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

/**
 * 배지 그리드 컴포넌트
 */
interface BadgeGridProps {
  achievements: { achievement: Achievement; earnedAt?: string }[];
  lockedAchievements?: Achievement[];
  columns?: number;
}

export function BadgeGrid({
  achievements,
  lockedAchievements = [],
  columns = 4,
}: BadgeGridProps) {
  return (
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {achievements.map((item, idx) => (
        <div key={`earned-${idx}`} className="flex flex-col items-center">
          <BadgeDisplay
            achievement={item.achievement}
            earnedAt={item.earnedAt}
            size="md"
            showDetails
          />
        </div>
      ))}
      {lockedAchievements.map((achievement, idx) => (
        <div key={`locked-${idx}`} className="flex flex-col items-center">
          <BadgeDisplay
            achievement={achievement}
            size="md"
            showDetails
            isLocked
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 새 배지 획득 알림 컴포넌트
 */
interface NewBadgeNotificationProps {
  achievement: Achievement;
  onClose: () => void;
}

export function NewBadgeNotification({ achievement, onClose }: NewBadgeNotificationProps) {
  const colorStyle = COLOR_STYLES[achievement.color] || COLOR_STYLES.gold;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-bounceIn">
        {/* 축하 이펙트 */}
        <div className="text-6xl mb-4 animate-bounce">
          🎊
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">
          새로운 배지 획득!
        </h2>

        {/* 배지 표시 */}
        <div className={`inline-flex flex-col items-center p-6 rounded-xl ${colorStyle.bg} my-4`}>
          <span className="text-6xl mb-2">{achievement.icon}</span>
          <span className={`text-xl font-bold ${colorStyle.text}`}>{achievement.name}</span>
          <span className="text-sm text-gray-600 mt-1">{achievement.description}</span>
          <span className="text-yellow-600 font-bold mt-2">+{achievement.points}pt</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          확인
        </button>
      </div>
    </div>
  );
}

/**
 * 배지 요약 카드 컴포넌트
 */
interface BadgeSummaryCardProps {
  totalBadges: number;
  totalPoints: number;
  recentBadges: { achievement: Achievement; earnedAt?: string }[];
}

export function BadgeSummaryCard({ totalBadges, totalPoints, recentBadges }: BadgeSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">획득 배지</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-indigo-600 font-medium">{totalBadges}개 획득</span>
          <span className="text-yellow-600 font-medium">{totalPoints}pt</span>
        </div>
      </div>

      {recentBadges.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {recentBadges.slice(0, 6).map((item, idx) => (
            <BadgeDisplay
              key={idx}
              achievement={item.achievement}
              earnedAt={item.earnedAt}
              size="sm"
            />
          ))}
          {recentBadges.length > 6 && (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-medium">
              +{recentBadges.length - 6}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          <span className="text-2xl">🏆</span>
          <p className="mt-2 text-sm">아직 획득한 배지가 없습니다</p>
        </div>
      )}
    </div>
  );
}
