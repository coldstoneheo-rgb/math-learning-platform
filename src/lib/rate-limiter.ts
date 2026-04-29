/**
 * Rate Limiter for API Routes
 *
 * Upstash Redis 기반 분산 rate limiter (환경변수 설정 시 자동 활성화)
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 미설정 시 in-memory fallback
 *
 * 사용법:
 * - AI 분석 API: 분당 5회 / 하루 50회 제한
 * - 일반 API: 분당 60회 제한
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ===== In-Memory Fallback (Redis 미설정 시) =====

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000;

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) rateLimitStore.delete(key);
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

function checkInMemoryRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + config.windowMs });
    return { success: true, remaining: config.maxRequests - 1, reset: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;
  return { success: true, remaining: config.maxRequests - entry.count, reset: entry.resetTime };
}

// ===== Upstash Redis Rate Limiters =====

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// Sliding window rate limiters (생성 비용 절감을 위해 lazy init)
let _aiAnalysisLimiter: Ratelimit | null = null;
let _standardLimiter: Ratelimit | null = null;
let _authLimiter: Ratelimit | null = null;
let _pdfExportLimiter: Ratelimit | null = null;

function getAiAnalysisLimiter(): Ratelimit {
  if (!_aiAnalysisLimiter) {
    _aiAnalysisLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1m'),
      analytics: true,
      prefix: 'ratelimit:ai_analysis',
    });
  }
  return _aiAnalysisLimiter;
}

function getStandardLimiter(): Ratelimit {
  if (!_standardLimiter) {
    _standardLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(60, '1m'),
      analytics: true,
      prefix: 'ratelimit:standard',
    });
  }
  return _standardLimiter;
}

function getAuthLimiter(): Ratelimit {
  if (!_authLimiter) {
    _authLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1m'),
      analytics: true,
      prefix: 'ratelimit:auth',
    });
  }
  return _authLimiter;
}

function getPdfExportLimiter(): Ratelimit {
  if (!_pdfExportLimiter) {
    _pdfExportLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '1m'),
      analytics: true,
      prefix: 'ratelimit:pdf_export',
    });
  }
  return _pdfExportLimiter;
}

// ===== Public API =====

export const RATE_LIMITS = {
  AI_ANALYSIS: { maxRequests: 5, windowMs: 60 * 1000 },
  STANDARD: { maxRequests: 60, windowMs: 60 * 1000 },
  AUTH: { maxRequests: 10, windowMs: 60 * 1000 },
  PDF_EXPORT: { maxRequests: 3, windowMs: 60 * 1000 },
} as const;

async function checkRedisRateLimit(
  limitType: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<RateLimitResult> {
  let limiter: Ratelimit;
  switch (limitType) {
    case 'AI_ANALYSIS': limiter = getAiAnalysisLimiter(); break;
    case 'STANDARD': limiter = getStandardLimiter(); break;
    case 'AUTH': limiter = getAuthLimiter(); break;
    case 'PDF_EXPORT': limiter = getPdfExportLimiter(); break;
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
  };
}

/**
 * Rate limit 체크 (동기 - in-memory 전용, 레거시 호환)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  return checkInMemoryRateLimit(identifier, config);
}

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
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) return xRealIP;
  return 'unknown';
}

/**
 * Rate limit 미들웨어 헬퍼 (비동기, Redis 우선)
 *
 * @example
 * const rateLimitResult = await applyRateLimitAsync(request, 'AI_ANALYSIS');
 * if (!rateLimitResult.success) return rateLimitResult.response;
 */
export async function applyRateLimitAsync(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  customIdentifier?: string
): Promise<{ success: true } | { success: false; response: Response }> {
  const identifier = customIdentifier || getClientIP(request);

  let result: RateLimitResult;
  if (isRedisConfigured()) {
    try {
      result = await checkRedisRateLimit(limitType, `${limitType}:${identifier}`);
    } catch {
      // Redis 장애 시 in-memory fallback
      result = checkInMemoryRateLimit(`${limitType}:${identifier}`, RATE_LIMITS[limitType]);
    }
  } else {
    result = checkInMemoryRateLimit(`${limitType}:${identifier}`, RATE_LIMITS[limitType]);
  }

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
          headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(result) },
        }
      ),
    };
  }

  return { success: true };
}

/**
 * Rate limit 미들웨어 헬퍼 (동기 - in-memory 전용, 레거시 호환)
 */
export function applyRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  customIdentifier?: string
): { success: true } | { success: false; response: Response } {
  const identifier = customIdentifier || getClientIP(request);
  const config = RATE_LIMITS[limitType];
  const result = checkInMemoryRateLimit(`${limitType}:${identifier}`, config);

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
          headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(result) },
        }
      ),
    };
  }

  return { success: true };
}
