/**
 * Sentry Server Configuration
 *
 * 서버 사이드 에러 추적 설정
 * API Routes, Server Components 등에서 발생하는 에러 추적
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 환경별 설정
  environment: process.env.NODE_ENV,

  // 성능 모니터링: 서버 사이드는 더 높은 샘플링
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // 프로파일링 (성능 분석)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // 디버그 모드 (개발 환경에서만)
  debug: process.env.NODE_ENV === 'development',

  // 릴리즈 버전 추적
  release: process.env.npm_package_version,

  // 무시할 에러 패턴
  ignoreErrors: [
    // 인증 관련 예상된 오류
    'AuthError',
    'PGRST301', // Supabase RLS 에러
    // 클라이언트 연결 끊김
    'ECONNRESET',
    'ETIMEDOUT',
  ],

  // 민감한 데이터 필터링
  beforeSend(event, hint) {
    // 개발 환경에서는 Sentry에 전송하지 않음
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Server] Event:', hint.originalException);
      return null;
    }

    // API 키 등 민감 정보 제거
    if (event.extra) {
      const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'authorization'];
      for (const key of sensitiveKeys) {
        if (event.extra[key]) {
          event.extra[key] = '[REDACTED]';
        }
      }
    }

    // 요청 헤더에서 인증 정보 제거
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      if (headers.authorization) {
        headers.authorization = '[REDACTED]';
      }
      if (headers.cookie) {
        headers.cookie = '[REDACTED]';
      }
    }

    return event;
  },

  // 태그 추가
  initialScope: {
    tags: {
      app: 'math-learning-platform',
      side: 'server',
    },
  },
});
