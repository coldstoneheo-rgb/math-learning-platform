/**
 * Sentry Edge Configuration
 *
 * Edge Runtime (Middleware 등) 에러 추적 설정
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 환경별 설정
  environment: process.env.NODE_ENV,

  // Edge는 경량 설정
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 디버그 모드 비활성화 (Edge에서는 로깅 제한)
  debug: false,

  // 릴리즈 버전 추적
  release: process.env.npm_package_version,

  // 민감한 데이터 필터링
  beforeSend(event) {
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // 인증 헤더 제거
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
      side: 'edge',
    },
  },
});
