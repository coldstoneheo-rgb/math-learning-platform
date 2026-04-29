# Math Learning Platform

> **AI 기반 개인 맞춤형 수학 학습 분석 플랫폼**
>
> AI-powered Personalized Math Learning Analytics Platform

---

## Overview | 개요

Math Learning Platform은 학생의 수학 시험 성적을 분석하고 AI(Google Gemini)를 활용하여 개인 맞춤형 학습 컨설팅을 제공하는 웹 플랫폼입니다.

Math Learning Platform is a web application that analyzes student math test performance and provides personalized learning consulting using AI (Google Gemini).

### Key Features | 주요 기능

- **Growth Loop System**: 6단계 리포트 순환 시스템 (Baseline → Micro Loop → Macro Loop)
- **5-Perspective AI Analysis**: 사고 출발점, 풀이 과정, 계산 패턴, 문제 해석, 풀이 습관 분석
- **Anchor Loop**: 리포트 저장 시 5대 핵심 지표 자동 업데이트
- **Parent Dashboard**: 학부모 전용 성장 진행률 및 리포트 열람
- **PDF Export**: 고해상도 한글 폰트 지원 PDF 내보내기

---

## Tech Stack | 기술 스택

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (Strict Mode) |
| **UI** | React 19, Tailwind CSS 4 |
| **Database** | Supabase PostgreSQL |
| **Auth** | Supabase Auth |
| **AI** | Google Gemini API (Pro/Flash hybrid routing) |
| **Charts** | Recharts |
| **Testing** | Playwright E2E |
| **Monitoring** | Sentry |
| **Hosting** | Vercel |

---

## Getting Started | 시작하기

### Prerequisites | 사전 요구사항

- Node.js 20+
- npm or pnpm
- Supabase account
- Google AI Studio API key

### Installation | 설치

```bash
# Clone repository
git clone https://github.com/your-repo/math-learning-platform.git
cd math-learning-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables | 환경 변수

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional - AI Model Routing
GEMINI_MODEL_PRO=gemini-2.5-pro
GEMINI_MODEL_FLASH=gemini-2.5-flash
```

### Development | 개발

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run E2E tests
npx playwright test
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure | 프로젝트 구조

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── admin/             # Teacher dashboard
│   │   ├── reports/       # Report generation (6 types)
│   │   ├── students/      # Student management
│   │   └── analytics/     # Analytics dashboard
│   ├── parent/            # Parent dashboard
│   └── api/               # API Routes
├── lib/                   # Services & utilities
│   ├── gemini.ts          # Gemini AI wrapper
│   ├── model-router.ts    # AI model routing
│   ├── rate-limiter.ts    # API rate limiting
│   ├── validations.ts     # Zod schemas
│   └── supabase/          # Supabase clients
├── types/                 # TypeScript definitions
│   └── index.ts           # Central type definitions
└── components/            # React components
```

---

## Architecture | 아키텍처

### Growth Loop System

```
┌─────────────────────────────────────────────────────────────┐
│                    GROWTH LOOP SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BASELINE: Level Test → StudentMetaProfile 초기화          │
│                │                                            │
│                ▼                                            │
│  MICRO LOOP: Weekly → Monthly → Test Analysis               │
│                │         │                                  │
│                └─────────┼──────► Anchor Loop (자동 업데이트)│
│                          ▼                                  │
│  MACRO LOOP: Semi-Annual → Annual (성장 스토리)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5 Meta Profile Indicators | 5대 핵심 지표

1. **Baseline**: 초기 기준점 (Level Test에서 설정)
2. **ErrorSignature**: 오류 패턴 지문
3. **AbsorptionRate**: 학습 흡수율
4. **SolvingStamina**: 풀이 지구력
5. **MetaCognitionLevel**: 메타인지 수준

---

## Documentation | 문서

| Document | Description |
|----------|-------------|
| [CLAUDE.md](./CLAUDE.md) | AI Assistant Guide (Primary) |
| [MathLearning_PRD_v3.0_Implementation.md](./MathLearning_PRD_v3.0_Implementation.md) | Product Requirements Document |
| [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md) | Development Roadmap |
| [COMMERCIALIZATION_PLAN.md](./COMMERCIALIZATION_PLAN.md) | Commercialization Plan |
| [docs/](./docs/) | Technical documentation |

---

## User Roles | 사용자 역할

| Role | Permissions |
|------|-------------|
| **Teacher** | Student management, report generation, parent account management |
| **Parent** | View child's reports, growth graphs, PDF download |
| **Student** | View own reports, learning plans |

---

## API Routes | API 라우트

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analyze` | POST | Test paper AI analysis |
| `/api/level-test/analyze` | POST | Level test baseline setup |
| `/api/weekly-report/generate` | POST | Weekly report generation |
| `/api/monthly-report/generate` | POST | Monthly report generation |
| `/api/semi-annual-report/generate` | POST | Semi-annual report |
| `/api/annual-report/generate` | POST | Annual report |
| `/api/meta-profile/update` | POST | Anchor Loop execution |

---

## Contributing | 기여

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License | 라이선스

This project is proprietary software. All rights reserved.

---

## Contact | 연락처

For questions or feedback, please open an issue on GitHub.

---

**Last Updated**: 2026-04-29
