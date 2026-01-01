'use client';

/**
 * Feature Flag React Hook
 *
 * 컴포넌트에서 Feature Flag를 쉽게 사용할 수 있는 훅
 */

import { useEffect, useState } from 'react';
import type { FeatureFlagKey, FeatureFlagConfig } from '@/lib/feature-flags';

// 클라이언트에서 사용할 Feature Flag 상태
interface UseFeatureFlagResult {
  isEnabled: boolean;
  status: string;
  loading: boolean;
}

/**
 * Feature Flag 상태를 확인하는 훅
 *
 * @example
 * const { isEnabled } = useFeatureFlag('student_dashboard');
 * if (isEnabled) {
 *   return <StudentDashboard />;
 * }
 */
export function useFeatureFlag(
  flagKey: FeatureFlagKey,
  userId?: string,
  userRole?: 'teacher' | 'parent' | 'student'
): UseFeatureFlagResult {
  const [result, setResult] = useState<UseFeatureFlagResult>({
    isEnabled: false,
    status: 'disabled',
    loading: true,
  });

  useEffect(() => {
    // 서버 사이드 체크를 위한 API 호출 또는 클라이언트 측 로직
    async function checkFlag() {
      try {
        // 간단한 구현: API 호출 대신 로컬 스토리지 또는 전역 상태 확인
        // 실제 환경에서는 API를 통해 서버의 최신 상태를 가져올 수 있음
        const response = await fetch(
          `/api/feature-flags?flag=${flagKey}${userId ? `&userId=${userId}` : ''}${userRole ? `&role=${userRole}` : ''}`
        );

        if (response.ok) {
          const data = await response.json();
          setResult({
            isEnabled: data.isEnabled ?? false,
            status: data.status ?? 'disabled',
            loading: false,
          });
        } else {
          // API 오류 시 비활성화로 처리
          setResult({
            isEnabled: false,
            status: 'disabled',
            loading: false,
          });
        }
      } catch {
        // 네트워크 오류 시 비활성화로 처리 (안전한 기본값)
        setResult({
          isEnabled: false,
          status: 'disabled',
          loading: false,
        });
      }
    }

    checkFlag();
  }, [flagKey, userId, userRole]);

  return result;
}

/**
 * 모든 Feature Flag 상태를 가져오는 훅
 */
export function useAllFeatureFlags(): {
  flags: Record<string, FeatureFlagConfig> | null;
  loading: boolean;
} {
  const [flags, setFlags] = useState<Record<string, FeatureFlagConfig> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlags() {
      try {
        const response = await fetch('/api/feature-flags/all');
        if (response.ok) {
          const data = await response.json();
          setFlags(data.flags);
        }
      } catch {
        // 오류 시 null 유지
      } finally {
        setLoading(false);
      }
    }

    fetchFlags();
  }, []);

  return { flags, loading };
}

/**
 * Feature Flag 기반 조건부 렌더링 컴포넌트
 *
 * @example
 * <FeatureGate flag="achievement_badges" fallback={<OldComponent />}>
 *   <NewComponent />
 * </FeatureGate>
 */
export function FeatureGate({
  flag,
  children,
  fallback = null,
  userId,
  userRole,
}: {
  flag: FeatureFlagKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  userId?: string;
  userRole?: 'teacher' | 'parent' | 'student';
}) {
  const { isEnabled, loading } = useFeatureFlag(flag, userId, userRole);

  // 로딩 중에는 아무것도 렌더링하지 않거나 fallback 표시
  if (loading) {
    return fallback;
  }

  return isEnabled ? children : fallback;
}
