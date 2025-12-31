import { NextRequest, NextResponse } from 'next/server';
import {
  FEATURE_FLAGS,
  getFlagStatus,
  isFeatureEnabledForUser,
  type FeatureFlagKey,
} from '@/lib/feature-flags';

/**
 * Feature Flag 상태 확인 API
 *
 * GET /api/feature-flags?flag=feature_name&userId=xxx&role=teacher
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const flagKey = searchParams.get('flag') as FeatureFlagKey | null;
  const userId = searchParams.get('userId') || undefined;
  const userRole = searchParams.get('role') as 'teacher' | 'parent' | 'student' | null;

  // flag 파라미터 필수
  if (!flagKey) {
    return NextResponse.json(
      { error: 'flag parameter is required' },
      { status: 400 }
    );
  }

  // 유효한 flag인지 확인
  const validFlags = Object.values(FEATURE_FLAGS);
  if (!validFlags.includes(flagKey)) {
    return NextResponse.json(
      { error: `Invalid flag: ${flagKey}` },
      { status: 400 }
    );
  }

  // Feature Flag 상태 확인
  const status = getFlagStatus(flagKey);
  const isEnabled = isFeatureEnabledForUser(
    flagKey,
    userId,
    userRole || undefined
  );

  return NextResponse.json({
    flag: flagKey,
    status,
    isEnabled,
  });
}
