/**
 * Feature Flag 시스템
 *
 * 기능 점진적 출시 및 A/B 테스트를 위한 Feature Flag 관리
 * Phase 3 기능들의 안전한 롤아웃을 지원합니다.
 */

// Feature Flag 정의
export const FEATURE_FLAGS = {
  // Phase 3.1: 학부모 상호작용 강화
  PARENT_NOTIFICATIONS: 'parent_notifications',
  PARENT_STUDY_CHECKLIST: 'parent_study_checklist',
  PARENT_GOAL_SETTING: 'parent_goal_setting',

  // Phase 3.2: 학생 자기주도 학습
  STUDENT_DASHBOARD: 'student_dashboard',
  ACHIEVEMENT_BADGES: 'achievement_badges',
  GAMIFICATION: 'gamification',

  // 기타 기능
  PDF_EXPORT_V2: 'pdf_export_v2',
  AI_ENHANCED_REPORTS: 'ai_enhanced_reports',
  REAL_TIME_ANALYTICS: 'real_time_analytics',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

// Feature Flag 상태
export type FeatureFlagStatus = 'enabled' | 'disabled' | 'beta' | 'alpha';

// Feature Flag 설정 타입
export interface FeatureFlagConfig {
  status: FeatureFlagStatus;
  description: string;
  enabledForRoles?: ('teacher' | 'parent' | 'student')[];
  enabledForUserIds?: string[];
  enabledPercentage?: number; // 0-100, for gradual rollout
  createdAt: string;
  updatedAt: string;
}

// 기본 Feature Flag 설정 (환경변수 또는 DB로 관리 가능)
const DEFAULT_FLAGS: Record<FeatureFlagKey, FeatureFlagConfig> = {
  // Phase 3.1
  [FEATURE_FLAGS.PARENT_NOTIFICATIONS]: {
    status: 'disabled',
    description: '학부모 이메일/푸시 알림 시스템',
    enabledForRoles: ['parent'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  [FEATURE_FLAGS.PARENT_STUDY_CHECKLIST]: {
    status: 'disabled',
    description: '학습 계획 체크리스트 기능',
    enabledForRoles: ['parent', 'student'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  [FEATURE_FLAGS.PARENT_GOAL_SETTING]: {
    status: 'disabled',
    description: '학부모-학생 목표 설정 기능',
    enabledForRoles: ['parent', 'student'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },

  // Phase 3.2
  [FEATURE_FLAGS.STUDENT_DASHBOARD]: {
    status: 'disabled',
    description: '학생 전용 대시보드',
    enabledForRoles: ['student'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  [FEATURE_FLAGS.ACHIEVEMENT_BADGES]: {
    status: 'disabled',
    description: '성취 배지 시스템',
    enabledForRoles: ['student'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  [FEATURE_FLAGS.GAMIFICATION]: {
    status: 'disabled',
    description: '게이미피케이션 (포인트, 레벨, 리더보드)',
    enabledForRoles: ['student'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },

  // 기타 기능
  [FEATURE_FLAGS.PDF_EXPORT_V2]: {
    status: 'enabled', // 기존 기능 개선 버전
    description: 'PDF 내보내기 개선 버전',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  [FEATURE_FLAGS.AI_ENHANCED_REPORTS]: {
    status: 'enabled',
    description: 'AI 강화 리포트 기능',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  [FEATURE_FLAGS.REAL_TIME_ANALYTICS]: {
    status: 'disabled',
    description: '실시간 학습 분석',
    enabledForRoles: ['teacher'],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
};

// 환경변수에서 Feature Flag 오버라이드 읽기
function getEnvOverrides(): Partial<Record<FeatureFlagKey, FeatureFlagStatus>> {
  const overrides: Partial<Record<FeatureFlagKey, FeatureFlagStatus>> = {};

  // 환경변수 형식: FEATURE_FLAG_<FLAG_NAME>=enabled|disabled|beta|alpha
  // 예: FEATURE_FLAG_PARENT_NOTIFICATIONS=beta
  Object.values(FEATURE_FLAGS).forEach((flagKey) => {
    const envKey = `FEATURE_FLAG_${flagKey.toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue && ['enabled', 'disabled', 'beta', 'alpha'].includes(envValue)) {
      overrides[flagKey] = envValue as FeatureFlagStatus;
    }
  });

  return overrides;
}

// Feature Flag 캐시 (서버 재시작 없이 업데이트 가능하도록)
let flagCache: Record<FeatureFlagKey, FeatureFlagConfig> | null = null;

/**
 * 모든 Feature Flag 설정 가져오기
 */
export function getAllFlags(): Record<FeatureFlagKey, FeatureFlagConfig> {
  if (!flagCache) {
    const envOverrides = getEnvOverrides();

    flagCache = { ...DEFAULT_FLAGS };

    // 환경변수 오버라이드 적용
    Object.entries(envOverrides).forEach(([key, status]) => {
      const flagKey = key as FeatureFlagKey;
      if (flagCache && flagCache[flagKey]) {
        flagCache[flagKey] = {
          ...flagCache[flagKey],
          status: status!,
          updatedAt: new Date().toISOString(),
        };
      }
    });
  }

  return flagCache;
}

/**
 * 특정 Feature Flag의 상태 확인
 */
export function getFlagStatus(flagKey: FeatureFlagKey): FeatureFlagStatus {
  const flags = getAllFlags();
  return flags[flagKey]?.status ?? 'disabled';
}

/**
 * Feature가 활성화되어 있는지 확인 (간단한 체크)
 */
export function isFeatureEnabled(flagKey: FeatureFlagKey): boolean {
  const status = getFlagStatus(flagKey);
  return status === 'enabled';
}

/**
 * 특정 사용자에 대해 Feature가 활성화되어 있는지 확인
 */
export function isFeatureEnabledForUser(
  flagKey: FeatureFlagKey,
  userId?: string,
  userRole?: 'teacher' | 'parent' | 'student'
): boolean {
  const flags = getAllFlags();
  const config = flags[flagKey];

  if (!config) return false;

  // 완전히 비활성화된 경우
  if (config.status === 'disabled') return false;

  // 완전히 활성화된 경우
  if (config.status === 'enabled') {
    // 역할 제한이 있는 경우 확인
    if (config.enabledForRoles && userRole) {
      return config.enabledForRoles.includes(userRole);
    }
    return true;
  }

  // Beta 또는 Alpha (특정 사용자만)
  if (config.status === 'beta' || config.status === 'alpha') {
    // 특정 사용자 ID로 활성화
    if (config.enabledForUserIds && userId) {
      return config.enabledForUserIds.includes(userId);
    }

    // 백분율 기반 롤아웃
    if (config.enabledPercentage !== undefined && userId) {
      const hash = hashUserId(userId);
      return hash < config.enabledPercentage;
    }

    // 역할 기반 + 제한된 롤아웃
    if (config.enabledForRoles && userRole) {
      return config.enabledForRoles.includes(userRole);
    }

    return false;
  }

  return false;
}

/**
 * Feature Flag 캐시 초기화 (설정 변경 후 호출)
 */
export function clearFlagCache(): void {
  flagCache = null;
}

/**
 * 런타임에 Feature Flag 업데이트 (관리자용)
 */
export function updateFlag(
  flagKey: FeatureFlagKey,
  update: Partial<FeatureFlagConfig>
): void {
  const flags = getAllFlags();
  if (flags[flagKey]) {
    flagCache = {
      ...flags,
      [flagKey]: {
        ...flags[flagKey],
        ...update,
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

// 사용자 ID를 해시하여 0-100 사이 값으로 변환 (백분율 롤아웃용)
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}
