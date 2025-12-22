# 품질 점검 및 최적화 계획 (QA & Optimization Plan)

**프로젝트**: Math Learning Platform (Next.js + Supabase + Vercel)
**최종 업데이트**: 2025-12-22
**핵심 목적**: "개인별 수학 학습 현황 분석 및 성장"

---

## 목차

1. [정기 점검 체크리스트](#1-정기-점검-체크리스트)
2. [테스트 전략](#2-테스트-전략)
3. [성능 최적화](#3-성능-최적화)
4. [보안 점검](#4-보안-점검)
5. [모니터링 및 관측성](#5-모니터링-및-관측성)
6. [리팩토링 로드맵](#6-리팩토링-로드맵)
7. [배포 체크리스트](#7-배포-체크리스트)

---

## 1. 정기 점검 체크리스트

### A. 주간 점검 (Weekly Review)

#### 기능 및 목적 부합성
- [ ] 새로 추가된 기능이 '학습 분석'과 '성장'에 직접 기여하는가?
- [ ] 데이터가 Supabase에 유실 없이 저장되는가?
- [ ] 과거 데이터와 연결되어 통합 분석이 가능한가?

#### 코드 품질
- [ ] `src/types/index.ts`가 최신 스키마를 반영하는가?
- [ ] 불필요한 `any` 타입이 없는가?
- [ ] 중복 코드가 공통 컴포넌트로 분리되었는가?

#### Supabase 상태
- [ ] 데이터베이스 사용량 확인 (500MB 무료 한도)
- [ ] RLS 정책 정상 작동 확인
- [ ] 인증 세션 관리 정상 여부

### B. 월간 점검 (Monthly Review)

#### 비용 모니터링
- [ ] Gemini API 사용량 및 비용 확인
- [ ] Supabase 대역폭 사용량 확인
- [ ] Vercel 빌드 시간 및 대역폭 확인

#### 성능 지표
- [ ] Core Web Vitals (LCP, FID, CLS) 측정
- [ ] API 응답 시간 평균값 확인
- [ ] 에러율 모니터링

#### 보안 점검
- [ ] 환경 변수 노출 여부 확인
- [ ] 의존성 취약점 스캔 (`npm audit`)
- [ ] Supabase RLS 정책 검토

---

## 2. 테스트 전략

### A. 테스트 환경 설정

```bash
# 테스트 의존성 설치
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @vitejs/plugin-react jsdom
npm install -D msw  # API 모킹

# package.json scripts 추가
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));
```

### B. 단위 테스트 (Unit Tests)

#### 타입 및 유틸리티 테스트

```typescript
// src/lib/__tests__/prediction.test.ts
import { describe, it, expect } from 'vitest';
import { calculateEnhancedPrediction, calculateTrend } from '../prediction';

describe('calculateTrend', () => {
  it('should calculate positive trend for increasing scores', () => {
    const scores = [
      { date: '2025-01-01', score: 70 },
      { date: '2025-02-01', score: 75 },
      { date: '2025-03-01', score: 80 },
    ];
    const trend = calculateTrend(scores);
    expect(trend.slope).toBeGreaterThan(0);
  });

  it('should return zero slope for single data point', () => {
    const scores = [{ date: '2025-01-01', score: 70 }];
    const trend = calculateTrend(scores);
    expect(trend.slope).toBe(0);
    expect(trend.intercept).toBe(70);
  });
});

describe('calculateEnhancedPrediction', () => {
  it('should generate predictions for all timeframes', () => {
    const input = {
      historicalScores: [
        { date: '2025-01-01', score: 70, maxScore: 100 },
        { date: '2025-02-01', score: 75, maxScore: 100 },
      ],
      learningStyle: 'logical' as const,
      strategyCompletionRate: 0.8,
      weaknessImprovementRate: 0.5,
    };
    const predictions = calculateEnhancedPrediction(input);

    expect(predictions).toHaveLength(3);
    expect(predictions.map(p => p.timeframe)).toEqual(['1개월', '3개월', '6개월']);
    predictions.forEach(p => {
      expect(p.predictedScore).toBeGreaterThan(0);
      expect(p.confidenceLevel).toBeGreaterThanOrEqual(0);
      expect(p.confidenceLevel).toBeLessThanOrEqual(100);
    });
  });
});
```

#### 학습 스타일 분류 테스트

```typescript
// src/lib/__tests__/learningStyle.test.ts
import { describe, it, expect } from 'vitest';
import { classifyLearningStyle } from '../learningStyle';
import type { AnalysisData } from '@/types';

describe('classifyLearningStyle', () => {
  it('should classify visual learner correctly', () => {
    const analysisHistory: Partial<AnalysisData>[] = [
      {
        detailedAnalysis: [
          { solvingHabit: '그래프를 그려서 문제 해결' },
          { solvingHabit: '그림으로 시각화하여 접근' },
          { solvingHabit: '도형을 그려 분석' },
        ],
      },
    ];

    const result = classifyLearningStyle(analysisHistory as AnalysisData[]);
    expect(result.style).toBe('visual');
    expect(result.indicators.usesGraphs).toBeGreaterThan(0);
  });

  it('should classify logical learner correctly', () => {
    const analysisHistory: Partial<AnalysisData>[] = [
      {
        detailedAnalysis: [
          { solvingHabit: '공식을 단계별로 적용' },
          { solvingHabit: '수식을 차례대로 전개' },
          { solvingHabit: '단계적 접근으로 해결' },
        ],
      },
    ];

    const result = classifyLearningStyle(analysisHistory as AnalysisData[]);
    expect(result.style).toBe('logical');
  });
});
```

### C. 통합 테스트 (Integration Tests)

#### API Route 테스트

```typescript
// src/app/api/analyze/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

// Gemini API 모킹
vi.mock('@/lib/gemini', () => ({
  analyzeTestPaper: vi.fn().mockResolvedValue({
    testInfo: { testName: 'Test', testDate: '2025-01-01' },
    testResults: { totalScore: 85, maxScore: 100 },
    // ... 기타 분석 결과
  }),
}));

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return analysis data for valid request', async () => {
    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: '홍길동',
        formData: { testName: 'Test', testDate: '2025-01-01' },
        currentImages: ['base64image...'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.analysisData).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

#### Supabase 쿼리 테스트

```typescript
// src/lib/__tests__/supabase-queries.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('Supabase Queries', () => {
  it('should fetch students with correct query', async () => {
    const mockData = [
      { id: 1, name: '홍길동', grade: 7 },
      { id: 2, name: '김철수', grade: 8 },
    ];

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as any);

    const supabase = createClient();
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name');

    expect(data).toEqual(mockData);
    expect(mockSupabase.from).toHaveBeenCalledWith('students');
  });
});
```

### D. E2E 테스트 (Playwright)

```bash
# Playwright 설치
npm install -D @playwright/test
npx playwright install
```

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login as teacher', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'teacher@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('대시보드');
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL('/login');
  });
});

// e2e/reports.spec.ts
test.describe('Report Generation', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'teacher@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
  });

  test('should navigate to report creation', async ({ page }) => {
    await page.click('text=리포트 생성');
    await expect(page).toHaveURL('/admin/reports/new');
  });

  test('should show student selector', async ({ page }) => {
    await page.goto('/admin/reports/new');
    await expect(page.locator('select, [role="combobox"]')).toBeVisible();
  });
});
```

### E. 테스트 커버리지 목표

| 영역 | 현재 | 목표 (Phase 1) | 목표 (Phase 2) |
|---|---|---|---|
| 유틸리티 함수 | 0% | 80% | 95% |
| API Routes | 0% | 70% | 90% |
| 컴포넌트 | 0% | 50% | 70% |
| E2E 핵심 플로우 | 0% | 60% | 80% |

---

## 3. 성능 최적화

### A. Next.js 최적화

#### Server Components 활용

```typescript
// ✅ 올바른 패턴: 데이터 페칭은 서버 컴포넌트에서
// src/app/admin/students/page.tsx
export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('name');

  return <StudentList students={students} />;
}

// 클라이언트 상호작용이 필요한 부분만 분리
// src/components/StudentList.tsx
'use client';
export function StudentList({ students }: { students: Student[] }) {
  const [search, setSearch] = useState('');
  // ... 검색, 필터링 등 상호작용 로직
}
```

#### 이미지 최적화

```typescript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

// 사용 예시
import Image from 'next/image';

<Image
  src={imageUrl}
  alt="시험지 이미지"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
  loading="lazy"
/>
```

#### Dynamic Import (Code Splitting)

```typescript
// 무거운 라이브러리 동적 로드
import dynamic from 'next/dynamic';

const RechartsChart = dynamic(
  () => import('@/components/charts/GrowthChart'),
  {
    loading: () => <div className="animate-pulse h-64 bg-gray-200 rounded" />,
    ssr: false,
  }
);

const PDFExporter = dynamic(
  () => import('@/components/PDFExporter'),
  { ssr: false }
);
```

### B. 데이터베이스 최적화

#### 인덱스 최적화

```sql
-- 자주 사용되는 쿼리에 인덱스 추가
CREATE INDEX idx_reports_student_date ON reports(student_id, test_date DESC);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_students_parent ON students(parent_id);

-- JSONB 필드 인덱스 (분석 데이터 검색용)
CREATE INDEX idx_reports_analysis_gin ON reports USING gin(analysis_data);
```

#### 쿼리 최적화

```typescript
// ❌ N+1 문제 발생
const students = await supabase.from('students').select('*');
for (const student of students) {
  const reports = await supabase
    .from('reports')
    .select('*')
    .eq('student_id', student.id);
}

// ✅ JOIN으로 한 번에 조회
const { data } = await supabase
  .from('students')
  .select(`
    *,
    reports (
      id,
      report_type,
      test_date,
      total_score
    )
  `)
  .order('name');
```

### C. 캐싱 전략

#### Next.js 캐싱

```typescript
// 정적 데이터 캐싱 (revalidate)
export const revalidate = 3600; // 1시간마다 갱신

// 또는 fetch 옵션으로 제어
const response = await fetch(url, {
  next: { revalidate: 3600 }
});

// 동적 데이터는 캐싱 비활성화
export const dynamic = 'force-dynamic';
```

#### Gemini API 결과 캐싱

```typescript
// src/lib/gemini.ts
import { createHash } from 'crypto';

const analysisCache = new Map<string, { data: AnalysisData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

export async function analyzeTestPaper(
  studentName: string,
  formData: TestFormData,
  images: string[]
) {
  // 캐시 키 생성 (입력값 해시)
  const cacheKey = createHash('md5')
    .update(JSON.stringify({ studentName, formData, images: images.length }))
    .digest('hex');

  // 캐시 확인
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // API 호출
  const result = await callGeminiAPI(studentName, formData, images);

  // 캐시 저장
  analysisCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}
```

### D. 번들 크기 최적화

```bash
# 번들 분석
npm install -D @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... config
});

# 실행
ANALYZE=true npm run build
```

**번들 크기 목표:**
| 청크 | 현재 | 목표 |
|---|---|---|
| First Load JS | ~150KB | <100KB |
| 페이지별 JS | ~50KB | <30KB |
| Recharts | ~200KB | 동적 로드 |

---

## 4. 보안 점검

### A. 환경 변수 보안

```typescript
// ✅ 서버 전용 환경 변수 (클라이언트에서 접근 불가)
const geminiKey = process.env.GEMINI_API_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ 클라이언트 허용 환경 변수 (NEXT_PUBLIC_ 접두사)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 런타임 검증
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required');
}
```

### B. API Route 보안

```typescript
// src/app/api/analyze/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  // 1. 인증 확인
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. 역할 확인 (선생님만 분석 가능)
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'teacher') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. 입력 검증
  const body = await request.json();
  if (!body.studentName || !body.formData) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  // 4. Rate Limiting (선택적)
  // ... rate limit 로직

  // 5. 분석 실행
  const result = await analyzeTestPaper(body.studentName, body.formData, body.images);

  return Response.json({ success: true, data: result });
}
```

### C. Supabase RLS 정책 검증

```sql
-- RLS 정책 테스트 쿼리
-- 1. 학부모가 다른 학생 데이터에 접근 불가 확인
SET request.jwt.claims.role = 'parent';
SET request.jwt.claims.sub = 'parent-uuid';

SELECT * FROM students WHERE parent_id != 'parent-uuid';
-- 결과: 0 rows (정상)

-- 2. 선생님이 모든 데이터 접근 가능 확인
SET request.jwt.claims.role = 'teacher';

SELECT COUNT(*) FROM students;
-- 결과: 전체 학생 수 (정상)
```

### D. 의존성 취약점 관리

```bash
# 정기적 취약점 검사
npm audit

# 자동 수정 (주의: 호환성 확인 필요)
npm audit fix

# 취약점 보고서 생성
npm audit --json > audit-report.json
```

**취약점 대응 정책:**
| 심각도 | 대응 기한 | 조치 |
|---|---|---|
| Critical | 24시간 | 즉시 패치 또는 서비스 중단 |
| High | 1주일 | 우선 패치 |
| Medium | 2주일 | 계획 패치 |
| Low | 다음 릴리즈 | 일반 업데이트 |

---

## 5. 모니터링 및 관측성

### A. Vercel Analytics

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### B. 에러 추적 (Sentry - 선택적)

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// 에러 바운더리에서 사용
export function ErrorBoundary({ error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <ErrorFallback />;
}
```

### C. 커스텀 로깅

```typescript
// src/lib/logger.ts
type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(entry, null, 2));
  } else {
    // 프로덕션: 외부 로깅 서비스로 전송
    // await sendToLoggingService(entry);
    console.log(JSON.stringify(entry));
  }
}

// 사용 예시
log('info', 'Report generated', { studentId: 1, reportType: 'test' });
log('error', 'Gemini API failed', { error: error.message, studentName });
```

### D. 주요 모니터링 지표

| 지표 | 수집 방법 | 목표값 | 알림 기준 |
|---|---|---|---|
| API 응답 시간 | Vercel Analytics | < 500ms | > 2s |
| 에러율 | Sentry/Logs | < 1% | > 5% |
| Gemini API 성공률 | 커스텀 로그 | > 99% | < 95% |
| 페이지 로드 시간 (LCP) | Speed Insights | < 2.5s | > 4s |
| 데이터베이스 응답 시간 | Supabase Dashboard | < 100ms | > 500ms |

---

## 6. 리팩토링 로드맵

### 단기 (1-2주)

1. **테스트 환경 구축**
   - [ ] Vitest 설정
   - [ ] 기본 유틸리티 함수 테스트 작성
   - [ ] API Route 테스트 작성

2. **에러 처리 개선**
   - [ ] 글로벌 에러 바운더리 구현
   - [ ] API 에러 응답 표준화
   - [ ] 사용자 친화적 에러 메시지

### 중기 (1개월)

1. **성능 최적화**
   - [ ] 번들 크기 분석 및 최적화
   - [ ] 이미지 최적화 적용
   - [ ] 데이터베이스 쿼리 최적화

2. **모니터링 구축**
   - [ ] Vercel Analytics 설정
   - [ ] 커스텀 로깅 시스템 구현
   - [ ] 알림 설정

### 장기 (3개월)

1. **테스트 커버리지 확대**
   - [ ] E2E 테스트 구현
   - [ ] 통합 테스트 확대
   - [ ] CI/CD 파이프라인에 테스트 통합

2. **고급 최적화**
   - [ ] Edge Functions 활용 검토
   - [ ] ISR (Incremental Static Regeneration) 적용
   - [ ] 데이터베이스 파티셔닝 검토

---

## 7. 배포 체크리스트

### 배포 전 확인 사항

```markdown
### 코드 품질
- [ ] TypeScript 컴파일 에러 없음 (`npm run build`)
- [ ] ESLint 경고/에러 없음 (`npm run lint`)
- [ ] 테스트 통과 (`npm test`)

### 보안
- [ ] 환경 변수 확인 (프로덕션 값 설정)
- [ ] API 키 노출 없음 확인
- [ ] 의존성 취약점 확인 (`npm audit`)

### 기능
- [ ] 핵심 플로우 수동 테스트 완료
  - [ ] 로그인/로그아웃
  - [ ] 학생 등록/수정
  - [ ] 리포트 생성
  - [ ] 리포트 조회
- [ ] 반응형 UI 확인 (모바일/태블릿)

### 성능
- [ ] 빌드 크기 확인
- [ ] Lighthouse 점수 확인 (목표: 90+)

### 데이터베이스
- [ ] 마이그레이션 스크립트 준비 (필요시)
- [ ] 백업 확인
```

### 롤백 계획

```bash
# Vercel 이전 배포로 롤백
# Vercel Dashboard > Deployments > 이전 배포 선택 > Promote to Production

# 또는 CLI로
vercel rollback
```

---

**작성일**: 2025-11-25
**최종 업데이트**: 2025-12-22
**다음 검토일**: 2026-01-15
