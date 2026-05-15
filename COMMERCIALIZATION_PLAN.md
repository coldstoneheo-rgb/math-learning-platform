# 상용화 계획서 (Commercialization Plan)

> **프로젝트 정체성**: AI 기반 1:1 맞춤형 학습 컨설팅 SaaS
> **최우선 목표**: 배포 및 상용화 (학부모 우선 오픈, 교사 대상 추후 오픈)

**작성일**: 2025-12-31
**최종 업데이트**: 2026-04-29
**버전**: v1.1

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [현재 상태 분석](#2-현재-상태-분석)
3. [기술적 개선 사항 (Technical Improvements)](#3-기술적-개선-사항)
4. [Phase 3: 플랫폼 고도화](#4-phase-3-플랫폼-고도화)
5. [비즈니스 모델 (Business Model)](#5-비즈니스-모델)
6. [상용화 배포 계획 (Go-to-Market)](#6-상용화-배포-계획)
7. [운영 고도화 계획 (Operations)](#7-운영-고도화-계획)
8. [실행 로드맵](#8-실행-로드맵)

---

## 1. Executive Summary

### 1.1. 제품 정의

**Math Learning Platform**은 개인 수학 과외 교사와 학부모를 위한 **AI 기반 1:1 맞춤형 학습 컨설팅 SaaS**입니다.

| 구분 | 내용 |
|------|------|
| **핵심 가치** | 시험 분석 → AI 진단 → 개인화 전략 → 성장 추적의 완전한 순환 |
| **차별점** | 6단계 Growth Loop 시스템, 5대 핵심 지표 기반 메타프로필 |
| **타겟 고객** | 1차: 학부모 (B2C), 2차: 개인/소규모 과외 교사 (B2B) |

### 1.2. 현재 완성도

```
Phase 0: 긴급 개선     ████████████████████ 100% ✅
Phase 1: 품질 고도화    ████████████████████ 100% ✅
Phase 2: 데이터 지능화  ████████████████████ 100% ✅
Phase 3: 플랫폼화       ████████░░░░░░░░░░░░  40% 🔄
```

> **2026-04-29 업데이트**: Rate Limiting, Input Validation, Sentry, E2E Tests, Model Router, Feature Flags, Email System 등 핵심 인프라 구현 완료

### 1.3. 상용화 핵심 마일스톤

| 단계 | 목표 | 예상 기간 |
|------|------|----------|
| **Step 1: MVP 배포** | 학부모 베타 오픈 (5명) | 1주 |
| **Step 2: 안정화** | 보안/성능 강화, 피드백 반영 | 2주 |
| **Step 3: 정식 오픈** | 전체 학부모 오픈 | 1주 |
| **Step 4: 교사 확장** | B2B 교사 플랫폼 오픈 | 4주 |

---

## 2. 현재 상태 분석

### 2.1. 완료된 기능

| 영역 | 완성도 | 주요 기능 |
|------|--------|----------|
| **Growth Loop System** | 100% | 6개 리포트 타입 순환 (Baseline → Micro → Macro) |
| **AI 분석 엔진** | 100% | 5가지 관점 심층 분석, 5요소 전략 제시 |
| **메타프로필** | 100% | 5대 핵심 지표 자동 추적 (Anchor Loop) |
| **피드백 루프** | 100% | 전략 효과 추적, 예측 정확도 검증 |
| **PDF 내보내기** | 100% | 한글 지원, 고해상도 차트 |
| **학부모 대시보드** | 80% | Growth Loop 상태, 리포트 열람 |

### 2.2. 보완 필요 영역 (상용화 필수)

| 영역 | 현재 상태 | 상용화 필수 여부 | 우선순위 |
|------|----------|----------------|---------|
| API Rate Limiting | ✅ 완료 (`src/lib/rate-limiter.ts`) | 🔴 필수 | P0 |
| Input Validation (서버) | ✅ 완료 (`src/lib/validations.ts` - Zod) | 🔴 필수 | P0 |
| 에러 모니터링 (Sentry) | ✅ 완료 (`@sentry/nextjs` 설치됨) | 🔴 필수 | P0 |
| E2E 테스트 | ✅ 완료 (`e2e/` 디렉토리 - Playwright) | 🟡 권장 | P1 |
| AI 모델 라우팅 | ✅ 완료 (`src/lib/model-router.ts`) | 🟡 권장 | P1 |
| Feature Flags | ✅ 완료 (`src/lib/feature-flags.ts`) | 🟡 권장 | P1 |
| 이메일 시스템 | ✅ 완료 (`src/lib/email.ts` - Resend) | 🟡 권장 | P2 |
| PII 암호화 | ✅ 완료 (`src/lib/pii-encryption.ts`) | 🟡 권장 | P2 |
| 결제 시스템 | ❌ 미구현 | 🟡 권장 | P2 |
| 멀티테넌시 | ❌ 미구현 | 🟡 권장 | P3 |

---

## 3. 기술적 개선 사항

### 3.1. 보안 (Security) - P0 필수

#### 3.1.1. API Rate Limiting

**문제**: Gemini API 무제한 호출 시 비용 폭탄 위험

**해결책**: Upstash Redis 기반 Rate Limiting

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// IP당 하루 50회 분석 제한
export const analyzeRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1d'),
  analytics: true,
  prefix: 'ratelimit:analyze',
});

// 유저당 시간당 10회 제한
export const userRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1h'),
  analytics: true,
  prefix: 'ratelimit:user',
});
```

**API Route 적용**:

```typescript
// src/app/api/analyze/route.ts
import { analyzeRateLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';

  const { success, limit, reset, remaining } = await analyzeRateLimiter.limit(ip);

  if (!success) {
    return Response.json(
      { error: '일일 분석 횟수를 초과했습니다. 내일 다시 시도해주세요.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        }
      }
    );
  }

  // 기존 분석 로직...
}
```

**비용**: Upstash Free Tier (10,000 requests/day) → 충분

---

#### 3.1.2. Input Validation (Zod)

**문제**: 클라이언트 타입만 믿으면 악의적 입력에 취약

**해결책**: Zod 스키마로 서버사이드 검증

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// 시험 분석 요청 스키마
export const analyzeRequestSchema = z.object({
  studentName: z.string().min(1).max(50),
  formData: z.object({
    testName: z.string().min(1).max(100),
    testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalScore: z.number().min(0).max(1000),
    maxScore: z.number().min(1).max(1000),
    rank: z.number().min(1).optional(),
    totalStudents: z.number().min(1).optional(),
  }),
  currentImages: z.array(z.string().max(10_000_000)).max(10), // 10MB per image, max 10
});

// 학생 생성 스키마
export const createStudentSchema = z.object({
  name: z.string().min(1).max(50),
  grade: z.number().min(1).max(12),
  school: z.string().max(100).optional(),
  student_id: z.string().regex(/^[A-Z]\d{7}$/),
});

// 범용 검증 함수
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.errors);
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(public errors: z.ZodError['errors']) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}
```

**API Route 적용**:

```typescript
// src/app/api/analyze/route.ts
import { analyzeRequestSchema, validateRequest, ValidationError } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateRequest(analyzeRequestSchema, body);

    // validated 데이터로 안전하게 처리...

  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json(
        { error: '입력 데이터가 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

---

#### 3.1.3. PII(개인정보) 보호

**현재**: 학생 이름, 학교가 평문 저장

**개선안** (Phase 2 이후):

```sql
-- 민감 정보 분리 테이블
CREATE TABLE student_pii (
  id SERIAL PRIMARY KEY,
  student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  encrypted_name BYTEA NOT NULL,          -- AES-256 암호화
  encrypted_school BYTEA,
  encryption_key_id TEXT NOT NULL,        -- Key rotation 지원
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- students 테이블에서 민감 정보 제거
ALTER TABLE students DROP COLUMN name;
ALTER TABLE students DROP COLUMN school;
ALTER TABLE students ADD COLUMN display_name TEXT; -- 마스킹된 이름 (예: 김**)
```

**우선순위**: 정식 오픈 후 (현재는 교사 본인 데이터만 관리)

---

### 3.2. 안정성 & QA (Stability) - P1 권장

#### 3.2.1. E2E 테스트 (Playwright)

**Critical Path 테스트 시나리오**:

```typescript
// tests/e2e/critical-path.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical Path: 리포트 생성 → 학부모 확인', () => {
  test('교사 로그인 → 시험 분석 → 리포트 저장', async ({ page }) => {
    // 1. 로그인
    await page.goto('/login');
    await page.fill('[name=email]', process.env.TEST_TEACHER_EMAIL!);
    await page.fill('[name=password]', process.env.TEST_TEACHER_PASSWORD!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/admin');

    // 2. 리포트 생성 페이지 이동
    await page.click('text=시험 분석');
    await expect(page).toHaveURL('/admin/reports/new');

    // 3. 학생 선택
    await page.selectOption('[name=studentId]', { index: 1 });

    // 4. 기본 정보 입력
    await page.fill('[name=testName]', 'E2E 테스트 시험');
    await page.fill('[name=totalScore]', '85');
    await page.fill('[name=maxScore]', '100');

    // 5. 이미지 업로드 (테스트용 이미지)
    await page.setInputFiles('input[type=file]', 'tests/fixtures/test-paper.jpg');

    // 6. AI 분석 실행
    await page.click('text=AI 분석 시작');
    await expect(page.locator('text=분석 완료')).toBeVisible({ timeout: 60000 });

    // 7. 저장
    await page.click('text=리포트 저장');
    await expect(page).toHaveURL('/admin/reports');
    await expect(page.locator('text=E2E 테스트 시험')).toBeVisible();
  });

  test('학부모 로그인 → 리포트 확인 → PDF 다운로드', async ({ page }) => {
    // 1. 학부모 로그인
    await page.goto('/login');
    await page.fill('[name=email]', process.env.TEST_PARENT_EMAIL!);
    await page.fill('[name=password]', process.env.TEST_PARENT_PASSWORD!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/parent');

    // 2. 최신 리포트 확인
    await page.click('text=E2E 테스트 시험');
    await expect(page.locator('text=종합 분석')).toBeVisible();

    // 3. PDF 다운로드
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=PDF 저장'),
    ]);
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});
```

**CI/CD 통합**:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
        env:
          TEST_TEACHER_EMAIL: ${{ secrets.TEST_TEACHER_EMAIL }}
          TEST_TEACHER_PASSWORD: ${{ secrets.TEST_TEACHER_PASSWORD }}
          TEST_PARENT_EMAIL: ${{ secrets.TEST_PARENT_EMAIL }}
          TEST_PARENT_PASSWORD: ${{ secrets.TEST_PARENT_PASSWORD }}
```

---

#### 3.2.2. Graceful Degradation (비동기 분석 큐)

**문제**: Gemini API 타임아웃(30초) 시 사용자 경험 저하

**해결책**: 분석 요청 큐 + 비동기 처리

```typescript
// src/lib/analysis-queue.ts
import { createClient } from '@/lib/supabase/server';

export interface AnalysisJob {
  id: string;
  student_id: number;
  form_data: Record<string, unknown>;
  images: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  completed_at?: string;
}

// 분석 요청 큐에 등록
export async function queueAnalysis(
  studentId: number,
  formData: Record<string, unknown>,
  images: string[]
): Promise<{ jobId: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('analysis_jobs')
    .insert({
      student_id: studentId,
      form_data: formData,
      images,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw error;

  // 백그라운드 처리 트리거 (Vercel Cron 또는 Edge Function)
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/process`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.JOB_SECRET}` },
  });

  return { jobId: data.id };
}

// 분석 상태 조회
export async function getAnalysisStatus(jobId: string): Promise<AnalysisJob | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('analysis_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  return data;
}
```

**사용자 흐름**:

```
1. 분석 요청 → "분석이 대기열에 등록되었습니다" 즉시 응답
2. 백그라운드에서 Gemini API 호출
3. 완료 시 → 이메일/푸시 알림 (또는 폴링으로 상태 확인)
4. 사용자가 결과 확인
```

---

### 3.3. 최적화 (Optimization) - P1 권장

#### 3.3.1. Next.js Cache Strategy

```typescript
// src/app/admin/reports/[id]/page.tsx
import { unstable_cache } from 'next/cache';

// 리포트 데이터 캐싱 (1시간)
const getCachedReport = unstable_cache(
  async (reportId: string) => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('reports')
      .select('*, students(*)')
      .eq('id', reportId)
      .single();
    return data;
  },
  ['report-detail'],
  { revalidate: 3600, tags: ['reports'] }
);

// 캐시 무효화 (리포트 수정 시)
import { revalidateTag } from 'next/cache';
await revalidateTag('reports');
```

#### 3.3.2. 이미지 압축

```typescript
// src/lib/image-compression.ts
import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<string> {
  const options = {
    maxSizeMB: 1,           // 최대 1MB
    maxWidthOrHeight: 1920, // 최대 해상도
    useWebWorker: true,
    fileType: 'image/jpeg',
  };

  const compressedFile = await imageCompression(file, options);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressedFile);
  });
}
```

---

## 4. Phase 3: 플랫폼 고도화

### 4.1. 학부모 상호작용 강화

#### 4.1.1. 실시간 알림 시스템

**구현 방식**: Supabase Realtime + 이메일 (Resend)

```typescript
// src/lib/notifications.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function notifyParentNewReport(
  parentEmail: string,
  studentName: string,
  reportType: string,
  reportUrl: string
) {
  await resend.emails.send({
    from: 'Math Learning <noreply@mathlearning.app>',
    to: parentEmail,
    subject: `[수학학습] ${studentName} 학생의 새 ${reportType} 리포트가 도착했습니다`,
    html: `
      <h2>${studentName} 학생의 새 리포트</h2>
      <p>리포트 유형: ${reportType}</p>
      <a href="${reportUrl}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #4F46E5;
        color: white;
        text-decoration: none;
        border-radius: 8px;
      ">리포트 확인하기</a>
    `,
  });
}
```

**DB 트리거**:

```sql
-- 리포트 생성 시 알림 트리거
CREATE OR REPLACE FUNCTION notify_parent_on_report()
RETURNS TRIGGER AS $$
BEGIN
  -- Edge Function 호출 (비동기 알림 처리)
  PERFORM net.http_post(
    url := current_setting('app.settings.notification_url'),
    body := json_build_object(
      'report_id', NEW.id,
      'student_id', NEW.student_id,
      'report_type', NEW.report_type
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_report_created
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_parent_on_report();
```

---

#### 4.1.2. 학습 계획 체크리스트 (학부모용)

**UI 컴포넌트**:

```typescript
// src/app/parent/checklist/page.tsx
'use client';

interface ChecklistItem {
  id: number;
  strategy_id: number;
  title: string;
  description: string;
  due_date: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by: 'parent' | 'student';
}

export default function ParentChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  const handleToggle = async (itemId: number, completed: boolean) => {
    await fetch(`/api/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_completed: completed, completed_by: 'parent' }),
    });
    // 상태 업데이트...
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">이번 주 학습 체크리스트</h2>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 p-4 bg-white rounded-lg">
          <input
            type="checkbox"
            checked={item.is_completed}
            onChange={(e) => handleToggle(item.id, e.target.checked)}
            className="w-5 h-5 rounded"
          />
          <div className="flex-1">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-gray-500">{item.description}</p>
          </div>
          <span className="text-xs text-gray-400">
            {item.due_date}까지
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

#### 4.1.3. 교사-학부모 메시지

**간단한 피드백 교환** (전체 채팅 아님):

```typescript
// 테이블 설계
interface TeacherParentMessage {
  id: number;
  student_id: number;
  report_id?: number;        // 특정 리포트에 대한 피드백
  sender_role: 'teacher' | 'parent';
  message: string;
  is_read: boolean;
  created_at: string;
}
```

**UI**: 리포트 상세 페이지에 "질문하기" 버튼 → 간단한 메시지 폼

---

### 4.2. 학생 자기주도 학습 기능

#### 4.2.1. 학생 전용 대시보드

```
/student 경로 신설:
├── /student                    # 학생 메인 대시보드
├── /student/goals              # 목표 설정/추적
├── /student/achievements       # 성취 배지
├── /student/journal            # 학습 일지
└── /student/reports/[id]       # 리포트 열람 (읽기 전용)
```

#### 4.2.2. 목표 설정 시스템

```typescript
// src/types/student-goals.ts
interface StudentGoal {
  id: number;
  student_id: number;
  title: string;
  description: string;
  target_type: 'score' | 'concept' | 'habit';
  target_value: number;          // 목표 점수 또는 횟수
  current_value: number;         // 현재 달성도
  deadline: string;
  status: 'active' | 'achieved' | 'failed' | 'cancelled';
  created_at: string;
  achieved_at?: string;
}

// 목표 자동 추적 (리포트 생성 시)
async function updateGoalProgress(studentId: number, reportData: AnalysisData) {
  const { data: activeGoals } = await supabase
    .from('student_goals')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active');

  for (const goal of activeGoals || []) {
    if (goal.target_type === 'score') {
      const currentScore = reportData.testResults?.totalScore;
      if (currentScore >= goal.target_value) {
        await markGoalAchieved(goal.id);
        await awardBadge(studentId, 'goal_achieved', goal.title);
      }
    }
    // ... 다른 목표 타입 처리
  }
}
```

#### 4.2.3. 성취 배지 시스템

```sql
-- 배지 테이블
CREATE TABLE badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,                -- 이모지 또는 아이콘 이름
  category TEXT NOT NULL,            -- 'score' | 'streak' | 'improvement' | 'goal'
  requirement JSONB NOT NULL,        -- 획득 조건
  rarity TEXT DEFAULT 'common'       -- 'common' | 'rare' | 'epic' | 'legendary'
);

-- 학생 배지 획득 기록
CREATE TABLE student_badges (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  badge_id INTEGER REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB                      -- 획득 맥락 (어떤 시험에서 등)
);

-- 초기 배지 데이터
INSERT INTO badges (name, description, icon, category, requirement, rarity) VALUES
('첫 발걸음', '첫 번째 시험 분석 완료', '👣', 'milestone', '{"first_report": true}', 'common'),
('90점 돌파', '90점 이상 달성', '🎯', 'score', '{"min_score": 90}', 'rare'),
('연속 학습왕', '3주 연속 학습 완료', '🔥', 'streak', '{"weeks": 3}', 'rare'),
('개선의 달인', '약점 영역 20% 이상 개선', '📈', 'improvement', '{"improvement_rate": 20}', 'epic'),
('완벽한 한 달', '한 달간 모든 전략 100% 실행', '💎', 'goal', '{"completion_rate": 100}', 'legendary');
```

#### 4.2.4. 학습 일지

```typescript
// src/app/student/journal/page.tsx
interface JournalEntry {
  id: number;
  student_id: number;
  date: string;
  study_duration: number;      // 분 단위
  topics: string[];            // 학습한 주제
  mood: 'great' | 'good' | 'okay' | 'hard' | 'frustrated';
  reflection: string;          // 자기 성찰
  next_focus: string;          // 다음 집중할 것
  created_at: string;
}
```

---

### 4.3. 외부 연동 (향후)

| 연동 | 용도 | 우선순위 |
|------|------|---------|
| **카카오톡 알림** | 학부모 알림 (한국 시장) | P2 |
| **Google Calendar** | 학습 일정 연동 | P3 |
| **노션 API** | 학생별 학습 노트 자동 생성 | P3 |

---

## 5. 비즈니스 모델

### 5.1. 타겟 시장

#### 5.1.1. 1차 타겟: 학부모 (B2C)

| 세그먼트 | 특성 | 니즈 |
|----------|------|------|
| **프리미엄 학부모** | 1:1 과외 이용, 높은 교육 투자 | 투명한 학습 현황, 성장 가시화 |
| **참여형 학부모** | 자녀 학습에 적극 관여 | 구체적 지도 방법, 실행 체크리스트 |

#### 5.1.2. 2차 타겟: 개인/소규모 과외 교사 (B2B)

| 세그먼트 | 규모 | 니즈 |
|----------|------|------|
| **개인 과외 교사** | 학생 1~10명 | 효율적 관리, 전문성 어필 |
| **소규모 학원** | 학생 10~50명 | 다수 학생 관리, 학부모 소통 |
| **교육 컨설턴트** | 학생 5~20명 | 심층 분석, 장기 성장 추적 |

---

### 5.2. 가격 정책 (안)

#### 5.2.1. 학부모용 (B2C)

| 플랜 | 가격 | 포함 기능 |
|------|------|----------|
| **무료** | 0원 | 리포트 열람, PDF 다운로드 |
| **프리미엄** | 9,900원/월 | + 실시간 알림, 체크리스트, 메시지 |

> 학부모는 대부분 **교사가 초대한 무료 사용자**로 시작

#### 5.2.2. 교사용 (B2B) - 핵심 수익 모델

| 플랜 | 가격 | 학생 수 | 포함 기능 |
|------|------|--------|----------|
| **Starter** | 무료 | 3명 | 기본 분석, 리포트 생성 |
| **Professional** | 29,000원/월 | 15명 | + AI 심층 분석, 전략 추적 |
| **Business** | 79,000원/월 | 50명 | + 다중 교사, API 접근, 우선 지원 |
| **Enterprise** | 별도 협의 | 무제한 | + 화이트라벨, 전용 서버 |

---

### 5.3. 수익 시뮬레이션

**1년차 목표** (보수적):

| 구분 | 수량 | 단가 | 월 매출 |
|------|------|------|--------|
| Professional 교사 | 50명 | 29,000원 | 1,450,000원 |
| Business 교사 | 10명 | 79,000원 | 790,000원 |
| 프리미엄 학부모 | 100명 | 9,900원 | 990,000원 |
| **합계** | - | - | **3,230,000원/월** |

**비용**:

| 항목 | 월 비용 |
|------|--------|
| Vercel Pro | $20 (≈27,000원) |
| Supabase Pro | $25 (≈34,000원) |
| Gemini API | ~$50 (≈68,000원) |
| Resend (이메일) | $20 (≈27,000원) |
| **합계** | **≈156,000원/월** |

**예상 순이익**: 약 3,000,000원/월

---

### 5.4. 교사 타겟 마케팅 전략

#### 5.4.1. 채널

| 채널 | 전략 |
|------|------|
| **네이버 카페** | 과외/학원 교사 커뮤니티 후기 마케팅 |
| **인스타그램** | 교육 인플루언서 협업 |
| **유튜브** | "AI로 과외 관리하는 법" 튜토리얼 |
| **교육 박람회** | B2B 리드 확보 |

#### 5.4.2. 핵심 가치 제안 (교사용)

```
"학생 관리에 쓰는 시간을 절반으로,
학부모 신뢰는 두 배로"

✅ AI가 시험 분석 → 전문성 어필
✅ 성장 리포트 자동 생성 → 학부모 만족
✅ 데이터 기반 컨설팅 → 차별화된 서비스
✅ 학생 수 증가해도 관리 부담 동일
```

#### 5.4.3. 온보딩 전략

1. **무료 체험**: Starter 플랜으로 3명까지 무료 사용
2. **성공 사례 공유**: 첫 리포트 생성 후 "이렇게 활용하세요" 가이드
3. **1:1 온보딩 콜**: 첫 Professional 구독 시 30분 셋업 지원
4. **레퍼럴 프로그램**: 교사 추천 시 양쪽 1개월 무료

---

## 6. 상용화 배포 계획

### 6.1. Step 1: MVP 배포 (1주)

#### 6.1.1. 인프라 설정

```bash
# Vercel Pro 업그레이드
vercel upgrade pro

# 환경 변수 설정
vercel env add GEMINI_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add SENTRY_DSN production
```

#### 6.1.2. 모니터링 설정 (Sentry)

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### 6.1.3. 베타 테스터 선정

- 충성도 높은 학부모 3~5명 선정
- 개인 연락으로 베타 테스트 요청
- 피드백 수집 채널 준비 (카카오톡 또는 폼)

---

### 6.2. Step 2: 안정화 (2주)

#### 6.2.1. 베타 피드백 반영

```
[ ] UI/UX 개선 사항
[ ] 버그 수정
[ ] 성능 이슈 해결
[ ] 누락 기능 보완
```

#### 6.2.2. 보안 점검

```
[ ] Rate Limiting 동작 확인
[ ] Input Validation 테스트
[ ] RLS 정책 검증
[ ] API 키 노출 확인
```

---

### 6.3. Step 3: 정식 오픈 (1주)

- 전체 학부모 계정 생성
- 초대 이메일 발송
- 사용 가이드 제공
- 피드백 채널 안내

---

### 6.4. Step 4: 교사 확장 (4주)

- 랜딩 페이지 제작 (교사용)
- 가격 정책 공개
- 결제 시스템 연동 (Stripe/토스페이먼츠)
- 마케팅 캠페인 시작

---

## 7. 운영 고도화 계획

### 7.1. CI/CD 파이프라인

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npx playwright test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 7.2. Feature Flag 시스템

```typescript
// src/lib/feature-flags.ts
type FeatureFlag =
  | 'parent_notifications'
  | 'student_dashboard'
  | 'ai_queue_system'
  | 'new_report_type';

const FLAGS: Record<FeatureFlag, boolean> = {
  parent_notifications: false,  // 개발 완료 후 true로
  student_dashboard: false,
  ai_queue_system: false,
  new_report_type: false,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  // 환경 변수로 오버라이드 가능
  const envKey = `NEXT_PUBLIC_FF_${flag.toUpperCase()}`;
  if (process.env[envKey] === 'true') return true;
  if (process.env[envKey] === 'false') return false;
  return FLAGS[flag];
}

// 사용 예시
if (isFeatureEnabled('parent_notifications')) {
  await sendNotification(...);
}
```

### 7.3. 모니터링 대시보드

**추적 지표**:

| 지표 | 도구 | 알림 조건 |
|------|------|----------|
| 에러율 | Sentry | > 1%/시간 |
| API 응답 시간 | Vercel Analytics | > 3초 |
| DB 연결 | Supabase | 연결 실패 |
| Rate Limit 도달 | Upstash | 일일 80% 도달 |

---

## 8. 실행 로드맵

### 8.1. 즉시 실행 (Week 1) - ✅ 완료

```
Day 1-2: 보안 강화
  [x] Upstash 계정 생성 및 Rate Limiting 구현 ✅
  [x] Zod 설치 및 Input Validation 적용 ✅
  [x] Sentry 설치 및 에러 모니터링 설정 ✅

Day 3-4: 인프라 설정
  [ ] Vercel Pro 업그레이드 (옵션)
  [ ] Supabase Pro 업그레이드 (옵션)
  [x] 환경 변수 정리 ✅

Day 5-7: 베타 배포
  [ ] 프로덕션 배포
  [ ] 베타 테스터 초대
  [ ] 피드백 수집 시작
```

### 8.2. 2-3주차: 안정화 - 🔄 진행 중

```
[ ] 베타 피드백 반영
[x] E2E 테스트 작성 ✅ (e2e/admin.spec.ts, auth.spec.ts, parent.spec.ts, anchor-loop.spec.ts)
[ ] 성능 최적화
[ ] 문서화 (사용 가이드)
```

### 8.3. 4주차: 정식 오픈

```
[ ] 전체 학부모 오픈
[ ] 학부모 알림 시스템 (Phase 3.1)
[ ] 체크리스트 기능 (Phase 3.1)
```

### 8.4. 5-8주차: 교사 확장

```
[ ] 결제 시스템 연동
[ ] 교사용 랜딩 페이지
[ ] 멀티테넌시 구조 (여러 교사 지원)
[ ] 마케팅 캠페인 시작
```

### 8.5. 9-12주차: 학생 기능

```
[ ] 학생 대시보드 (Phase 3.2)
[ ] 목표 설정 시스템
[ ] 배지 시스템
[ ] 학습 일지
```

---

## 부록: 기술 스택 요약

| 영역 | 현재 상태 | 비고 |
|------|----------|------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 | ✅ |
| **Backend** | Next.js API Routes, Supabase | ✅ |
| **Database** | Supabase PostgreSQL | ✅ |
| **AI** | Google Gemini 2.5 Flash/Pro (모델 라우팅) | ✅ `model-router.ts` |
| **Auth** | Supabase Auth | ✅ |
| **Hosting** | Vercel | ✅ |
| **Rate Limiting** | Upstash Redis (In-memory fallback 지원) | ✅ `rate-limiter.ts` |
| **Validation** | Zod | ✅ `validations.ts` |
| **Monitoring** | Sentry (@sentry/nextjs) | ✅ |
| **Email** | Resend | ✅ `email.ts` |
| **Feature Flags** | 커스텀 구현 | ✅ `feature-flags.ts` |
| **Testing** | Playwright E2E | ✅ `e2e/` |
| **Payment** | - | ⏳ 구현 필요 |

---

**작성일**: 2025-12-31
**최종 업데이트**: 2026-04-29
**다음 검토일**: 결제 시스템 구현 후
**담당자**: 교사 (프로젝트 오너)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2025-12-31 | 최초 작성 |
| v1.1 | 2026-04-29 | Rate Limiting, Validation, Sentry, E2E Tests 등 구현 완료 상태 반영 |
