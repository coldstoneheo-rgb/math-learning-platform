/**
 * Sentry Client Configuration
 *
 * 클라이언트 사이드 에러 추적 설정
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 환경별 설정
  environment: process.env.NODE_ENV,

  // 성능 모니터링: 샘플링 비율 (0.0 ~ 1.0)
  // 프로덕션에서는 비용 관리를 위해 낮은 비율 권장
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 세션 리플레이: 에러 발생 시 화면 녹화
  // 프로덕션에서만 활성화 (개인정보 고려)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

  // 디버그 모드 (개발 환경에서만)
  debug: process.env.NODE_ENV === 'development',

  // 릴리즈 버전 추적
  release: process.env.npm_package_version,

  // 무시할 에러 패턴
  ignoreErrors: [
    // 네트워크 관련 일시적 오류
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // 사용자 취소
    'AbortError',
    // 브라우저 확장 프로그램 오류
    'ResizeObserver loop',
    // 소셜 로그인 관련
    'Non-Error promise rejection',
  ],

  // 민감한 데이터 필터링
  beforeSend(event) {
    // 개발 환경에서는 Sentry에 전송하지 않음
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry] Event would be sent:', event.exception?.values?.[0]?.value);
      return null;
    }

    // 사용자 이메일 마스킹
    if (event.user?.email) {
      const email = event.user.email;
      const [local, domain] = email.split('@');
      event.user.email = `${local.slice(0, 2)}***@${domain}`;
    }

    return event;
  },

  // 태그 추가
  initialScope: {
    tags: {
      app: 'math-learning-platform',
      side: 'client',
    },
  },
});
