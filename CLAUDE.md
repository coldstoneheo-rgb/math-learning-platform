# CLAUDE.md - AI Assistant Guide

This document provides comprehensive guidance for AI assistants working with the Math Learning Platform codebase.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Purpose and Philosophy](#core-purpose-and-philosophy)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Directory Structure](#directory-structure)
6. [Data Models](#data-models)
7. [Key Services](#key-services)
8. [Development Workflow](#development-workflow)
9. [Code Conventions](#code-conventions)
10. [Common Tasks](#common-tasks)
11. [AI Integration](#ai-integration)
12. [Testing and Build](#testing-and-build)
13. [Security Guidelines](#security-guidelines)
14. [Optimization Considerations](#optimization-considerations)

---

## Project Overview

**Math Learning Platform** is a Next.js-based web application that analyzes student math test performance and generates comprehensive learning reports. It uses AI (Google Gemini) for deep analysis, Supabase PostgreSQL for cloud data storage, and is deployed on Vercel.

### Key Features
- Student management with role-based access (Teacher, Parent, Student)
- Four report types: Weekly, Monthly, Test Analysis, and Consolidated
- AI-powered test paper analysis with 5-perspective deep analysis
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
- **Next.js 16.0.7** (App Router) - Full-stack React framework
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
  - Model: `gemini-2.5-flash` for speed and analysis
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
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   ├── students/page.tsx     # Student management
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx          # Report list
│   │   │   │   ├── new/page.tsx      # Test analysis creation
│   │   │   │   ├── monthly/new/page.tsx      # Monthly report
│   │   │   │   ├── consolidated/new/page.tsx # Consolidated report
│   │   │   │   └── [id]/page.tsx     # Report detail
│   │   │   └── parents/page.tsx      # Parent management (TODO)
│   │   ├── parent/                   # Parent dashboard (TODO)
│   │   │   ├── page.tsx              # Parent main
│   │   │   └── reports/[id]/page.tsx # Report view
│   │   ├── api/
│   │   │   └── analyze/route.ts      # Gemini API (Server-side)
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing page
│   │
│   ├── lib/                          # Services & utilities
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server Supabase client
│   │   └── gemini.ts                 # Gemini API wrapper
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

## Data Models

All type definitions are in `src/types/index.ts`. Key interfaces:

### User & Authentication
```typescript
type UserRole = 'teacher' | 'parent' | 'student';

interface User {
  id: string;              // UUID from Supabase Auth
  email: string;
  role: UserRole;
  name: string;
  created_at: string;
}
```

### Student Management
```typescript
interface Student {
  id: number;              // Auto-generated by PostgreSQL
  student_id: string;      // Format: 'M1250103' (Level+Year+Grade+Seq)
  name: string;
  grade: number;           // 1-12 (초1-6, 중1-3, 고1-3)
  school?: string;
  start_date?: string;
  parent_id?: string;      // References users.id
  learning_style?: 'visual' | 'verbal' | 'logical';
  personality_traits?: string[];
  created_at: string;
}
```

### Report Types
```typescript
type ReportType = 'test' | 'weekly' | 'monthly' | 'consolidated';

interface Report {
  id: number;
  student_id: number;      // References students.id
  report_type: ReportType;
  test_name?: string;
  test_date?: string;
  total_score?: number;
  max_score?: number;
  rank?: number;
  total_students?: number;
  analysis_data: AnalysisData;  // JSONB column
  created_at: string;
}
```

### Analysis Data (JSONB in analysis_data column)
```typescript
interface AnalysisData {
  testInfo: TestInfo;
  testResults: TestResults;
  resultAnalysis: ResultAnalysis;
  detailedAnalysis: DetailedProblemAnalysis[];
  macroAnalysis: MacroAnalysis;
  swotAnalysis?: SwotData;
  actionablePrescription: ActionablePrescriptionItem[];
  learningHabits?: LearningHabit[];
  riskFactors?: RiskFactor[];
  growthPredictions?: GrowthPrediction[];
  trendComment?: string;
}
```

### 5-Element Actionable Strategy
```typescript
interface ActionablePrescriptionItem {
  priority: number;           // 1=긴급, 2=중요, 3=장기
  type: '개념 교정' | '습관 교정' | '전략 개선';
  title: string;
  description: string;
  // 5-element concrete strategy (핵심)
  whatToDo: string;           // 무엇을 (교재, 자료)
  where: string;              // 어디서 (페이지, 챕터)
  howMuch: string;            // 얼마나 (횟수, 시간)
  howTo: string;              // 어떻게 (구체적 방법)
  measurementMethod: string;  // 측정 방법 (성과 확인)
  expectedEffect?: string;    // 예상 효과
}
```

### Future Vision (MacroAnalysis)
```typescript
interface MacroAnalysis {
  summary: string;
  oneLineSummary?: string;
  analysisKeyword?: string;
  analysisMessage?: string;
  strengths: string;
  weaknesses: string;
  errorPattern: string;
  futureVision?: {
    threeMonths: string;    // 3개월 후 예상
    sixMonths: string;      // 6개월 후 목표
    longTerm: string;       // 장기 성장 경로
    encouragement: string;  // 격려 메시지
  };
  weaknessFlow?: {
    step1: { title: string; description: string };
    step2: { title: string; description: string };
    step3: { title: string; description: string };
  };
  mathCapability?: {
    calculationSpeed: number;     // 0-100
    calculationAccuracy: number;
    applicationAbility: number;
    logic: number;
    anxietyControl: number;
  };
}
```

### Learning Habits & Risk Factors
```typescript
interface LearningHabit {
  type: 'good' | 'bad';
  description: string;
  frequency: 'always' | 'often' | 'sometimes';
}

interface RiskFactor {
  factor: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface GrowthPrediction {
  timeframe: '1개월' | '3개월' | '6개월' | '1년';
  predictedScore: number;
  confidenceLevel: number;  // 0-100
  assumptions: string[];
}
```

---

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

**2. Structured Output with JSON Schema**
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
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

### Linting
```bash
npm run lint
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

**Last Updated:** 2025-12-22
**Platform:** Next.js 16.0.7 + Supabase + Vercel
**For questions, refer to PRD and other documentation files.**
