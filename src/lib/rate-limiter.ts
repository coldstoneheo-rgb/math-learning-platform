/**
 * Rate Limiter for API Routes
 *
 * 간단한 in-memory rate limiter 구현
 * 프로덕션에서는 Upstash Redis로 업그레이드 권장
 *
 * 사용법:
 * - AI 분석 API: 분당 5회 제한
 * - 일반 API: 분당 60회 제한
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (서버리스 환경에서는 인스턴스별로 분리됨)
const rateLimitStore = new Map<string, RateLimitEntry>();

// 만료된 엔트리 정리 (메모리 관리)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1분마다 정리

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** 윈도우당 최대 요청 수 */
  maxRequests: number;
  /** 윈도우 크기 (밀리초) */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Rate limit 체크
 * @param identifier - 사용자 식별자 (IP, userId 등)
 * @param config - Rate limit 설정
 * @returns Rate limit 결과
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // 새로운 윈도우 시작
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });

    return {
      success: true,
      remaining: config.maxRequests - 1,
      reset: now + config.windowMs,
    };
  }

  // 기존 윈도우 내 요청
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * 사전 정의된 Rate Limit 설정
 */
export const RATE_LIMITS = {
  /** AI 분석 API: 분당 5회 (비용 관리) */
  AI_ANALYSIS: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1분
  },

  /** 일반 API: 분당 60회 */
  STANDARD: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1분
  },

  /** 인증 API: 분당 10회 (브루트포스 방지) */
  AUTH: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1분
  },

  /** PDF 생성: 분당 3회 (리소스 집약적) */
  PDF_EXPORT: {
    maxRequests: 3,
    windowMs: 60 * 1000, // 1분
  },
} as const;

/**
 * Rate limit 헤더 생성
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {}),
  };
}

/**
 * 클라이언트 IP 추출
 * Vercel/Cloudflare 환경 고려
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;

  // Vercel
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Real IP
  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP;
  }

  return 'unknown';
}

/**
 * Rate limit 미들웨어 헬퍼
 * API 라우트에서 사용
 *
 * @example
 * ```typescript
 * const rateLimitResult = await applyRateLimit(request, 'AI_ANALYSIS');
 * if (!rateLimitResult.success) {
 *   return rateLimitResult.response;
 * }
 * ```
 */
export function applyRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  customIdentifier?: string
): { success: true } | { success: false; response: Response } {
  const identifier = customIdentifier || getClientIP(request);
  const config = RATE_LIMITS[limitType];
  const result = checkRateLimit(`${limitType}:${identifier}`, config);

  if (!result.success) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(result),
          },
        }
      ),
    };
  }

  return { success: true };
}
