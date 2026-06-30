# Architecture & Engineering Reference — Math Learning Platform

> 이 문서는 프로젝트의 아키텍처, 서비스, 개발 워크플로, 규칙의 상세 레퍼런스입니다.
> 작업 원칙과 진입점은 루트 [CLAUDE.md](../CLAUDE.md), 데이터 모델은 [DATA_MODELS.md](./DATA_MODELS.md)를 참고하세요.

---

## Project Overview

**Math Learning Platform** is a Next.js-based web application that analyzes student math test performance and generates comprehensive learning reports. It uses AI (Google Gemini) for deep analysis, Supabase PostgreSQL for cloud data storage, and is deployed on Vercel.

### Key Features
- Student management with role-based access (Teacher, Parent, Student)
- **Growth Loop System (6 Report Types):**
  - **Level Test (Baseline)** - 신규 학생 진단, 기준점 설정
  - **Test Analysis** - 시험지 AI 분석, 5가지 관점 심층 분석
  - **Weekly Report (Micro Loop)** - 주간 학습 정리, 목표 피드백
  - **Monthly Report (Micro Loop)** - 월간 성장 분석, AI 분석 통합
  - **Semi-Annual Report (Macro Loop)** - 6개월 성장 궤적, 메타프로필 진화
  - **Annual Report (Macro Loop)** - 1년 성장 스토리, Baseline 대비 분석
- AI-powered test paper analysis with 5-perspective deep analysis
- **Anchor Loop System:**
  - 리포트 저장 시 자동 메타프로필 업데이트
  - 5개 핵심 지표 추적 (Baseline, ErrorSignature, AbsorptionRate, SolvingStamina, MetaCognitionLevel)
- **Class Management System:**
  - Schedule management (weekly class schedules)
  - Class session recording (learning keywords, understanding/attention levels)
  - Assignment tracking and management
- **Student Profile Auto-Extraction:**
  - Automatic weakness/strength/pattern extraction from all report types
  - Status tracking (active → improving → resolved → recurring)
  - Profile history for audit trail
- **Parent Dashboard with Growth Loop Visualization:**
  - 성장 여정 진행률 표시 (6단계)
  - 성장 서사 요약 (연간/반기 리포트)
  - Baseline 미설정 경고
- Data visualization with charts (Recharts)
- PDF export functionality
- Cloud-first architecture with Supabase
- Real-time parent access to student reports

### Target Users
| Role | Count | Primary Functions |
|------|-------|-------------------|
| **Teacher** | 1 | Student management, report generation, parent account management |
| **Parents** | ~25 | View child's reports, growth graphs, PDF download |
| **Students** | ~25 | View own reports, learning plans |

---

## Core Purpose and Philosophy

**"개인별 수학 학습 현황을 분석하고 학습 능력을 성장시키기 위함"**
**"Analyze individual math learning status and foster learning growth"**

### Design Principles
1. **Data Continuity Over One-Time Assessment:** Every feature should support long-term tracking and growth analysis
2. **Actionable Insights:** Reports must provide specific, executable recommendations with 5 elements (무엇을, 어디서, 얼마나, 어떻게, 측정 방법)
3. **Cloud-First:** Supabase ensures data availability across all devices
4. **Type Safety:** Strict TypeScript usage to prevent runtime errors
5. **Avoid Over-Engineering:** Keep solutions simple and focused on the core purpose
6. **Security First:** API keys never exposed to client, all sensitive operations server-side

---

## Tech Stack

### Core Framework
- **Next.js 16.1.0** (App Router with Turbopack) - Full-stack React framework
- **TypeScript 5.x** - Type-safe development (Strict mode)
- **React 19.2.1** - UI framework (patched for CVE-2025-55182)

### Backend & Database
- **Supabase PostgreSQL** - Cloud database with Row Level Security
- **Supabase Auth** - Authentication (email/password)
- **Vercel** - Hosting and serverless functions

### UI & Styling
- **Tailwind CSS 4.x** - Utility-first CSS framework
- **Recharts 3.x** - Data visualization library

### AI & Data Processing
- **Google Gemini API** (`@google/genai`) - AI analysis engine
  - Pro Model: `gemini-pro-latest` for high-stakes reports
  - Flash Model: `gemini-flash-latest` for regular reports
- **PapaParse 5.x** - CSV parsing for bulk imports

### Export
- **html2canvas 1.x** - Screenshot generation for PDF
- **jspdf 3.x** - PDF document generation

### Environment Variables
```bash
# .env.local (gitignored)
GEMINI_API_KEY=your_gemini_api_key          # Server-side only
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # Public (safe)
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # Server-side only (SENSITIVE)
```

---

## Architecture

### System Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     Service Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   👨‍🏫 Teacher                    👩‍👧 Parents/Students        │
│   ┌───────────────┐           ┌───────────────┐            │
│   │ Admin Dashboard│           │ Parent Dashboard│           │
│   └───────┬───────┘           └───────┬───────┘            │
│           └───────────┬───────────────┘                    │
│                       ▼                                    │
│             [project].vercel.app                           │
│              (Vercel - Free Tier)                          │
│                       │                                    │
│         ┌─────────────┴─────────────┐                      │
│         ▼                           ▼                      │
│   ┌─────────────┐           ┌─────────────┐                │
│   │ API Routes  │           │  Supabase   │                │
│   │ (Server)    │           │ PostgreSQL  │                │
│   └──────┬──────┘           └─────────────┘                │
│          │                                                 │
│          ▼                                                 │
│   ┌─────────────┐                                          │
│   │ Gemini API  │                                          │
│   │ (AI Analysis)│                                          │
│   └─────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
```
1. INPUT → Teacher uploads test images → Enters test metadata
2. PROCESSING → API Route calls Gemini → Receives structured JSON analysis
3. STORAGE → Results saved to Supabase PostgreSQL
4. ACCESS → Parents/Students login → View reports with RLS protection
5. OUTPUT → Data visualized with Recharts → Exported as PDF
```

### Request Flow
```
Client (Browser)
    │
    ▼
Next.js Page/Component (Client-side)
    │
    ▼
API Route (/api/*) (Server-side) ← GEMINI_API_KEY used here
    │
    ▼
Supabase Client (Server-side with service role)
    │
    ▼
PostgreSQL Database (with RLS policies)
```

---

## Directory Structure

```
math-learning-platform/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (auth)/                   # Auth group (login, signup)
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── admin/                    # Teacher dashboard
│   │   │   ├── page.tsx              # Main dashboard (with "오늘 수업" section)
│   │   │   ├── students/page.tsx     # Student management
│   │   │   ├── schedules/page.tsx    # Class schedule management (NEW)
│   │   │   ├── class-record/page.tsx # Class session recording (NEW)
│   │   │   ├── assignments/page.tsx  # Assignment management (NEW)
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx          # Report list
│   │   │   │   ├── create/page.tsx   # Report type selection (Growth Loop menu)
│   │   │   │   ├── new/page.tsx      # Test analysis creation
│   │   │   │   ├── level-test/new/page.tsx   # Level Test (Baseline) ✨
│   │   │   │   ├── weekly/new/page.tsx       # Weekly report (Micro Loop) ✨
│   │   │   │   ├── monthly/new/page.tsx      # Monthly report (Micro Loop)
│   │   │   │   ├── semi-annual/new/page.tsx  # Semi-annual report (Macro Loop) ✨
│   │   │   │   ├── annual/new/page.tsx       # Annual report (Macro Loop) ✨
│   │   │   │   ├── consolidated/new/page.tsx # Consolidated report
│   │   │   │   └── [id]/page.tsx     # Report detail
│   │   │   └── parents/page.tsx      # Parent management
│   │   ├── parent/                   # Parent dashboard
│   │   │   ├── page.tsx              # Parent main (with Growth Loop status) ✨
│   │   │   └── reports/[id]/page.tsx # Report view
│   │   ├── api/
│   │   │   ├── analyze/route.ts      # Gemini API (Test Analysis)
│   │   │   ├── level-test/analyze/route.ts   # Level Test API ✨
│   │   │   ├── weekly-report/generate/route.ts   # Weekly Report API ✨
│   │   │   ├── monthly-report/generate/route.ts  # Monthly Report API ✨
│   │   │   ├── semi-annual-report/generate/route.ts # Semi-Annual API ✨
│   │   │   ├── annual-report/generate/route.ts   # Annual Report API ✨
│   │   │   └── meta-profile/update/route.ts  # Anchor Loop API ✨
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing page
│   │
│   ├── lib/                          # Services & utilities
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server Supabase client
│   │   ├── gemini.ts                 # Gemini API wrapper
│   │   └── student-profile-extractor.ts  # Profile auto-extraction (NEW)
│   │
│   └── types/
│       └── index.ts                  # TypeScript type definitions
│
├── .claude/                          # Claude Code configuration
│   ├── hooks/
│   │   └── session-start.sh          # SessionStart hook
│   ├── commands/                     # Custom slash commands
│   │   ├── report-page.md            # /report-page command
│   │   ├── supabase-crud.md          # /supabase-crud command
│   │   └── admin-page.md             # /admin-page command
│   └── settings.json                 # Hook registration
│
├── .env.local                        # Environment variables (gitignored)
├── package.json
├── tailwind.config.js
├── tsconfig.json
│
├── CLAUDE.md                         # This file - AI assistant guide
├── MathLearning_PRD_v3.0_Implementation.md  # Product requirements
├── ML_ENGINE_ENHANCEMENT_PLAN.md     # ML Engine roadmap
├── IMPROVEMENT_ROADMAP.md            # Development roadmap
├── PROMPT_IMPROVEMENT_PROPOSAL.md    # AI prompt improvements
└── QA_AND_OPTIMIZATION.md            # QA plan
```

**Important Notes:**
- All source code is in `/src/`
- Types are centralized in `src/types/index.ts` (Single Source of Truth)
- API routes handle all server-side logic (Gemini API, sensitive operations)
- Supabase clients: `client.ts` for browser, `server.ts` for API routes

---


> **데이터 모델 정의는 [DATA_MODELS.md](./DATA_MODELS.md)로 이전되었습니다.**

## Key Services

### 1. Supabase Client (`src/lib/supabase/`)

**Browser Client (`client.ts`):**
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Server Client (`server.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => { /* ... */ }
      }
    }
  );
}
```

### 2. Gemini Service (`src/lib/gemini.ts`)

**Key Functions:**
- `analyzeTestPaper(studentName, formData, currentImages, pastImages)` - Main analysis function

**Prompt Engineering (5-Perspective Analysis):**
```typescript
const SYSTEM_PROMPT = `당신은 학생의 수학 학습을 종합적으로 컨설팅하는 전문 AI 교육 컨설턴트입니다.

## 핵심 목표 5가지
1. 학생의 현재 학습 현황을 매우 정확히 파악
2. 오답의 근본 원인과 사고 패턴 분석
3. 잠재적 위험 습관 조기 탐지
4. 실행 가능한 구체적 개선 방법 제시 (5요소 필수)
5. 장기적 성장 비전 제공 (3개월, 6개월 예측)

## 문항별 심층 분석: 5가지 관점 (필수)
1️⃣ 사고의 출발점 분석: 문제를 보고 가장 먼저 무엇을 시도했는가?
2️⃣ 풀이 진행 과정 분석: 풀이의 어느 단계에서 막혔거나 틀렸는가?
3️⃣ 계산 및 실수 패턴: 단순 계산 실수인가, 개념적 오류인가?
4️⃣ 문제 해석 능력: 문제의 조건을 정확히 파악했는가?
5️⃣ 풀이 습관 관찰: 풀이 과정을 단계적으로 기록했는가?

## 개선 전략 5요소 (모든 전략에 필수 포함)
- 무엇을: 구체적 교재, 자료
- 어디서: 페이지, 챕터
- 얼마나: 횟수, 시간
- 어떻게: 구체적 방법
- 측정 방법: 성과 확인 기준`;
```

### 3. API Route (`src/app/api/analyze/route.ts`)

**Server-side Gemini API call:**
```typescript
export async function POST(request: Request) {
  // 1. Parse request body
  const { studentName, formData, currentImages, pastImages } = await request.json();

  // 2. Call Gemini API (API key is server-side only)
  const analysisData = await analyzeTestPaper(
    studentName, formData, currentImages, pastImages
  );

  // 3. Return structured response
  return Response.json({ success: true, analysisData });
}
```

### 4. Student Profile Extractor (`src/lib/student-profile-extractor.ts`) (NEW)

**Purpose:** Automatically extract weaknesses, strengths, and patterns from report analysis data.

**Key Functions:**
```typescript
// 시험 분석 리포트에서 프로필 업데이트
export async function updateStudentProfile(
  studentId: number,
  reportId: number,
  analysisData: AnalysisData
): Promise<{ success: boolean; error?: string }>;

// 월간 리포트에서 프로필 업데이트
export async function updateStudentProfileFromMonthly(
  studentId: number,
  reportId: number,
  monthlyData: MonthlyReportData
): Promise<{ success: boolean; error?: string }>;

// 주간 리포트에서 프로필 업데이트
export async function updateStudentProfileFromWeekly(
  studentId: number,
  reportId: number,
  weeklyData: WeeklyReportData
): Promise<{ success: boolean; error?: string }>;

// 통합 리포트에서 프로필 업데이트
export async function updateStudentProfileFromConsolidated(
  studentId: number,
  reportId: number,
  consolidatedData: ConsolidatedReportData
): Promise<{ success: boolean; error?: string }>;

// 활성 취약점 조회
export async function getActiveWeaknesses(studentId: number): Promise<StudentWeakness[]>;

// 활성 강점 조회
export async function getActiveStrengths(studentId: number): Promise<StudentStrength[]>;

// 활성 패턴 조회
export async function getActivePatterns(studentId: number): Promise<StudentPattern[]>;
```

**Extraction Sources:**
| Report Type | Weaknesses From | Strengths From |
|-------------|-----------------|----------------|
| Test Analysis | macroAnalysis.weaknesses, detailedAnalysis errors, riskFactors | macroAnalysis.strengths, high scores, optimal solutions |
| Monthly | learningContent (not_good), needsImprovement | learningContent (excellent), whatWentWell |
| Weekly | learningContent (not_good), improvements | learningContent (excellent), achievements |
| Consolidated | macroAnalysis.weaknesses, actionablePrescription | macroAnalysis.strengths |

**Status Transitions:**
```
new weakness → active → improving → resolved
                          ↓
                       recurring (if detected again after resolved)
```

### 5. Growth Loop System (NEW) ✨

성장 서사 및 순환 학습 시스템. 학생의 장기적 성장을 추적하고 피드백합니다.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    GROWTH LOOP SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┐                                                 │
│  │ BASELINE  │ ← Level Test (신규 학생)                        │
│  │ (기준점)   │   → StudentMetaProfile 초기화                   │
│  └─────┬─────┘                                                 │
│        │                                                       │
│        ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              MICRO LOOP (주간/월간)                  │       │
│  │  ┌──────┐     ┌───────┐     ┌───────┐              │       │
│  │  │Weekly│ ──▶ │Monthly│ ──▶ │ Test  │ ──▶ ...      │       │
│  │  │Report│     │Report │     │Report │              │       │
│  │  └──────┘     └───────┘     └───────┘              │       │
│  │      ↑            ↑             ↑                   │       │
│  │      └────────────┴─────────────┘                   │       │
│  │         Anchor Loop (메타프로필 업데이트)            │       │
│  └─────────────────────────────────────────────────────┘       │
│        │                                                       │
│        ▼  (6개월마다)                                          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              MACRO LOOP (반기/연간)                  │       │
│  │  ┌──────────┐     ┌──────────┐                      │       │
│  │  │Semi-Annual│ ──▶ │ Annual  │                      │       │
│  │  │  Report   │     │ Report  │                      │       │
│  │  └──────────┘     └──────────┘                      │       │
│  │       │                │                            │       │
│  │       └────────────────┘                            │       │
│  │       Growth Story (성장 서사 생성)                  │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Report Types & Purpose:**

| Type | Korean | Loop | Purpose |
|------|--------|------|---------|
| `level_test` | 레벨 테스트 | Baseline | 신규 학생 진단, 메타프로필 초기화 |
| `test` | 시험 분석 | Micro | AI 5관점 분석, 실행 전략 제시 |
| `weekly` | 주간 리포트 | Micro | 주간 목표 피드백, 연속성 점수 |
| `monthly` | 월간 리포트 | Micro | 월간 종합, AI 분석 통합 |
| `semi_annual` | 반기 리포트 | Macro | 6개월 성장 궤적, 취약점 해결 현황 |
| `annual` | 연간 리포트 | Macro | 성장 스토리, Baseline 대비 분석 |

**Anchor Loop (메타프로필 자동 업데이트):**
```typescript
// 모든 리포트 저장 후 자동 호출
await fetch('/api/meta-profile/update', {
  method: 'POST',
  body: JSON.stringify({
    studentId,
    reportId,
    analysisData,
    reportType,  // 리포트 타입에 따라 업데이트 로직 분기
  }),
});
```

**StudentMetaProfile (5개 핵심 지표):**
```typescript
interface StudentMetaProfile {
  baseline: Baseline;                    // 초기 기준점
  errorSignature: ErrorSignature;        // 오류 패턴
  absorptionRate: AbsorptionRate;        // 학습 흡수율
  solvingStamina: SolvingStamina;        // 풀이 지구력
  metaCognitionLevel: MetaCognitionLevel; // 메타인지 수준
}
```

**API Routes:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/level-test/analyze` | POST | Baseline 설정, 메타프로필 초기화 |
| `/api/weekly-report/generate` | POST | 주간 리포트 AI 생성 |
| `/api/monthly-report/generate` | POST | 월간 리포트 AI 생성 |
| `/api/semi-annual-report/generate` | POST | 반기 종합 AI 분석 |
| `/api/annual-report/generate` | POST | 연간 종합 AI 분석 |
| `/api/meta-profile/update` | POST | Anchor Loop 실행 |

### 6. Model Router (`src/lib/model-router.ts`) ✨ NEW

AI 모델 라우팅 시스템으로 리포트 타입/학년/시험명에 따라 Pro/Flash 모델을 자동 선택합니다.

```typescript
import { routeModel, type ModelRoutingContext } from '@/lib/model-router';

const context: ModelRoutingContext = {
  reportType: 'level_test',
  studentGrade: 10,
  testName: '중간고사',
};
const modelName = routeModel(context); // Returns 'gemini-pro-latest'
```

| 리포트 타입 | 모델 | 이유 |
|------------|------|------|
| level_test, semi_annual, annual | Pro | 중요도 높음 |
| weekly, monthly | Flash | 빈번한 생성 |
| test | Adaptive | 학년/시험 유형에 따라 분기 |

### 7. Rate Limiter (`src/lib/rate-limiter.ts`) ✨ NEW

Upstash Redis 기반 분산 Rate Limiter (In-memory fallback 지원)

```typescript
import { applyRateLimitAsync } from '@/lib/rate-limiter';

// API Route에서 사용
const result = await applyRateLimitAsync(request, 'AI_ANALYSIS');
if (!result.success) {
  return NextResponse.json({ error: '요청 한도 초과' }, { status: 429 });
}
```

| 제한 유형 | 한도 | 윈도우 |
|----------|------|--------|
| AI_ANALYSIS | 5회 | 1분 |
| GENERAL | 60회 | 1분 |

### 8. Input Validation (`src/lib/validations.ts`) ✨ NEW

Zod 스키마 기반 서버사이드 입력 검증

```typescript
import { validateRequest, weeklyReportRequestSchema } from '@/lib/validations';

const validation = validateRequest(weeklyReportRequestSchema, rawBody);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
const { studentId, year, weekNumber } = validation.data;
```

### 9. Feature Flags (`src/lib/feature-flags.ts`) ✨ NEW

기능 토글 시스템

```typescript
import { isFeatureEnabled } from '@/lib/feature-flags';

if (isFeatureEnabled('parent_notifications')) {
  await sendNotification(...);
}
```

---

## Development Workflow

### Setup
```bash
# Install dependencies
npm install

# Set environment variables (create .env.local)
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

### Development Server
- Runs on `http://localhost:3000` (Next.js default)
- Hot Module Replacement (HMR) enabled
- TypeScript errors shown in terminal and browser

### Using Claude Code Slash Commands
```bash
# Generate a new report page
/report-page weekly /admin/reports/weekly/new

# Generate CRUD pages for a Supabase table
/supabase-crud assignments /admin/assignments

# Generate an authenticated admin page
/admin-page 설정 /admin/settings
```

---

## Code Conventions

### TypeScript Standards
1. **Strict Mode:** Always enabled
2. **No `any`:** Use `unknown` if type is truly dynamic
3. **Interface over Type:** Use `interface` for objects, `type` for unions
4. **Explicit Return Types:** For complex functions
5. **Type Imports:** Use `import type { ... }` for type-only imports

### Component Structure (Next.js App Router)
```typescript
'use client';  // Mark as client component if needed

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student } from '@/types';

interface PageProps {
  params: { id: string };
}

export default function PageName({ params }: PageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      router.push('/login');
      return;
    }

    // Load user data...
    setLoading(false);
  };

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Content */}
    </div>
  );
}
```

### Naming Conventions
- **Components:** PascalCase (`StudentSelector`, `ReportView`)
- **Files:** Match route (`page.tsx`, `route.ts`)
- **Functions/Variables:** camelCase (`getAllStudents`, `studentData`)
- **Types/Interfaces:** PascalCase (`Student`, `AnalysisReport`)

### Styling (Tailwind CSS)
```typescript
// Standard card
<div className="bg-white rounded-xl shadow-sm p-6">

// Primary button
<button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">

// Input field
<input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">

// Table
<table className="w-full">
  <thead className="bg-gray-50 border-b">
  <tbody className="divide-y divide-gray-200">
```

---

## Common Tasks

### Adding a New Student
```typescript
const supabase = createClient();
const { error } = await supabase.from('students').insert({
  student_id: 'M2507001',
  name: '홍길동',
  grade: 7,
  school: 'Example Middle School',
  start_date: '2025-03-01',
});
```

### Creating a Test Analysis Report
```typescript
// 1. Call API route to analyze
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studentName,
    formData,
    currentImages,  // base64 encoded
  }),
});
const { analysisData } = await response.json();

// 2. Save to database
const supabase = createClient();
await supabase.from('reports').insert({
  student_id: selectedStudentId,
  report_type: 'test',
  test_name: formData.testName,
  test_date: formData.testDate,
  total_score: analysisData.testResults.totalScore,
  max_score: formData.maxScore,
  analysis_data: analysisData,
});
```

### Querying Reports by Student
```typescript
const supabase = createClient();
const { data: reports } = await supabase
  .from('reports')
  .select('*, students(name, student_id, grade)')
  .eq('student_id', studentId)
  .order('test_date', { ascending: false });
```

### Recording a Class Session (NEW)
```typescript
const supabase = createClient();
const sessionData = {
  student_id: selectedStudentId,
  session_date: '2025-01-15',
  start_time: '15:00',
  end_time: '16:30',
  learning_keywords: ['일차방정식', '이항'],
  covered_concepts: ['등식의 성질', '이항의 원리'],
  understanding_level: 4,
  attention_level: 3,
  notes: '분배법칙 복습 필요',
};

const { error } = await supabase.from('class_sessions').insert(sessionData);
```

### Getting Today's Scheduled Students (NEW)
```typescript
const supabase = createClient();
const today = new Date().getDay();  // 0-6

const { data: todaySchedules } = await supabase
  .from('schedules')
  .select('*, students(id, name, grade, student_id)')
  .eq('day_of_week', today)
  .eq('is_active', true)
  .order('start_time');
```

### Getting Student's Active Weaknesses (NEW)
```typescript
import { getActiveWeaknesses } from '@/lib/student-profile-extractor';

const weaknesses = await getActiveWeaknesses(studentId);
// Returns: StudentWeakness[] sorted by severity (desc)
```

### Creating Report with Profile Extraction (NEW)
```typescript
import { updateStudentProfile } from '@/lib/student-profile-extractor';

// 1. Save report
const { data: report, error } = await supabase
  .from('reports')
  .insert({ ... })
  .select('id')
  .single();

// 2. Extract profile data automatically
if (report?.id) {
  await updateStudentProfile(studentId, report.id, analysisData);
}
```

---

## AI Integration

### Gemini API Best Practices

**1. Always use Server-side API Routes**
```typescript
// ❌ WRONG: Client-side API call
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ✅ CORRECT: Server-side in API route
// src/app/api/analyze/route.ts
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;  // Only accessible server-side
  const ai = new GoogleGenAI({ apiKey });
  // ...
}
```

**2. Use Model Router for Hybrid Routing** ✨ NEW
```typescript
import { routeModel } from '@/lib/model-router';

// Model is automatically selected based on report type and context
const modelName = routeModel({
  reportType: 'level_test',  // Pro model
  studentGrade: 11,
  testName: '모의고사',
});
```

**2. Structured Output with JSON Schema**
```typescript
const response = await ai.models.generateContent({
  model: modelName,  // dynamically selected via routeModel()
  contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
  config: {
    responseMimeType: 'application/json',
    responseSchema: ANALYSIS_SCHEMA,
  },
});
```

**3. Error Handling**
```typescript
try {
  const response = await ai.models.generateContent({...});
  const text = response.text;
  if (!text) throw new GeminiApiError('Empty response');
  return JSON.parse(text);
} catch (error) {
  if (error instanceof GeminiApiError) throw error;
  throw new GeminiApiError('AI 분석 중 오류 발생', error);
}
```

---

## Testing and Build

### Build Commands
```bash
# TypeScript + Next.js build
npm run build

# Output shows all routes:
# ○ (Static)  - prerendered as static
# ƒ (Dynamic) - server-rendered on demand
```

### Manual Testing Checklist
- [ ] Login/Signup flow
- [ ] Add/edit/delete student
- [ ] Generate test analysis report
- [ ] Generate monthly report
- [ ] Generate consolidated report
- [ ] View report detail
- [ ] PDF export (if implemented)
- [ ] Responsive design on mobile
- [ ] Error handling (invalid inputs, API failures)
- [ ] **Growth Loop System (NEW):** ✨
  - [ ] Level Test: Baseline 설정, 메타프로필 초기화
  - [ ] Weekly Report: AI 분석, Micro Loop 피드백
  - [ ] Monthly Report: AI 분석 통합
  - [ ] Semi-Annual Report: 6개월 성장 분석
  - [ ] Annual Report: 성장 스토리 생성
  - [ ] Anchor Loop: 리포트 저장 후 메타프로필 업데이트 확인
- [ ] **Parent Dashboard (NEW):** ✨
  - [ ] Growth Loop 진행 상황 표시
  - [ ] 성장 서사 요약 표시 (연간/반기)
  - [ ] Baseline 미설정 경고 표시
  - [ ] 리포트 타입별 배지 색상 확인
- [ ] **Class Management:**
  - [ ] Create/edit/delete class schedules
  - [ ] Record class sessions with learning keywords
  - [ ] Add/complete/delete assignments
  - [ ] View today's class section on dashboard
- [ ] **Profile Extraction:**
  - [ ] Verify weaknesses extracted after report creation
  - [ ] Check weakness status transitions
  - [ ] View student's active weaknesses on dashboard

### Linting
```bash
npm run lint
```

### E2E Testing (Playwright) ✨ NEW

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/anchor-loop/anchor-loop.spec.ts

# Run with UI
npx playwright test --ui

# Run with browser visible
npx playwright test --headed
```

**Test Files:**
| File | Purpose |
|------|---------|
| `e2e/admin.spec.ts` | 교사 관리자 기능 테스트 |
| `e2e/auth.spec.ts` | 인증 플로우 테스트 |
| `e2e/parent.spec.ts` | 학부모 대시보드 테스트 |
| `e2e/anchor-loop/anchor-loop.spec.ts` | Anchor Loop 통합 테스트 |

### Error Monitoring (Sentry) ✨ NEW

Sentry를 통한 실시간 에러 모니터링이 설정되어 있습니다.

```typescript
// 에러는 자동으로 Sentry에 보고됩니다
// 환경 변수: SENTRY_DSN (Vercel에서 설정)
```

---

## Security Guidelines

### API Key Protection

**❌ Never Do:**
```typescript
// Exposing API key in client code
const apiKey = 'AIzaSyD1234567890';
```

**✅ Always Do:**
```typescript
// Server-side only (API route)
const apiKey = process.env.GEMINI_API_KEY;
```

### Environment Variables
| Variable | Exposure | Usage |
|----------|----------|-------|
| `GEMINI_API_KEY` | Server only | AI analysis |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (safe) | Client Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (safe) | Client auth |

### Checklist
- [ ] `.env.local` in `.gitignore`
- [ ] No API keys in client components
- [ ] All sensitive operations in API routes
- [ ] Supabase RLS policies configured
- [ ] Google Cloud budget alerts set

---

## Optimization Considerations

### Performance
1. **Image Optimization:** Resize before upload
2. **Lazy Loading:** Use `React.lazy()` for heavy components
3. **Caching:** Leverage Next.js caching mechanisms
4. **API Efficiency:** Minimize Gemini API calls

### Database
1. **Indexes:** Use indexed fields for queries
2. **JSONB:** Store complex data in `analysis_data` column
3. **RLS:** Row Level Security for data access control

### Cost Optimization
- **Gemini API:** Cache results, optimize prompts
- **Supabase:** Stay within free tier (500MB DB)
- **Vercel:** Stay within free tier (100GB bandwidth)

---

## Quick Reference

### When Adding Features
1. Define types in `src/types/index.ts`
2. Create API route if server-side logic needed
3. Create page component in `src/app/`
4. Follow existing patterns for auth check
5. Test on build: `npm run build`

### When Fixing Bugs
1. Check TypeScript errors: `npm run build`
2. Identify layer: Client / API Route / Database
3. Review Supabase logs for DB issues
4. Test auth flow if access issues

### Git Workflow
```bash
# Commit format
git commit -m "feat: add monthly report page"
git commit -m "fix: resolve auth redirect issue"
git commit -m "docs: update CLAUDE.md"

# Push to branch
git push -u origin claude/branch-name
```

---

**Last Updated:** 2026-04-29
**Platform:** Next.js 16.1.0 + Supabase + Vercel
**For questions, refer to PRD and other documentation files.**
