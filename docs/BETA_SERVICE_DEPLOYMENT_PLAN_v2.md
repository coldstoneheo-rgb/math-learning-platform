# 베타 서비스 빠른 배포를 위한 현황 진단 및 개선 계획서

> **대상 프로젝트**: Math Learning Platform  
> **원격 저장소**: `coldstoneheo-rgb/math-learning-platform`  
> **대상 브랜치**: `codex/enhancement-docs`  
> **권장 저장 위치**: `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md`  
> **작업 방식**: 플랜 모드 / 코드 수정 없음 / 문서만 추가  
> **작성일**: 2026-05-05  
> **문서 버전**: v2.0

---

## 0. 현재 점검 결과

### 0.1 원격 브랜치 접근 결과

| 항목 | 결과 |
|---|---|
| 원격 브랜치 `codex/enhancement-docs` 존재 여부 | ✅ 확인됨 |
| 권장 문서 경로 `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md` | ❌ 현재 브랜치에서 찾을 수 없음 |
| 루트 경로 `BETA_SERVICE_DEPLOYMENT_PLAN.md` | ❌ 현재 브랜치에서 찾을 수 없음 |
| 권장 작업 | `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md`를 새 문서로 추가 |

> 이 문서는 원격 브랜치가 확인된 이후의 개선본이다. 기존 초안에 있던 “브랜치 미확인” 전제는 제거한다.


### 0.1.1 원격 브랜치 비교 결과

`codex/enhancement-docs`는 `main` 기준으로 **ahead 11 / behind 0** 상태로 확인되었다. 즉, 현재 브랜치는 `main`보다 11개 커밋 앞서 있으며 최신 `main` 변경을 뒤처지지는 않는다.

다만 이 브랜치에는 이미 문서 변경뿐 아니라 일부 코드/의존성 변경도 포함되어 있다. 이번 작업의 범위는 **새 베타 배포 계획서 문서 추가**로 제한한다. 실제 배포 전에는 이 브랜치에 포함된 기존 코드 변경까지 포함해 빌드/린트/Preview 검증을 수행해야 한다.

주요 변경 범위는 다음과 같다.

| 변경 범위 | 예시 | 베타 배포 영향 |
|---|---|---|
| 프로젝트 문서 | `CLAUDE.md`, `COMMERCIALIZATION_PLAN.md`, `IMPROVEMENT_ROADMAP.md`, `QA_AND_OPTIMIZATION.md`, `README.md` | 배포 기준과 실제 코드 상태 불일치 여부 확인 필요 |
| 리포트 문서 | `docs/REPORT_ENHANCEMENT_PLAN.md`, `docs/E2E_TEST_REPORT.md`, `docs/FEATURE_PLAN_MODEL_SELECTOR.md` | 베타 품질/QA 기준으로 활용 가능 |
| 의존성 | `package.json`, `package-lock.json` | 반드시 `npm ci`, `npm run build` 재검증 필요 |
| 코드 | `src/app/layout.tsx`, `src/lib/model-router.ts`, `src/components/report/premium/*` | UI/라우팅/빌드 영향 가능. Preview Smoke Test 필수 |

### 0.2 확인한 프로젝트 컨텍스트

이번 계획서는 다음 문서와 주요 코드 파일을 기준으로 현황을 재정리했다.

| 구분 | 확인 대상 | 베타 배포 관점 의미 |
|---|---|---|
| 제품/운영 문서 | `CLAUDE.md`, `MathLearning_PRD_v3.0_Implementation.md`, `COMMERCIALIZATION_PLAN.md`, `IMPROVEMENT_ROADMAP.md`, `QA_AND_OPTIMIZATION.md` | 제품 목표, Growth Loop, 상용화/QA 방향 확인 |
| 빌드/의존성 | `package.json` | Next.js, React, Supabase, Gemini, Upstash, Sentry, Resend, Playwright, PDF 도구 존재 확인 |
| AI 분석 API | `src/app/api/analyze/route.ts` | Rate Limit, 인증/권한, Zod 검증, Gemini 오류 처리, Anchor Loop 흐름 확인 |
| Rate Limit | `src/lib/rate-limiter.ts` | Upstash Redis 우선, in-memory fallback, AI/PDF/Auth 제한 정책 확인 |
| 입력 검증 | `src/lib/validations.ts` | Zod 스키마, 이미지 크기/개수 제한, 리포트별 요청 스키마 확인 |
| 모델 라우팅 | `src/lib/model-router.ts` | High-Stakes 리포트 Pro, 주간/월간 Flash, 시험 Adaptive 정책 확인 |
| Feature Flag | `src/lib/feature-flags.ts` | 베타 기능 ON/OFF 제어 기반 확인 |
| 이메일 | `src/lib/email.ts` | Resend 기반 리포트/학습 계획/주간 알림 발송 코드 확인 |
| 학부모 대시보드 | `src/app/parent/page.tsx` | 자녀 조회, 리포트 목록, 성장 차트, PDF 진입 흐름의 학부모 UX 확인 |

### 0.3 문서의 목적

이 문서는 “가능한 한 빨리 베타 서비스를 배포”하기 위한 실행 계획이다. 따라서 모든 개선을 한 번에 구현하려 하지 않고, 아래 기준으로 우선순위를 자른다.

1. **P0**: 베타 배포 전 반드시 검증해야 하는 안정성/보안/운영 항목
2. **P1**: 베타 품질을 높이지만, P0 통과 후 적용해도 되는 항목
3. **P2**: 정식 오픈 또는 베타 안정화 후로 미루는 항목

---

## 1. Executive Summary

### 1.1 최종 판단

현재 프로젝트는 **소규모 Private Beta를 시작할 수 있는 기능 기반은 갖춘 상태**다. 특히 다음 흐름이 이미 제품 구조상 핵심 경로로 존재한다.

```text
선생님 로그인
  → 학생 관리
  → 시험지/수업 데이터 기반 리포트 생성
  → AI 분석 및 메타프로필 업데이트
  → Supabase 저장
  → 학부모 로그인
  → 자녀 리포트 열람
  → PDF 저장 또는 웹 공유
```

다만 전체 학부모 25명에게 바로 오픈하기보다는, 아래 단계가 가장 빠르고 안전하다.

> **Preview 검증 → 학부모 3~5명 Private Beta → 1주 안정화 → 10명 확장 → 전체 학부모 오픈**

### 1.2 베타의 핵심 검증 질문

베타 성공 여부는 “기능이 몇 개 구현되었는가”가 아니라, 학부모가 아래 질문에 긍정적으로 답할 수 있는지로 판단한다.

| 질문 | 성공 기준 |
|---|---|
| 로그인해서 자녀 리포트를 바로 볼 수 있는가? | 첫 로그인 성공률 90% 이상 |
| 리포트를 보고 아이의 현재 상태와 성장 방향을 이해하는가? | 학부모 이해도 4/5 이상 |
| 선생님이 장기적으로 관리하고 있다는 느낌을 받는가? | 성장 체감도 4/5 이상 |
| PDF 또는 웹 링크로 리포트를 다시 확인할 수 있는가? | 리포트 재열람/저장 성공률 80% 이상 |
| 다른 학생 데이터가 절대 노출되지 않는가? | 교차 접근 0건 |

### 1.3 배포 가능성 요약

| 영역 | 현재 판단 | 베타 전략 |
|---|---:|---|
| 핵심 제품 가치 | ✅ 가능 | 시험 분석 + 성장 대시보드 + PDF 중심으로 시작 |
| AI 분석 | ✅ 조건부 가능 | 이미지 수/크기 제한, 실패 케이스 검증 후 오픈 |
| 학부모 열람 | ✅ 조건부 가능 | RLS/권한 교차 접근 테스트를 P0 Gate로 설정 |
| PDF 저장 | ⚠️ 검증 필요 | Chrome/Safari/iOS 중심으로 사전 확인 |
| 이메일 알림 | ⚠️ 선택 | 1차 베타는 수동 알림, 2차부터 자동화 권장 |
| 학생 기능/게임화 | ⛔ 제외 | 학부모 베타 안정화 후 검토 |
| 결제/멀티테넌시 | ⛔ 제외 | 정식 오픈 또는 B2B 확장 전 검토 |

---

## 2. 현재 작업 현황과 상세 컨텍스트

## 2.1 제품 정체성

Math Learning Platform은 단순 성적표 생성기가 아니라, 학생의 수학 학습 데이터를 장기적으로 연결해 학부모에게 **개인 맞춤형 학습 컨설팅**을 제공하는 플랫폼이다.

핵심 철학은 다음 한 문장으로 정리된다.

> **“우리 아이가 성장하고 있는가?”**

베타에서도 기능 범위를 늘리는 것보다, 학부모가 “아이의 현재 위치, 성장 변화, 다음 액션”을 확실히 이해하도록 만드는 것이 우선이다.

## 2.2 현재 구현 기반

### A. Growth Loop 기반 리포트 체계

| 리포트 | 베타 적용 우선순위 | 베타에서의 역할 |
|---|---:|---|
| 레벨 테스트 | P1 | 신규 학생 Baseline 설정, 첫 진단 설득력 강화 |
| 시험 분석 | P0 | 핵심 가치. AI 분석 품질과 학부모 신뢰 검증 |
| 주간 리포트 | P1 | 선생님이 꾸준히 관리한다는 체감 제공 |
| 월간 리포트 | P1 | 한 달 단위 성장 요약 제공 |
| 반기 리포트 | P2 | 장기 데이터가 있는 학생에게만 샘플 적용 |
| 연간 리포트 | P2 | 베타에서는 필수 아님 |
| 통합 리포트 | P2 | 특정 학생 샘플로만 제한 권장 |

### B. 학부모 대시보드

현재 학부모 대시보드는 다음 기능을 포함하는 구조다.

- 자녀 선택
- 자녀 기본 정보 카드
- 평균/최근/최고 점수 통계
- Growth Loop 상태
- 성적 추이 차트
- 수학 역량 레이더 차트
- 학습 습관 추이
- 리포트 목록 필터
- 자기 풀이 분석 배너

베타에서는 **자기 풀이 분석 배너가 실제로 완전히 검증되지 않았다면 비활성화하거나 “준비 중” 처리**하는 것이 안전하다.

### C. AI 분석 API

`/api/analyze`는 다음 보호 장치를 갖춘 구조다.

- `applyRateLimitAsync(request, 'AI_ANALYSIS')` 적용
- Supabase Auth 사용자 확인
- `users.role === 'teacher'`만 분석 실행 가능
- `analyzeRequestSchema` 기반 Zod 검증
- 학생 ID가 있으면 분석 컨텍스트 빌드
- Gemini 분석 수행
- 분석 성공 후 메타프로필 업데이트 시도
- Gemini API/파싱 오류 분기 처리

베타 전에는 코드 존재 여부가 아니라 **실제 Preview/Production 환경에서 해당 경로가 성공/실패 모두 정상 동작하는지**를 확인해야 한다.

### D. Rate Limit

현재 Rate Limit 정책은 다음과 같이 설계되어 있다.

| 제한 유형 | 정책 | 베타 의미 |
|---|---:|---|
| AI 분석 | 분당 5회 | 비용 폭주 방지에 중요 |
| 일반 API | 분당 60회 | 기본 보호 |
| 인증 | 분당 10회 | 로그인 남용 방지 |
| PDF Export | 분당 3회 | 브라우저/PDF 부하 방지 |

Upstash Redis 환경변수가 없으면 in-memory fallback이 동작한다. 서버리스 환경에서는 in-memory 제한의 일관성이 약하므로, **베타라도 Upstash Redis 설정을 P0로 둔다.**

### E. 입력 검증

Zod 스키마 기준으로 다음 제한이 존재한다.

- 이미지: 1장 이상, 최대 20장
- 이미지당 최대 약 5MB
- 파일 데이터: 최대 약 10MB
- 날짜, 학년, 점수, 문항 수 등 범위 검증
- 리포트 타입별 요청 스키마 존재

베타 운영 정책상으로는 실제 안정성을 위해 코드 허용치보다 더 보수적으로 시작한다.

> **1차 베타 권장 제한**: 시험 분석 1회당 이미지 1~10장, 이미지당 3~5MB 이하

### F. 모델 라우팅

현재 모델 라우팅은 다음 전략이다.

| 리포트 유형 | 모델 정책 | 베타 전략 |
|---|---|---|
| `level_test` | Pro | Baseline 품질을 위해 유지 |
| `semi_annual` | Pro | 베타에서는 제한 적용 |
| `annual` | Pro | 베타에서는 제한 적용 |
| `test` | Adaptive | 고학년/중요 시험은 Pro, 일반은 Flash |
| `weekly` | Flash | 비용 효율 유지 |
| `monthly` | Flash | 비용 효율 유지 |
| `consolidated` | Flash | 베타에서는 제한 적용 |

### G. 이메일 알림

Resend 기반 이메일 서비스는 코드로 존재하지만, 실제 운영에는 다음 외부 조건이 필요하다.

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- 발신 도메인 인증
- `NEXT_PUBLIC_APP_URL` 정확성
- 스팸함/수신 테스트

따라서 1차 Private Beta는 수동 안내가 가장 빠르며, 이메일은 2차 Beta에서 켜는 것이 안전하다.

---

## 3. 베타 배포 리스크 진단

## 3.1 P0 리스크

### P0-01. 원격 브랜치에는 접근되지만 문서 파일이 아직 없음

**현황**  
`codex/enhancement-docs` 브랜치는 확인되었지만, `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md`는 아직 없다.

**위험**  
베타 기준 문서가 없으면 배포 체크리스트, 책임 범위, Gate 결과가 흩어진다.

**개선 계획**

1. 이 문서를 `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md`로 추가한다.
2. 코드 변경 없이 문서 커밋만 수행한다.
3. 이후 모든 베타 이슈/결정은 이 문서의 Backlog와 Gate를 기준으로 추적한다.

**커밋 메시지 권장**

```bash
git commit -m "docs: add beta service deployment readiness plan"
```

---

### P0-02. 실제 브랜치 빌드 결과 미확인

**문제**  
문서와 코드 조각은 확인했지만, `codex/enhancement-docs`의 실제 로컬 작업 트리에서 빌드/린트가 통과하는지 아직 확인해야 한다.

**개선 계획**

```bash
git checkout codex/enhancement-docs
git pull --ff-only origin codex/enhancement-docs
npm ci
npm run lint
npm run build
npm audit --audit-level=high
```

**수용 기준**

- `npm run build` 성공
- `npm run lint` 치명 오류 없음
- High/Critical 취약점 없음 또는 대응 계획 문서화
- 문서만 변경된 상태로 커밋 생성

---

### P0-03. Production/Preview 환경변수 미검증

**문제**  
베타 배포 실패의 가장 흔한 원인은 환경변수 누락이다.

**필수 환경변수 체크리스트**

| 환경변수 | 필수도 | 베타 기준 |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | P0 | Preview/Production 모두 설정 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | P0 | Preview/Production 모두 설정 |
| `SUPABASE_SERVICE_ROLE_KEY` | P0 | 서버 전용, 노출 금지 |
| `GEMINI_API_KEY` | P0 | 예산 알림과 함께 설정 |
| `NEXT_PUBLIC_APP_URL` | P0 | 실제 베타 URL로 설정 |
| `UPSTASH_REDIS_REST_URL` | P0 | 분산 Rate Limit용 |
| `UPSTASH_REDIS_REST_TOKEN` | P0 | 분산 Rate Limit용 |
| `GEMINI_MODEL_PRO` | P1 | 명시 권장 |
| `GEMINI_MODEL_FLASH` | P1 | 명시 권장 |
| `RESEND_API_KEY` | P1 | 이메일 자동화 시 필요 |
| `RESEND_FROM_EMAIL` | P1 | 도메인 인증 후 사용 |
| `NEXT_PUBLIC_SENTRY_DSN` | P1 | Sentry 사용 시 필요 |

**개선 계획**

```bash
vercel env ls
```

Vercel UI에서 Preview/Production 각각 값을 확인한다. 특히 `NEXT_PUBLIC_APP_URL`이 Preview URL인지 Production URL인지 혼동되면 이메일 링크가 깨질 수 있다.

**수용 기준**

- P0 환경변수 누락 0개
- Gemini 예산 알림 설정
- Supabase Spend Cap 또는 비용 한도 확인
- Upstash Redis 연결 성공 확인

---

### P0-04. Supabase RLS/권한 교차 접근 검증 필요

**문제**  
학부모 데이터 오노출은 베타 중단 사유다. RLS가 문서상 존재하더라도 실제 DB에서 활성화되어 있는지 확인해야 한다.

**필수 시나리오**

| 시나리오 | 기대 결과 |
|---|---|
| 로그아웃 상태에서 `/parent` 접근 | `/login` 이동 |
| parent role이 `/admin` 접근 | 차단 또는 홈 이동 |
| parent A가 student A 리포트 접근 | 성공 |
| parent A가 student B 리포트 URL 직접 입력 | 차단 |
| student role이 teacher API 호출 | 403 |
| teacher role이 리포트 생성 | 성공 |

**개선 계획**

- 테스트 학부모 계정 2개 이상 생성
- 테스트 학생 2명 생성
- 서로 다른 parent_id 연결
- URL 직접 입력으로 교차 접근 테스트
- Supabase Dashboard에서 RLS enabled 여부 확인

**수용 기준**

- 교차 접근 0건
- 타 학생 리포트 접근 시 403, 에러 Toast, 또는 안전한 리다이렉트
- 테스트 결과를 이 문서의 Gate 기록 섹션에 남김

---

### P0-05. AI 분석 실패/파싱 실패/타임아웃 검증 필요

**문제**  
AI 분석은 핵심 가치이지만 외부 API, 이미지 품질, JSON 파싱, 서버리스 타임아웃에 영향을 받는다.

**개선 계획**

1. 샘플 데이터 5건으로 분석 테스트
   - 정상 시험지 1장
   - 정상 시험지 5장
   - 흐릿한 이미지
   - 큰 이미지
   - 점수/문항 수가 애매한 이미지
2. 실패 케이스 테스트
   - Gemini API Key 누락/오류 환경 시 메시지 확인
   - Rate Limit 초과 시 429 확인
   - 파싱 실패 시 깨진 리포트 저장 방지 확인
3. 1차 베타 운영 제한
   - 선생님만 분석 생성
   - 이미지 1~10장 권장
   - 큰 PDF/대용량 이미지는 베타 초반 제외

**수용 기준**

- 샘플 5건 중 4건 이상 정상 분석
- 실패 케이스에서 DB에 불완전 리포트 저장 없음
- AI 분석 평균 60초 이내 권장
- 120초 초과 시 재시도/이미지 축소 안내

---

### P0-06. PDF 저장 품질 검증 필요

**문제**  
학부모는 웹 열람 외에도 PDF 보관을 원한다. PDF가 깨지면 신뢰도가 낮아진다.

**테스트 범위**

| 환경 | 우선순위 |
|---|---:|
| Chrome Desktop | P0 |
| Safari Desktop 또는 iOS Safari | P0 |
| Android Chrome | P1 |
| 인쇄 대체 플로우 | P1 |

**리포트 유형**

- 시험 분석 리포트
- 주간 리포트
- 월간 리포트
- 레벨 테스트 리포트

**수용 기준**

- 한글 깨짐 없음
- 차트 잘림 없음
- 주요 카드가 페이지 중간에서 심하게 끊기지 않음
- PDF 생성 중 중복 클릭 방지
- 실패 시 브라우저 인쇄 대체 가능

---

### P0-07. 베타 데이터 백업/롤백 절차 필요

**문제**  
실제 학부모와 학생 데이터를 쓰는 순간부터 백업/롤백은 필수다.

**개선 계획**

1. 베타 배포 전 Supabase 백업 시각 기록
2. 배포 대상 커밋 SHA 기록
3. Vercel 이전 안정 배포 확인
4. 장애 시 안내 문구 준비
5. S1 장애 발생 시 즉시 베타 중단 기준 수립

**롤백 절차**

```text
Vercel Dashboard
  → Deployments
  → 이전 안정 배포 선택
  → Promote to Production
  → Supabase 데이터 이상 여부 확인
  → 학부모 안내
```

**수용 기준**

- 복구 기준 배포 SHA 기록
- DB 백업 시각 기록
- S1/S2 장애 대응 담당자 지정

---

### P0-08. 개인정보/베타 동의 안내 필요

**문제**  
시험지 이미지, 학생 이름, 학교, 학습 분석 결과는 민감한 교육 데이터다.

**개선 계획**

학부모 베타 안내에 다음을 포함한다.

- 저장되는 데이터 종류
- 담당 선생님과 연결 학부모만 열람 가능하다는 점
- AI 분석에 시험지 이미지가 사용된다는 점
- 베타 중 오류 가능성
- 데이터 삭제 요청 방법
- 정식 오픈 전 기능/정책 변경 가능성

**수용 기준**

- 베타 참여 동의 기록
- 삭제 요청 채널 명확화
- 개인정보 오노출 시 즉시 대응 문구 준비

---

## 3.2 P1 리스크와 개선 계획

### P1-01. Sentry 설정 확인

의존성에는 Sentry가 있지만, 실제 설정 파일과 DSN 적용 여부는 배포 전 확인해야 한다.

**개선 계획**

- `sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts` 존재 여부 확인
- `NEXT_PUBLIC_SENTRY_DSN` 설정
- AI 분석 실패, PDF 실패, 학부모 리포트 열람 실패를 태그로 수집

**권장 태그**

| 태그 | 값 예시 |
|---|---|
| `feature` | `ai_analysis`, `parent_report_view`, `pdf_export` |
| `report_type` | `test`, `weekly`, `monthly` |
| `role` | `teacher`, `parent` |
| `environment` | `preview`, `production-beta` |

---

### P1-02. 이메일 자동화는 2차 베타로 이동

이메일 코드는 존재하지만, 발신 도메인 인증과 수신 안정성 검증이 필요하다.

**전략**

| 단계 | 알림 방식 |
|---|---|
| 내부 Preview | 수동 URL 공유 |
| 1차 Private Beta | 카카오톡/문자/수동 안내 |
| 2차 Beta | Resend 자동 이메일 일부 적용 |
| 전체 학부모 오픈 | 자동 이메일 + 수동 보완 |

**수용 기준**

- 테스트 이메일 3개 이상 수신 성공
- 이메일 링크 클릭 시 `/parent/reports/:id` 정상 이동
- 이메일 실패가 리포트 저장을 막지 않음

---

### P1-03. Feature Flag 정리

베타에서는 기능이 많을수록 리스크가 커진다.

**1차 베타 ON 권장**

| Feature | 상태 |
|---|---:|
| 학부모 대시보드 | ON |
| 시험 분석 리포트 | ON |
| PDF 저장 | ON |
| AI 강화 리포트 | ON |
| 레벨 테스트 | 제한 ON |
| 주간/월간 리포트 | 제한 ON |

**1차 베타 OFF 권장**

| Feature | 이유 |
|---|---|
| 학생 전용 대시보드 | 학부모 베타 핵심과 거리 있음 |
| 성취 배지/게임화 | 안정화 후 검토 |
| 목표 설정/체크리스트 | 데이터 모델/UX 검증 후 적용 |
| 실시간 분석 | 운영 복잡도 높음 |
| DESIGN.md 테마 업로드 | 베타 안정화 후 적용 |
| 결제 | 베타 검증 전 불필요 |

---

### P1-04. 학부모 첫 화면 신뢰도 강화

**개선 방향**

- 리포트가 없을 때 “아직 리포트가 없습니다”만 보여주지 말고 다음 생성 예정 안내
- 점수 그래프가 없는 학생에게 “첫 시험 분석 후 성장 추이가 표시됩니다” 안내
- 자기 풀이 분석 기능이 검증되지 않았으면 배너 비활성화
- 최근 리포트의 핵심 요약 1문장을 카드에 표시
- 모바일에서 리포트 목록 필터가 잘 보이는지 확인

---

## 3.3 P2로 미루는 과제

| 과제 | 미루는 이유 | 착수 시점 |
|---|---|---|
| 결제 시스템 | 학부모 가치 검증 전 불필요 | 정식 오픈 전 |
| 멀티테넌시 | 현재는 단일 선생님 운영 가능 | B2B 확장 전 |
| DESIGN.md 테마 시스템 | 차별화에는 좋지만 안정화와 무관 | 베타 안정화 후 |
| Knowledge Tracing/ML 엔진 | 데이터 축적 전 ROI 낮음 | 학생별/문항별 데이터 축적 후 |
| 카카오톡 알림 | 외부 연동 리스크 | 이메일 안정화 후 |
| 학생 배지/게임화 | 학부모 베타 핵심과 거리 있음 | 학생 베타 전 |

---

## 4. 베타 배포 Gate

## Gate 0. 브랜치/문서 준비

```bash
git checkout codex/enhancement-docs
git pull --ff-only origin codex/enhancement-docs
git branch --show-current
git status
mkdir -p docs
# 이 문서를 docs/BETA_SERVICE_DEPLOYMENT_PLAN.md로 저장
git add docs/BETA_SERVICE_DEPLOYMENT_PLAN.md
git commit -m "docs: add beta service deployment readiness plan"
git push origin codex/enhancement-docs
```

**통과 조건**

- 현재 브랜치가 `codex/enhancement-docs`
- 코드 변경 없음
- 문서만 추가됨
- 원격 브랜치에 커밋 반영

## Gate 1. 빌드/정적 품질

```bash
npm ci
npm run lint
npm run build
npm audit --audit-level=high
```

**통과 조건**

- 빌드 성공
- ESLint 치명 오류 없음
- High/Critical 취약점 없음 또는 명시적 대응 계획 존재

## Gate 2. 환경변수/외부 서비스

```bash
vercel env ls
```

**통과 조건**

- P0 환경변수 누락 0개
- Upstash Redis 설정 완료
- Gemini 예산 알림 설정
- Supabase 비용 한도 확인
- Resend/Sentry는 사용 시 설정 완료

## Gate 3. DB/RLS/권한

**수동 테스트**

1. teacher 로그인 → `/admin` 접근 가능
2. parent 로그인 → `/parent` 접근 가능
3. parent가 `/admin` 접근 → 차단
4. parent A가 student A 리포트 접근 → 성공
5. parent A가 student B 리포트 URL 직접 입력 → 차단
6. 로그아웃 상태에서 리포트 URL 접근 → 로그인 이동

**통과 조건**

- 교차 접근 0건
- RLS 활성화 확인
- API Route 권한 검증 확인

## Gate 4. 핵심 기능 Smoke Test

| 시나리오 | 통과 기준 |
|---|---|
| 학생 생성 | admin에서 생성 후 목록 표시 |
| 학부모 연결 | parent 계정과 student 연결 성공 |
| 시험 분석 | 이미지 업로드 → AI 분석 → 저장 성공 |
| 리포트 열람 | parent에서 해당 리포트 표시 |
| PDF 저장 | PDF 생성 또는 인쇄 가능 |
| Rate Limit | 반복 요청 시 제한 동작 |
| AI 실패 | 깨진 데이터 저장 없이 오류 표시 |

## Gate 5. Preview 배포

```bash
vercel
# 또는 GitHub 연동 Preview Deployment 사용
```

**통과 조건**

- Preview URL에서 Gate 3~4 재검증
- 내부 테스트 학부모 2명 이상 사용
- Production DB와 Beta DB 구분 여부 명확화

## Gate 6. Production Beta 오픈

**통과 조건**

- 베타 참여 학부모 3~5명 확정
- 학부모 안내문 발송 준비
- 장애/문의 연락 채널 준비
- 첫 24시간 모니터링 담당자 지정
- 롤백 절차 준비

---

## 5. 실행 로드맵

## Day 0. 문서 커밋 및 대상 확정

| 순서 | 작업 | 산출물 |
|---:|---|---|
| 1 | `codex/enhancement-docs` 체크아웃 | 현재 SHA |
| 2 | 이 문서 추가 | `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md` |
| 3 | 문서 커밋/푸시 | 원격 커밋 SHA |
| 4 | 빌드/린트 실행 | 결과 로그 |
| 5 | 환경변수 점검 | 누락 목록 |

## Day 1. 내부 Preview 검증

| 순서 | 작업 | 산출물 |
|---:|---|---|
| 1 | Vercel Preview 배포 | Preview URL |
| 2 | 선생님 계정 검증 | Smoke Test 결과 |
| 3 | 학부모 A/B 교차 접근 검증 | RLS 결과 |
| 4 | AI 분석 샘플 5건 | 성공률/평균 시간 |
| 5 | PDF 저장 테스트 | 브라우저별 결과 |
| 6 | 오류 로그 확인 | P0/P1 이슈 목록 |

## Day 2. 1차 Private Beta 오픈

| 순서 | 작업 | 산출물 |
|---:|---|---|
| 1 | 학부모 3~5명 선정 | 베타 명단 |
| 2 | 계정/자녀 연결 | 연결 확인표 |
| 3 | 리포트 1~2개 준비 | 초기 데이터 세트 |
| 4 | 안내문 발송 | 안내 메시지 |
| 5 | 로그인/열람 성공 확인 | 학부모별 상태표 |
| 6 | 피드백 수집 | 개선 Backlog |

## Week 1. 안정화 및 2차 확장

| 순서 | 작업 | 산출물 |
|---:|---|---|
| 1 | 문의/오류 정리 | 이슈 리스트 |
| 2 | P0/P1 분류 | 우선순위 |
| 3 | 이메일 자동화 내부 테스트 | 수신 성공률 |
| 4 | 학부모 10명 확장 | 2차 명단 |
| 5 | 주간/월간 리포트 추가 | 정기 컨설팅 샘플 |

---

## 6. 베타 운영 정책

### 6.1 1차 베타에서 제공할 기능

| 기능 | 상태 | 비고 |
|---|---:|---|
| 로그인/학부모 대시보드 | ON | 핵심 |
| 학생 관리 | ON | 선생님 운영 필수 |
| 시험 분석 리포트 | ON | 핵심 |
| PDF 저장 | ON | 학부모 니즈 강함 |
| 레벨 테스트 | 제한 ON | 신규 학생 일부 적용 |
| 주간/월간 리포트 | 제한 ON | 정기 컨설팅 체감용 |
| 이메일 알림 | OFF 또는 내부 테스트 | 2차부터 ON 권장 |

### 6.2 1차 베타에서 제외할 기능

| 기능 | 상태 | 이유 |
|---|---:|---|
| 결제 | OFF | 베타 검증 전 불필요 |
| 멀티테넌시 | OFF | 단일 선생님 운영 기준 불필요 |
| 학생 배지/게임화 | OFF | 핵심 가치와 거리 있음 |
| 실시간 분석 | OFF | 복잡도/장애 리스크 |
| DESIGN.md 테마 업로드 | OFF | 안정화 후 적용 |
| 카카오톡 알림 | OFF | 외부 연동 리스크 |
| 자기 풀이 분석 | 조건부 OFF | 라우트/저장/권한 검증 전 숨김 권장 |

---

## 7. 장애 대응 계획

### 7.1 장애 등급

| 등급 | 예시 | 대응 |
|---|---|---|
| S1 | 다른 학생 리포트 노출, 인증/권한 문제 | 즉시 베타 중단, 접근 차단, 원인 분석, 재발 방지책 작성 |
| S2 | 학부모 전체 로그인 불가, AI 분석 전체 실패 | 당일 롤백 또는 핫픽스 |
| S3 | PDF 저장 실패, 일부 차트 깨짐 | 웹 열람 대체, 다음 패치 반영 |
| S4 | 문구/디자인 오류 | 운영 중 수정 가능 |

### 7.2 학부모 공지 문구

```text
베타 서비스 안정화 작업으로 잠시 점검 중입니다.
리포트 데이터는 보존되어 있으며, 확인이 완료되는 대로 다시 안내드리겠습니다.
불편을 드려 죄송합니다.
```

---

## 8. 모니터링 지표

### 8.1 기술 지표

| 지표 | 목표 | 확인 방법 |
|---|---:|---|
| 배포 성공률 | 100% | Vercel Deployments |
| 로그인 성공률 | 95%+ | 수동 기록/Sentry |
| AI 분석 성공률 | 90%+ | 서버 로그 |
| AI 분석 평균 시간 | 60초 이내 권장 | 서버 로그 |
| 리포트 열람 오류율 | 1% 이하 | Sentry/Vercel logs |
| PDF 저장 성공률 | 80%+ | 학부모 피드백 |
| RLS 오접근 | 0건 | 교차 접근 테스트 |

### 8.2 제품 지표

| 지표 | 목표 | 질문 |
|---|---:|---|
| 첫 로그인 성공률 | 90%+ | 안내만 보고 로그인 가능한가? |
| 리포트 이해도 | 4/5 이상 | 아이 상태가 이해되는가? |
| 성장 체감도 | 4/5 이상 | 아이가 성장 중인지 느껴지는가? |
| 선생님 업무 절감 | 30%+ | PDF 수동 전달/설명 시간이 줄었는가? |
| 재방문 의향 | 4/5 이상 | 다음 리포트도 웹으로 보고 싶은가? |

---

## 9. 학부모 베타 안내문 초안

```text
안녕하세요.
자녀의 수학 학습 리포트를 더 빠르고 체계적으로 확인하실 수 있도록 웹 기반 베타 서비스를 시작합니다.

이번 베타에서는 시험 분석 리포트, 성장 그래프, 학습 피드백, PDF 저장 기능을 먼저 제공합니다.
사용 중 불편한 점이나 이해가 어려운 부분을 알려주시면 정식 오픈 전 개선에 반영하겠습니다.

베타 기간에는 일부 화면이나 기능이 변경될 수 있으며, 리포트 데이터는 담당 선생님과 연결된 학부모만 확인할 수 있도록 제한됩니다.
로그인 후 자녀 리포트가 보이지 않거나 PDF 저장이 되지 않는 경우 담당 선생님에게 바로 알려주세요.
```

---

## 10. 학부모 피드백 질문지

### 10.1 첫 사용 경험

1. 로그인은 어렵지 않았나요?
2. 자녀 리포트를 찾는 과정은 쉬웠나요?
3. 모바일에서 보기 편했나요?
4. PDF 저장 또는 인쇄는 문제없이 되었나요?

### 10.2 리포트 품질

1. 이번 리포트를 보고 아이의 현재 상태가 이해되었나요?
2. 아이가 성장하고 있는지 느껴졌나요?
3. “무엇을 어떻게 공부해야 하는지”가 구체적으로 느껴졌나요?
4. 그래프와 차트가 도움이 되었나요?
5. 너무 길거나 어려운 부분이 있었나요?

### 10.3 신뢰와 만족도

1. 선생님이 장기적으로 아이를 관리하고 있다는 느낌이 들었나요?
2. 다음 리포트도 웹으로 받고 싶나요?
3. 추가로 보고 싶은 정보는 무엇인가요?

---

## 11. 선생님 운영 체크리스트

### 매일 확인

- [ ] 새 리포트 생성 실패 여부
- [ ] 학부모 로그인 문의 여부
- [ ] 리포트 오타/이상 데이터 여부
- [ ] AI 분석 품질이 낮은 리포트 수동 보정 필요 여부
- [ ] 학부모가 리포트를 실제로 열람했는지 여부

### 매주 확인

- [ ] 가장 많이 본 리포트 유형
- [ ] PDF 저장 실패 문의
- [ ] 학부모가 이해하기 어려워한 표현
- [ ] 다음 주 리포트 생성 계획
- [ ] 데이터 백업 상태
- [ ] P0/S1 이슈 발생 여부

---

## 12. 베타 배포 Backlog

### P0 Backlog

| ID | 작업 | 완료 기준 |
|---|---|---|
| BETA-P0-01 | `docs/BETA_SERVICE_DEPLOYMENT_PLAN.md` 추가 | 문서 커밋/푸시 완료 |
| BETA-P0-02 | `codex/enhancement-docs` 빌드 검증 | `npm run build` 성공 |
| BETA-P0-03 | Vercel 환경변수 검증 | P0 필수값 누락 0개 |
| BETA-P0-04 | Supabase RLS 교차 접근 테스트 | 타 학부모 리포트 접근 차단 |
| BETA-P0-05 | 학부모 계정/자녀 연결 테스트 | 2개 학부모 계정으로 성공 |
| BETA-P0-06 | AI 분석 Smoke Test | 샘플 5건 중 4건 이상 성공 |
| BETA-P0-07 | Gemini 실패/파싱 실패 처리 확인 | 깨진 리포트 저장 없음 |
| BETA-P0-08 | PDF 저장 검증 | Chrome/Safari 성공 |
| BETA-P0-09 | 백업/롤백 문서화 | 복구 절차 담당자 확인 |
| BETA-P0-10 | 개인정보/베타 동의 안내 | 학부모 안내문 발송 가능 |

### P1 Backlog

| ID | 작업 | 완료 기준 |
|---|---|---|
| BETA-P1-01 | Sentry 설정 확인 | Production 오류 수집 확인 |
| BETA-P1-02 | Resend 이메일 내부 테스트 | 테스트 메일 수신 성공 |
| BETA-P1-03 | 핵심 E2E 6개 작성/실행 | 모두 PASS |
| BETA-P1-04 | Feature Flag 정리 | 베타 OFF 기능 명확화 |
| BETA-P1-05 | 모바일 UI 점검 | iOS/Android 주요 화면 확인 |
| BETA-P1-06 | 학부모 피드백 폼 준비 | 응답 수집 링크 준비 |

### P2 Backlog

| ID | 작업 | 완료 기준 |
|---|---|---|
| BETA-P2-01 | 리포트 디자인 고도화 | 학부모 만족도 기반 개선 |
| BETA-P2-02 | DESIGN.md 테마 시스템 | 베타 안정화 후 별도 구현 |
| BETA-P2-03 | 카카오톡 알림 검토 | 이메일 안정화 후 결정 |
| BETA-P2-04 | 결제 정책 설계 | 정식 오픈 전 확정 |
| BETA-P2-05 | 멀티테넌시 설계 | 교사 확장 전 착수 |

---

## 13. 권장 커밋/푸시 명령어

로컬에서 아래 명령을 실행하면 된다.

```bash
git checkout codex/enhancement-docs
git pull --ff-only origin codex/enhancement-docs
mkdir -p docs
# 개선된 문서를 docs/BETA_SERVICE_DEPLOYMENT_PLAN.md로 저장

git add docs/BETA_SERVICE_DEPLOYMENT_PLAN.md
git status
git commit -m "docs: add beta service deployment readiness plan"
git push origin codex/enhancement-docs
```

문서만 변경되었는지 확인하려면:

```bash
git diff --stat HEAD~1..HEAD
```

예상 결과는 다음과 유사해야 한다.

```text
docs/BETA_SERVICE_DEPLOYMENT_PLAN.md | NNN +++++++++++++++++++++++++
1 file changed, NNN insertions(+)
```

---

## 14. 최종 권고

빠른 베타 배포를 위해 지금 해야 할 일은 명확하다.

1. `codex/enhancement-docs`에 이 문서를 추가해 베타 기준을 고정한다.
2. 코드 기능을 더 늘리지 말고, P0 Gate만 통과시킨다.
3. 학부모 3~5명 대상으로 Private Beta를 먼저 연다.
4. 이메일/학생 기능/게임화/테마/결제/멀티테넌시는 뒤로 미룬다.
5. 베타 성공 기준은 “기능 수”가 아니라 **학부모가 아이의 성장과 다음 액션을 이해했는가**로 잡는다.

> **최단 안전 경로**: `문서 커밋 → Preview 배포 → P0 Gate 통과 → 학부모 3~5명 Private Beta → 1주 안정화 → 10명 확장 → 전체 학부모 오픈`
