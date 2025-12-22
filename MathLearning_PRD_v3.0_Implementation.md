  
**수학 학습 분석 플랫폼**

Product Requirements Document v3.0

Vercel \+ Supabase 기반 웹 플랫폼 구축

문서 버전: 3.0

작성일: 2025년 12월

대상 사용자: 50명 (학생 25명 \+ 학부모 25명)

**목차**

**1\. Executive Summary**

2\. 프로젝트 개요 및 목표

3\. 시스템 아키텍처

4\. 데이터베이스 설계

5\. 보안 설계 (API 키 보호)

6\. 사용자 역할 및 권한

7\. 핵심 기능 명세

8\. AI 프롬프트 엔지니어링 가이드

9\. UI/UX 설계

10\. 개발 로드맵

11\. 비용 계획

12\. 부록

# **1\. Executive Summary**

본 문서는 수학 학습 분석 플랫폼의 웹 서비스 구축을 위한 상세 기술 명세서입니다. 기존 로컬 전용 시스템을 Vercel \+ Supabase 기반의 클라우드 서비스로 전환하여 학부모와 학생이 직접 웹에서 리포트를 열람할 수 있도록 합니다.

## **1.1 핵심 변경사항**

| 항목 | 기존 (로컬) | 신규 (웹) |
| ----- | ----- | ----- |
| **데이터 저장** | 브라우저 IndexedDB | 클라우드 PostgreSQL |
| **접근성** | 선생님 PC 1대 | 모든 기기 (PC, 모바일) |
| **학부모 접근** | PDF 수동 전달 | 웹에서 직접 열람 |
| **데이터 백업** | 수동 | 자동 (클라우드) |
| **예상 비용** | $0/월 | $0\~5/월 |

## **1.2 기술 스택 요약**

* 프론트엔드: Next.js 14+ (App Router)

* 호스팅: Vercel (무료 티어)

* 데이터베이스: Supabase PostgreSQL (무료 티어)

* 인증: Supabase Auth

* AI: Google Gemini API (gemini-2.5-flash)

* 도메인: \[프로젝트명\].vercel.app (무료)

# **2\. 프로젝트 개요 및 목표**

## **2.1 비전**

"데이터 기반 개인 맞춤형 수학 학습 컨설팅 플랫폼"

단순 점수 분석을 넘어, 학생의 사고 패턴, 학습 습관, 성장 가능성을 깊이 있게 파악하여 구체적인 개선 방안과 미래 성장 비전을 제시합니다.

## **2.2 대상 사용자**

| 역할 | 인원 | 주요 기능 |
| ----- | ----- | ----- |
| **선생님** | 1명 | 학생 관리, 시험지 업로드, 리포트 생성, 학부모 계정 관리 |
| **학부모** | \~25명 | 자녀 리포트 열람, 성장 그래프 확인, PDF 다운로드 |
| **학생** | \~25명 | 본인 리포트 열람, 학습 계획 확인 |

## **2.3 핵심 목표**

1. 학부모가 웹에서 자녀의 학습 리포트를 직접 열람

2. 선생님의 리포트 공유 업무 자동화 (PDF 수동 전달 → 자동 알림)

3. 5가지 관점의 심층 AI 분석으로 전문적 학습 컨설팅 제공

4. 3개월/6개월 성장 예측으로 장기적 학습 비전 제시

5. 월 $5 이하의 운영 비용으로 지속 가능한 서비스 구축

# **3\. 시스템 아키텍처**

## **3.1 전체 구조도**

아래는 Vercel \+ Supabase 기반의 시스템 아키텍처입니다:

┌─────────────────────────────────────────────────────────────┐

│                     서비스 구조도                             │

├─────────────────────────────────────────────────────────────┤

│                                                             │

│   👨‍🏫 선생님                    👩‍👧 학부모/학생 (50명)            │

│   ┌───────────────┐           ┌───────────────┐            │

│   │ 관리자 대시보드 │           │ 열람 대시보드  │            │

│   └───────┬───────┘           └───────┬───────┘            │

│           └───────────┬───────────────┘                    │

│                       ▼                                    │

│             \[프로젝트명\].vercel.app                          │

│              (Vercel \- 무료)                                │

│                       │                                    │

│                       ▼                                    │

│         ┌─────────────────────────┐                        │

│         │   Supabase (무료 티어)   │                        │

│         │  PostgreSQL \+ Auth      │                        │

│         └───────────┬─────────────┘                        │

│                     ▼                                      │

│         ┌─────────────────────────┐                        │

│         │   Gemini API (AI 분석)  │                        │

│         └─────────────────────────┘                        │

│                                                             │

└─────────────────────────────────────────────────────────────┘

## **3.2 데이터 흐름**

1. 선생님이 시험지 이미지 업로드

2. 서버사이드 API Route에서 Gemini API 호출 (키 숨김)

3. AI 분석 결과를 Supabase PostgreSQL에 저장

4. 학부모/학생이 웹에서 로그인하여 리포트 열람

5. 필요시 PDF 다운로드

## **3.3 기술 스택 상세**

| 구분 | 기술 | 비고 |
| ----- | ----- | ----- |
| **Framework** | Next.js 14+ (App Router) | React Server Components 지원 |
| **Language** | TypeScript 5.2+ | Strict Mode 필수 |
| **Hosting** | Vercel | 무료 티어: 100GB 대역폭/월 |
| **Database** | Supabase PostgreSQL | 무료 티어: 500MB DB |
| **Auth** | Supabase Auth | 이메일/비밀번호 인증 |
| **AI** | Google Gemini API | gemini-2.5-flash 모델 |
| **Charts** | Recharts 2.12+ | 레이더, 선, 막대 차트 |
| **Styling** | Tailwind CSS 3.4+ | 유틸리티 기반 스타일링 |

# **4\. 데이터베이스 설계**

## **4.1 테이블 구조**

Supabase PostgreSQL에 생성할 테이블 스키마입니다:

**users 테이블 (사용자)**

CREATE TABLE users (

  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  email TEXT UNIQUE NOT NULL,

  role TEXT NOT NULL CHECK (role IN ('teacher', 'parent', 'student')),

  name TEXT NOT NULL,

  created\_at TIMESTAMPTZ DEFAULT NOW()

);

**students 테이블 (학생)**

CREATE TABLE students (

  id SERIAL PRIMARY KEY,

  student\_id TEXT UNIQUE NOT NULL,  \-- 'M1250103' 형식

  name TEXT NOT NULL,

  grade INTEGER NOT NULL,

  school TEXT,

  start\_date DATE,

  parent\_id UUID REFERENCES users(id),  \-- 학부모 연결

  created\_at TIMESTAMPTZ DEFAULT NOW()

);

**reports 테이블 (시험 분석 리포트)**

CREATE TABLE reports (

  id SERIAL PRIMARY KEY,

  student\_id INTEGER REFERENCES students(id) ON DELETE CASCADE,

  report\_type TEXT NOT NULL,  \-- 'test' | 'weekly' | 'monthly' | 'consolidated'

  test\_name TEXT,

  test\_date DATE,

  total\_score INTEGER,

  max\_score INTEGER,

  rank INTEGER,

  total\_students INTEGER,

  analysis\_data JSONB NOT NULL,  \-- AI 분석 결과 전체

  created\_at TIMESTAMPTZ DEFAULT NOW()

);

## **4.2 analysis\_data JSONB 구조**

AI 분석 결과는 JSONB 형식으로 저장되며, 다음 필드를 포함합니다:

* testInfo: 시험 기본 정보 (이름, 날짜, 범위)

* testResults: 문항별 정오답 및 배점

* questionAnalysis: 5가지 관점 심층 분석 (사고 출발점, 풀이 과정, 계산 패턴, 문제 해석, 풀이 습관)

* strengthsWeaknesses: 강점/약점 분석

* swotAnalysis: SWOT 분석

* improvementStrategy: 5요소 개선 전략 (무엇을, 어디서, 얼마나, 어떻게, 측정 방법)

* riskFactors: 위험 습관 탐지

* growthPrediction: 3개월/6개월 성장 예측

* conclusion: 현재 상태, 핵심 강점, 우선 과제, 미래 비전

## **4.3 Row Level Security (RLS)**

Supabase RLS를 사용하여 데이터 접근 권한을 제어합니다:

\-- 선생님은 모든 학생 데이터 접근 가능

CREATE POLICY "teacher\_full\_access" ON students

  FOR ALL USING (auth.jwt() \-\>\> 'role' \= 'teacher');

\-- 학부모는 자녀 데이터만 접근 가능

CREATE POLICY "parent\_own\_child" ON students

  FOR SELECT USING (parent\_id \= auth.uid());

\-- 리포트도 동일한 정책 적용

CREATE POLICY "parent\_own\_reports" ON reports

  FOR SELECT USING (

    EXISTS (

      SELECT 1 FROM students

      WHERE students.id \= reports.student\_id

      AND students.parent\_id \= auth.uid()

    )

  );

# **5\. 보안 설계 (API 키 보호)**

**API 키 노출은 막대한 비용 청구로 이어질 수 있습니다. 아래 가이드를 반드시 준수하세요.**

## **5.1 환경 변수 관리**

**❌ 절대 하면 안 되는 것:**

// 코드에 직접 키 입력 \- 절대 금지\!

const apiKey \= 'AIzaSyD1234567890abcdefg';

**✅ 올바른 방법:**

// .env.local 파일 (로컬 개발용)

GEMINI\_API\_KEY=AIzaSyD1234567890abcdefg

NEXT\_PUBLIC\_SUPABASE\_URL=https://xxx.supabase.co

NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=eyJhbGciOiJIUzI1NiIs...

SUPABASE\_SERVICE\_ROLE\_KEY=eyJhbGciOiJIUzI1NiIs...

// 코드에서 환경 변수로 접근

const apiKey \= process.env.GEMINI\_API\_KEY;

## **5.2 .gitignore 필수 설정**

\# .gitignore 파일에 반드시 추가

\# 환경 변수 파일

.env

.env.local

.env.development

.env.production

\# 인증 파일

\*.pem

\*.key

credentials.json

service-account.json

## **5.3 서버사이드 API Route 패턴**

모든 API 키는 서버에서만 사용되어야 합니다. 브라우저에서 절대 키가 노출되지 않습니다.

// ✅ 안전한 구조: /app/api/analyze/route.ts

export async function POST(request: Request) {

  // 이 코드는 서버에서만 실행됨

  // 브라우저에서 절대 볼 수 없음\!

  const apiKey \= process.env.GEMINI\_API\_KEY;


  const body \= await request.json();


  const response \= await fetch(

    'https://generativelanguage.googleapis.com/v1/...',

    {

      headers: { 'x-goog-api-key': apiKey },

      body: JSON.stringify(body)

    }

  );


  return Response.json(await response.json());

}

## **5.4 Vercel 환경 변수 설정**

Vercel 대시보드에서 환경 변수를 설정합니다:

* Settings → Environment Variables 이동

* GEMINI\_API\_KEY 추가 (Production 환경)

* 'Sensitive' 체크박스 활성화 (값 마스킹)

* SUPABASE\_URL, SUPABASE\_ANON\_KEY 추가 (All 환경)

* SUPABASE\_SERVICE\_ROLE\_KEY 추가 (Production 환경, Sensitive)

## **5.5 예산 알림 설정 (최후의 방어선)**

**Google Cloud Console에서 예산 알림을 설정하세요:**

* 결제 → 예산 및 알림 → 예산 만들기

* 월 예산: $10 설정

* 50% 도달 시 이메일 알림

* 100% 도달 시 API 자동 중지 (핵심\!)

**Supabase Spend Cap 설정:**

* Settings → Billing → Spend Cap 활성화

* 무료 티어 초과 시 자동 중지

## **5.6 보안 체크리스트**

| \# | 항목 | 필수 |
| :---: | ----- | ----- |
| 1 | .env.local에 키 저장 | **✅ 필수** |
| 2 | .gitignore에 .env\* 추가 | **✅ 필수** |
| 3 | 서버사이드 API Route에서만 키 사용 | **✅ 필수** |
| 4 | Vercel 환경 변수에 키 등록 | **✅ 필수** |
| 5 | Google Cloud 예산 알림 설정 | **✅ 필수** |
| 6 | Supabase Spend Cap 활성화 | **✅ 필수** |
| 7 | 정기적으로 키 교체 (3개월마다) | 권장 |
| 8 | git-secrets 도구로 히스토리 검사 | 권장 |

# **6\. 사용자 역할 및 권한**

## **6.1 역할별 권한 매트릭스**

| 기능 | 선생님 | 학부모 | 학생 |
| ----- | :---: | :---: | :---: |
| 학생 등록/수정/삭제 | ✅ | ❌ | ❌ |
| 시험지 업로드 및 리포트 생성 | ✅ | ❌ | ❌ |
| 전체 학생 목록 조회 | ✅ | ❌ | ❌ |
| 학부모 계정 생성 및 연결 | ✅ | ❌ | ❌ |
| 본인 자녀 리포트 열람 | ✅ | ✅ | ✅ |
| 성장 그래프 열람 | ✅ | ✅ | ✅ |
| PDF 다운로드 | ✅ | ✅ | ✅ |

## **6.2 인증 흐름**

**선생님 (관리자):**

* 초기 계정: Supabase 대시보드에서 직접 생성

* role \= 'teacher'로 설정

* 관리자 대시보드 (/admin/\*) 접근 권한

**학부모:**

* 선생님이 학부모 이메일로 초대 링크 발송

* 학부모가 링크를 통해 회원가입

* 선생님이 해당 계정을 자녀와 연결

* 학부모 대시보드 (/parent/\*) 접근 권한

# **7\. 핵심 기능 명세**

## **7.1 선생님 대시보드**

**메인 페이지 (/admin):**

* 전체 학생 수, 이번 주 생성된 리포트 수, 학부모 열람 횟수 표시

* 최근 활동 목록 (리포트 생성, 학부모 가입 등)

* 빠른 액션 버튼: 학생 등록, 리포트 생성, 학부모 계정 관리

**학생 관리 (/admin/students):**

* 학생 목록 테이블 (이름, 학년, 학교, 최근 리포트, 학부모 연결 상태)

* 학생 추가/수정/삭제 기능

* 학생별 상세 페이지로 이동

**리포트 생성 (/admin/reports/new):**

* 학생 선택 드롭다운

* 리포트 타입 선택 (시험 분석 / 주간 / 월간 / 통합)

* 시험지 이미지 업로드 (드래그 앤 드롭)

* 시험 정보 입력 (시험명, 날짜, 범위, 총점)

* AI 분석 실행 버튼

* 분석 결과 미리보기 및 저장

**학부모 계정 관리 (/admin/parents):**

* 학부모 목록 (이메일, 연결된 자녀, 가입 상태)

* 초대 링크 발송 기능

* 학부모-자녀 연결/해제

## **7.2 학부모 대시보드**

**메인 페이지 (/parent):**

* 자녀 이름 및 기본 정보 표시

* 성장 현황 그래프 (최근 5회 시험 점수 추이)

* 3개월/6개월 후 예상 점수

* 최근 리포트 목록 (제목, 날짜, 간략 요약)

* 이번 주 학습 계획 체크리스트

**리포트 상세 (/parent/reports/:id):**

* 시험 기본 정보 (점수, 등수, 범위)

* 5가지 관점 심층 분석 결과

* SWOT 분석 시각화

* 개선 전략 (우선순위별 정렬)

* 성장 예측 및 미래 비전

* PDF 다운로드 버튼

## **7.3 리포트 타입별 기능**

| 타입 | 포함 내용 | 생성 주기 |
| ----- | ----- | ----- |
| **시험 분석** | 5가지 관점 분석, 문항별 정오답, SWOT, 개선 전략 | 시험 후 즉시 |
| **주간** | 주간 학습 내용, 달성도, 다음 주 계획 | 매주 금요일 |
| **월간** | 월간 성장 추이, 습관 패턴, 종합 평가 | 매월 마지막 주 |
| **통합** | 장기 성장 곡선, 미래 예측, 종합 컨설팅 | 학기말 / 요청시 |

# **8\. AI 프롬프트 엔지니어링 가이드**

**이 섹션은 프로젝트의 핵심입니다. AI 분석 품질이 서비스 가치를 결정합니다.**

## **8.1 역할 정의 (System Prompt)**

당신은 학생의 수학 학습을 종합적으로 컨설팅하는 전문 AI 교육 컨설턴트입니다.

단순히 점수를 분석하는 것이 아니라, 학생의 사고 패턴, 학습 습관, 성장 가능성을

깊이 있게 파악하여, 개인화된 구체적인 학습 개선 방안과 미래 성장 비전을 제시해야 합니다.

## **8.2 핵심 목표 5가지**

1. 학생의 현재 학습 현황을 매우 정확히 파악

2. 오답의 근본 원인과 사고 패턴 분석

3. 잠재적 위험 습관 조기 탐지

4. 실행 가능한 구체적 개선 방법 제시 (5요소 필수)

5. 장기적 성장 비전 제공 (3개월, 6개월 예측)

## **8.3 문항별 심층 분석: 5가지 관점**

**1️⃣ 사고의 출발점 분석**

* 문제를 보고 가장 먼저 무엇을 시도했는가?

* 올바른 접근 방법을 선택했는가?

* 잘못된 접근이라면, 왜 그렇게 생각했을 가능성이 높은가?

**2️⃣ 풀이 진행 과정 분석**

* 풀이의 어느 단계에서 막혔거나 틀렸는가?

* 중간 과정의 논리적 흐름은 타당한가?

* 어떤 개념이나 공식을 오적용했는가?

**3️⃣ 계산 및 실수 패턴**

* 단순 계산 실수인가, 개념적 오류인가?

* 반복되는 실수 유형이 있는가? (예: 부호 실수, 분배법칙 오류)

* 검산 흔적이 있는가?

**4️⃣ 문제 해석 능력**

* 문제의 조건을 정확히 파악했는가?

* 놓친 조건이나 잘못 해석한 부분이 있는가?

* 그래프, 도형 등 시각 자료를 제대로 활용했는가?

**5️⃣ 풀이 습관 관찰**

* 풀이 과정을 단계적으로 기록했는가, 아니면 생략했는가?

* 필기의 정리 상태는 어떠한가?

* 여백 활용, 밑줄, 표시 등의 습관이 보이는가?

## **8.4 위험 습관 탐지 체크리스트**

AI가 다음 항목을 자동으로 탐지하여 경고합니다:

* 풀이 과정 생략 (암산으로만 풀이)

* 검산 안 함

* 문제 조건 꼼꼼히 안 읽음

* 그림/그래프 안 그림

* 시간 배분 불균형

* 어려운 문제에서 포기 패턴

## **8.5 개선 전략 5요소 (필수)**

**모든 개선 전략은 반드시 다음 5가지 요소를 포함해야 합니다:**

| 요소 | 설명 | 예시 |
| ----- | ----- | ----- |
| **무엇을** | 구체적 교재, 자료 | 개념원리 교재 |
| **어디서** | 페이지, 챕터 | 83-87페이지 |
| **얼마나** | 횟수, 시간 | 매일 30분, 주 5회 |
| **어떻게** | 구체적 방법 | 틀린 문제 3회 반복 풀이 |
| **측정 방법** | 성과 확인 기준 | 정답률 90% 달성 시 다음 단계 |

## **8.6 결론(conclusion) 필수 포함 항목**

1. 현재 상태 진단: 객관적 평가 (강점/약점 요약)

2. 핵심 강점 재강조: 긍정적 피드백으로 동기 부여

3. 최우선 개선 과제: 명확한 방향 제시 (1-2가지)

4. 미래 비전 (핵심\!):

* 3개월 후 예상 시나리오

* 6개월 후 목표

* 장기 성장 경로

* 격려 메시지

# **9\. UI/UX 설계**

## **9.1 디자인 시스템**

기존 리포트 디자인(첨부 이미지)을 기반으로 일관된 디자인 시스템을 적용합니다.

**컬러 팔레트:**

| 용도 | 색상 코드 | 적용 영역 |
| ----- | ----- | ----- |
| **Primary** | \#1976D2 | 헤더, 버튼, 강조 텍스트, 차트 메인 색상 |
| **Success** | \#4CAF50 | 정답, 강점, 긍정적 지표 |
| **Warning** | \#FF9800 | 주의, 중간 우선순위 |
| **Danger** | \#F44336 | 오답, 위험 습관, 긴급 개선 |
| **Background** | \#F5F7FA | 페이지 배경 |

**타이포그래피:**

* 폰트: Pretendard (한글) \+ Inter (영문)

* 제목: 24-32px, Bold

* 본문: 14-16px, Regular

* 캡션: 12px, Light

## **9.2 핵심 디자인 원칙**

* 카드 기반 섹션 분리: 각 분석 영역을 카드로 구분

* 시각적 차트 활용: 레이더 차트, 선 그래프, 막대 그래프

* 단일 컬럼 레이아웃: 모바일 친화적 스크롤

* 넓은 여백: 가독성 확보 (padding: 24px)

* 그라데이션 헤더: Primary 색상 기반

## **9.3 반응형 브레이크포인트**

| 기기 | 너비 | 레이아웃 |
| ----- | ----- | ----- |
| **Mobile** | \< 640px | 단일 컬럼, 축소된 차트 |
| **Tablet** | 640px \~ 1024px | 2컬럼 그리드 (카드) |
| **Desktop** | \> 1024px | 사이드바 \+ 메인 콘텐츠 |

# **10\. 개발 로드맵**

## **10.1 4주 구축 계획**

**Week 1: 기반 구축**

* Supabase 프로젝트 생성 및 데이터베이스 테이블 생성

* Supabase Auth 설정 (이메일/비밀번호 인증)

* Row Level Security (RLS) 정책 설정

* Next.js 프로젝트 생성 (App Router)

* Vercel 연동 및 환경 변수 설정

* 도메인 확인 (\[프로젝트명\].vercel.app)

**Week 2: 선생님 기능**

* 선생님 로그인 페이지 (/login)

* 관리자 대시보드 메인 페이지 (/admin)

* 학생 관리 CRUD (/admin/students)

* 시험지 업로드 \+ Supabase Storage 연동

* Gemini API 연동 (서버사이드 API Route)

* 리포트 생성 및 저장 (/admin/reports/new)

* 학부모 계정 생성 및 초대 기능 (/admin/parents)

**Week 3: 학부모 기능**

* 학부모 회원가입 페이지 (/signup)

* 학부모 대시보드 메인 페이지 (/parent)

* 자녀 리포트 목록 및 상세 열람 (/parent/reports)

* 성장 그래프 시각화 (Recharts)

* PDF 다운로드 기능 (html2canvas \+ jspdf)

* 모바일 반응형 UI 완성

**Week 4: 테스트 및 배포**

* 기존 학생 데이터 마이그레이션 (CSV → Supabase)

* 학부모 10명 초대 및 베타 테스트

* 피드백 수집 및 버그 수정

* 성능 최적화 (이미지 압축, 캐싱)

* Google Cloud 예산 알림 최종 확인

* 정식 서비스 오픈

## **10.2 주요 마일스톤**

| 주차 | 마일스톤 | 산출물 | 검증 방법 |
| :---: | ----- | ----- | ----- |
| W1 | 인프라 완료 | Supabase DB \+ Vercel 배포 | URL 접속 확인 |
| W2 | 선생님 기능 | 학생 등록, 리포트 생성 | 리포트 DB 저장 확인 |
| W3 | 학부모 기능 | 회원가입, 리포트 열람 | 학부모 계정 테스트 |
| W4 | 정식 오픈 | 안정적 서비스 | 학부모 10명 사용 |

# **11\. 비용 계획**

## **11.1 월간 예상 비용 (50명 기준)**

| 서비스 | 무료 티어 한도 | 예상 사용량 | 월 비용 |
| ----- | ----- | ----- | ----- |
| **Vercel** | 100GB 대역폭, 무제한 배포 | \~5GB | **$0** |
| **Supabase** | 500MB DB, 1GB 스토리지 | \~100MB | **$0** |
| **도메인** | \[프로젝트\].vercel.app (무료) | \- | **$0** |
| **Gemini API** | 월 무료 할당량 | \~100건/월 | $0\~5 |
| **총계** | \- | \- | **$0\~5/월** |

## **11.2 연간 비용 비교**

| 항목 | 무료 도메인 | 커스텀 도메인 |
| ----- | ----- | ----- |
| 도메인 | $0 (vercel.app) | $12 (.com) |
| 호스팅 \+ DB | $0 | $0 |
| AI API | $0\~60 | $0\~60 |
| **연간 총계** | **$0\~60** | **$12\~72** |

## **11.3 확장 시 비용 (참고)**

사용자가 100명 이상으로 증가할 경우:

* Supabase Pro: $25/월 (8GB DB, 100GB 스토리지)

* Vercel Pro: $20/월 (더 많은 대역폭, 분석 기능)

* 예상 월 비용: $50\~70/월

# **12\. 부록**

## **12.1 프로젝트 디렉토리 구조**

math-learning-platform/

├── app/

│   ├── (auth)/

│   │   ├── login/page.tsx

│   │   └── signup/page.tsx

│   ├── admin/

│   │   ├── page.tsx              \# 관리자 대시보드

│   │   ├── students/page.tsx     \# 학생 관리

│   │   ├── reports/

│   │   │   ├── page.tsx          \# 리포트 목록

│   │   │   └── new/page.tsx      \# 리포트 생성

│   │   └── parents/page.tsx      \# 학부모 관리

│   ├── parent/

│   │   ├── page.tsx              \# 학부모 대시보드

│   │   └── reports/

│   │       └── \[id\]/page.tsx     \# 리포트 상세

│   ├── api/

│   │   ├── analyze/route.ts      \# Gemini API (서버사이드)

│   │   └── reports/route.ts      \# 리포트 CRUD

│   ├── layout.tsx

│   └── page.tsx                  \# 랜딩 페이지

├── components/

│   ├── ui/                       \# 공통 UI 컴포넌트

│   ├── charts/                   \# 차트 컴포넌트

│   └── reports/                  \# 리포트 관련 컴포넌트

├── lib/

│   ├── supabase/

│   │   ├── client.ts             \# 클라이언트 Supabase

│   │   └── server.ts             \# 서버 Supabase

│   ├── gemini.ts                 \# Gemini API 래퍼

│   └── utils.ts                  \# 유틸리티 함수

├── types/

│   └── index.ts                  \# TypeScript 타입 정의

├── .env.local                    \# 환경 변수 (gitignore)

├── .gitignore

├── package.json

├── tailwind.config.js

└── tsconfig.json

## **12.2 환경 변수 목록**

| 변수명 | 용도 | 민감도 |
| ----- | ----- | ----- |
| NEXT\_PUBLIC\_SUPABASE\_URL | Supabase URL | Public (노출 가능) |
| NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY | Supabase 익명 키 | Public (노출 가능) |
| SUPABASE\_SERVICE\_ROLE\_KEY | Supabase 관리자 키 | **Sensitive (절대 노출 금지)** |
| GEMINI\_API\_KEY | Gemini API 키 | **Sensitive (절대 노출 금지)** |

## **12.3 성공 지표 (KPI)**

| 지표 | 현재 (로컬) | 목표 (4주 후) | 장기 목표 |
| ----- | ----- | ----- | ----- |
| 학부모 리포트 열람율 | 0% | 70% | 90% |
| 리포트 공유 시간 | \~30분 (수동) | \~1분 (자동) | 실시간 |
| 분석 정확도 | 60% | 85% | 95% |
| 학부모 만족도 | TBD | 8/10 | 9/10 |
| 월 운영 비용 | $0 | \< $5 | \< $10 |

*— 문서 끝 —*