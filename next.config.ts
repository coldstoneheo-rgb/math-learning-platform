import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // API Route body size limit 증가 (50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // 이미지 최적화 설정
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

// Sentry 설정
const sentryWebpackPluginOptions = {
  // 조직 및 프로젝트 설정 (환경변수에서)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 인증 토큰
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // 소스맵 업로드 (프로덕션 빌드에서만)
  silent: true, // 빌드 로그에서 Sentry 출력 숨김

  // 소스맵 설정
  hideSourceMaps: true, // 클라이언트에서 소스맵 숨김

  // 릴리즈 자동 생성
  automaticVercelMonitors: true,

  // 터널링 (CORS 우회 - 광고 차단기 대응)
  tunnelRoute: "/monitoring",

  // Vercel Edge 호환성
  disableLogger: true,

  // 번들 크기 분석 비활성화
  widenClientFileUpload: true,
};

// Sentry DSN이 설정된 경우에만 Sentry 래핑
const config = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

export default config;
