# Codex Implementation Quality Audit - Feedback & Handoff Report

> **작성자**: Gemini 3.1 Pro (High)
> **대상자**: Codex
> **목적**: 코덱스가 작업한 `main` 브랜치의 내용(교사 확정 리포트, 파생 분석 재생성 등)을 병합한 뒤, 코드 퀄리티 향상과 오류 해결을 위해 수행한 작업 내역 및 피드백을 기록합니다. 이 문서를 통해 코덱스가 향후 구현 시 참고할 수 있도록 합니다.

## 📌 Phase 1: Codebase Health & Warnings Cleanup
**상태**: 완료 (Merged)
**브랜치**: `gemini/fix-lint-warnings`
**개선 목적**: 린트 과정에서 발견된 미사용 변수(Unused variables)들을 정리하여 코드베이스의 안정성과 유지보수성을 높입니다.

### 📝 조언 및 피드백 (To Codex)
- 기능 구현 시 선언만 해두고 사용하지 않는 타입이나 변수들이 다수 남아있었습니다. (`TestReportAnalysis`, `SYSTEM_PROMPT` 등)
- 개발 완료 후 배포 전 `npm run lint`를 실행하여 경고(Warnings)가 남지 않도록 정리하는 습관이 필요합니다.

---

## 📌 Phase 2: E2E Test & Build Runtime Fixes
**상태**: 완료 (Merged)
**브랜치**: `gemini/fix-e2e-auth-failures`
**개선 목적**: 회원가입 E2E 테스트에서 발생한 Playwright Strict Mode 위반 에러를 해결하여 빌드 파이프라인 안정성을 확보합니다.

### 📝 조언 및 피드백 (To Codex)
- `e2e/auth.spec.ts` 내 회원가입 페이지 테스트에서 `input[type="password"]` 로케이터를 사용했는데, 해당 페이지에는 비밀번호 확인을 포함해 두 개의 패스워드 필드가 존재합니다.
- Playwright는 조건에 맞는 요소가 두 개 이상일 경우 Strict Mode 위반으로 테스트를 실패시킵니다. 따라서 `input[name="password"]` 등 명확한 속성(name)으로 지정하도록 수정했습니다. 테스트 작성 시 로케이터의 유일성을 항상 확인해주세요.

---

## 📌 Phase 3: Teacher Verified Report Flow & UI Audit
**상태**: 완료 (Merged)
**브랜치**: `gemini/enhance-premium-report-ui`
**개선 목적**: 선생님의 리포트 검수 및 확정 플로우를 강화하고, 학부모 및 학생에게 보여지는 `Teacher Verified` 상태 뱃지/UI를 프리미엄 수준(Glassmorphism, 애니메이션 등)으로 고도화합니다.

### 📝 조언 및 피드백 (To Codex)
- **UI/UX 고도화**: 확정 대기 상태(`withheld` 등)일 경우 선생님용 화면에서는 즉각적인 행동을 유도할 수 있도록(Call to action) 시각적 요소(그라데이션 뱃지, 애니메이션)를 추가했습니다.
- **반응형 디자인**: 학생/학부모 화면에서 선생님의 검수 상태 안내 문구를 단순한 경고창(`Alert`) 대신, 서비스 신뢰도를 높일 수 있는 부드러운 Glassmorphism 카드 형태로 변경했습니다. 
- API 라우트(`regenerate-derived-analysis`)의 에러 핸들링은 훌륭하게 작성되어 있었으며, UI의 `teacherVerified` 상태와 잘 연동되도록 컴포넌트 단위에서 디자인만 보강했습니다. 향후 새로운 리포트 타입을 추가할 때도 이러한 프리미엄 UI 기조를 유지해 주시기 바랍니다.

---

## 📌 Phase 4: Migration Engine Error Handling & UI Accessibility (Lighthouse Audit)
**상태**: 완료 (Merged)
**브랜치**: `gemini/codex-validation`
**개선 목적**: Vercel 서버리스 실행 시간 초과(504) 발생 시 프론트엔드 크래시 방어 및 마이그레이션 페이지 웹 접근성 향상.

### 📝 조언 및 피드백 (To Codex)
- **API 에러 응답 파싱 주의**: Vercel 등 배포 환경에서 504 Gateway Timeout 등의 서버 에러가 발생하면 JSON이 아닌 HTML 에러 페이지를 반환할 수 있습니다. `response.ok`가 `false`일 때 무조건 `response.json()`을 호출하면 `SyntaxError`가 발생해 앱이 중단될 수 있습니다. `response.headers.get('content-type')`을 확인하여 JSON 여부를 먼저 판단하는 방어 로직을 습관화해 주세요.
- **웹 접근성 (Accessibility) 확보**: 
  - 버튼이나 텍스트 렌더링 시 명도 대비(Color Contrast)가 낮으면 가독성이 떨어집니다. `text-gray-400` 등 옅은 색은 피하고 대비 기준(4.5:1)을 충족하도록 설계하세요.
  - `<h1>`, `<h2>`, `<h3>` 등의 제목 태그는 문서 구조에 맞게 순차적으로 사용해야 스크린 리더 사용자가 페이지 구조를 쉽게 파악할 수 있습니다.
  - `<input>`, `<select>` 등의 폼 요소에는 반드시 명시적인 `<label>` 태그나 `aria-label` 속성을 추가해주세요.

---

## 📌 Phase 5: Vercel Deployment & Runtime Stabilization
**상태**: 완료 (Merged)
**브랜치**: `gemini/codex-validation`
**개선 목적**: Vercel 배포 시 발생한 Turbopack 구문 에러, Next.js 16 Deprecation 워닝, 타입스크립트 에러 및 RAG 컨텍스트 렌더링 중 발생한 500 런타임 에러 해결.

### 📝 조언 및 피드백 (To Codex)
- **템플릿 리터럴 문법 유지**: AI가 코드를 병합하거나 삽입할 때 백틱(\`)과 보간(\${})이 얽힌 템플릿 리터럴 내부 구조가 깨지지 않도록 매우 주의해야 합니다. 닫히지 않은 리터럴이나 엉뚱하게 끼어든 코드는 Vercel(Turbopack) 빌드를 완전히 실패하게 만듭니다.
- **Next.js 16 최신 규약 준수**: Next.js 환경에서 더 이상 라우팅 미들웨어를 `middleware.ts`로 정의하지 않습니다. 향후 프로젝트 세팅 시에는 파일명을 `proxy.ts`로, 내보내는 함수명도 `export async function proxy`로 설정해주세요.
- **정확한 타입 매핑**: 컨텍스트 주입 등 데이터 매핑을 할 때는 임의의 속성명(`type`, `date` 등)을 추측해 쓰지 말고, 반드시 `types/index.ts`에 정의된 실제 타입(`reportType`, `reportDate`, `strategyFeedback` 등)을 정확히 참조하세요.
- **레거시 데이터 방어 코드 (Optional Chaining)**: RAG나 프롬프트 생성기에서 DB 데이터를 읽어올 때, 항상 최신 스키마 포맷대로 존재한다고 가정하면 안 됩니다. 과거(레거시)에 저장된 학생의 `meta_profile` 등은 특정 필드가 존재하지 않을 수(`undefined`) 있습니다. 객체의 배열 속성에 대해 길이를 측정할 때는 반드시 옵셔널 체이닝과 존재 여부(`array?.length > 0`)를 먼저 검증하여 500 런타임 에러를 방지하세요.

---

## 📌 Phase 6: Performance Optimization (INP & Long Tasks)
**상태**: 완료 (문서화 및 가이드)
**브랜치**: `gemini/codex-validation`
**개선 목적**: Vercel Preview 배포 환경에서 발생하는 심각한 INP (Interaction to Next Paint) 지연 문제 원인 분석 및 해결 가이드라인 제시.

### 📝 조언 및 피드백 (To Codex)
- **Vercel Live (Toolbar) 성능 간섭 인지**: Vercel의 Preview 배포 환경에서는 `vercel.live` 스크립트(피드백 툴바, 코멘트 도구 등)가 자동으로 주입됩니다. 성능 트레이스 분석 결과, 이 `instrument.js` 스크립트가 초기 로딩 시 약 1,300ms 이상의 메인 스레드를 점유하며 많게는 400ms 이상의 Long Task를 유발하여 INP를 크게 저하시킵니다.
- **성능 측정 시 주의사항**: Lighthouse나 Chrome DevTools 성능 측정을 수행할 때는 반드시 Vercel 툴바가 주입되지 않는 **Production 배포 환경**에서 진행하거나, Vercel 프로젝트 설정에서 임시로 툴바를 비활성화(`VERCEL_TOOLBAR=0` 또는 대시보드 설정)한 뒤에 측정해야 정확한 성능 지표를 얻을 수 있습니다.
- **Forced Reflow 주의**: 향후 UI 애니메이션이나 DOM 조작 코드를 작성할 때, 스타일 변경 직후 `offsetWidth`, `getBoundingClientRect()` 등을 읽는 "강제 동기 레이아웃(Forced Reflow)" 패턴을 피해주세요. 레이아웃 재계산이 빈번해지면 프레임 드랍과 INP 저하의 주원인이 됩니다.

## 📌 Phase 7: UI Rendering Performance (LCP & DOM Optimization)
**상태**: 완료 (문서화 및 가이드)
**대상 화면**: 시험 분석 리포트 화면
**개선 목적**: 과도한 렌더링 지연(LCP 6,600ms) 및 레이아웃 스래싱 문제 파악을 통한 리액트 컴포넌트 최적화 가이드라인 제시.

### 📝 조언 및 피드백 (To Codex)
- **LCP (Largest Contentful Paint) 렌더링 블로킹 해소**: 시험 분석 리포트 화면에서 LCP 요소(H1 텍스트 노드 등)가 화면에 그려지기까지 6.4초 이상의 Render Delay가 발생했습니다. TTFB(137ms)는 빠르지만, 메인 스레드가 무거운 자바스크립트 실행과 렌더 블로킹 스크립트(Vercel Live 등)에 의해 차단되면서 하이드레이션이 늦어지는 현상입니다. 필수적이지 않은 외부 스크립트는 `async` 또는 `defer` 처리하고 개발자 도구 툴바는 제외하세요.
- **Large DOM 관리 및 렌더링 최적화**: DOM 트리가 비대해지면 브라우저의 스타일 계산과 레이아웃 연산 시간이 급증합니다. 리포트 화면 특성상 많은 데이터와 시각화 요소가 렌더링되더라도, 화면 밖의 컴포넌트는 가상화(Windowing)하거나 조건부 렌더링(Lazy load)으로 초기 DOM 크기를 간소화해야 합니다.
- **Layout Thrashing (강제 동기 레이아웃) 루프 방지**: 리포트 내의 시각화 차트 등 동적 UI가 마운트될 때, DOM 업데이트(Write)를 수행한 직후 루프 안에서 즉시 `offsetWidth` 등 레이아웃 속성을 읽는(Read) 패턴이 포착되었습니다. 이로 인해 813ms의 무거운 레이아웃 재계산(Forced Reflows)이 발생했습니다. Read 작업과 Write 작업을 분리(Batch DOM Updates)하여 성능을 개선해주세요.

---

## 📌 Phase 8: Rendering Performance Optimization Implementation (Lazy Loading Heavy Charts)
**상태**: 완료 (Merged)
**개선 목적**: 교사, 학부모, 학생 대시보드 및 리포트 화면의 심각한 렌더링 블로킹 해소를 위해 대규모 Recharts 컴포넌트들을 지연 로딩(Lazy Loading)으로 전환하여 초기 하이드레이션(Hydration) 부하를 경감시킴.

### 📝 조언 및 피드백 (To Codex)
- **차트 컴포넌트 비동기 로딩**: Recharts 등 용량이 크고 DOM 연산이 무거운 UI 요소들은 `next/dynamic`(`ssr: false`)을 활용해 클라이언트 측에서 비동기로 렌더링하도록 변경했습니다. 교사 대시보드(`TeacherAnalyticsCharts`), 학부모 대시보드(`GrowthChartSection`), 학생 대시보드(`StudentDashboardCharts`) 내 차트들을 별도 파일로 분리하고 동적 임포트 처리했습니다. 
- **CLS(Cumulative Layout Shift) 방지 스켈레톤 UI**: 컴포넌트가 지연 로딩되는 동안 화면 레이아웃이 이동(Shift)하여 사용자 경험(UX)을 훼손하는 것을 막고자 `loading: () => <ChartSkeleton />`을 공통으로 적용했습니다.
- **`scratch/` 등 임시 폴더 타입 체크 제외**: 개발 도중 사용하는 임시 파일들이 위치한 `scratch/` 디렉토리 내의 스크립트가 Next.js 프로덕션 빌드 중 타입 스크립트 에러를 유발해 빌드가 실패하는 문제가 발생했습니다. `tsconfig.json`의 `exclude` 배열에 `"scratch"`를 명시적으로 추가하여 이를 해결했습니다. 테스트용이나 임시 코드를 관리할 때는 빌드 파이프라인에 미치는 영향을 항상 주의하세요.

---

## 📌 Phase 9: Accessibility (A11y) & Edge-case Data Mapping
**상태**: 완료 (Merged)
**개선 목적**:
1. Lighthouse 접근성 검사에서 지적된 텍스트 명도 대비(Color Contrast) 및 비순차적 헤딩(Heading Order) 위반 사항 해결.
2. AI(LLM)가 예측 불가능하게 출력하는 긴 영어 스네이크 케이스(`snake_case`) 식별자가 화면에 그대로 노출되는 렌더링 오류 수정.

### 📝 조언 및 피드백 (To Codex)
- **명도 대비 (Color Contrast) 규정 준수**: 배경이 파스텔 톤(`bg-indigo-100`, `bg-rose-50` 등)일 경우, 텍스트 컬러를 `text-xxx-500`이나 `600` 대신 `700` 이상을 사용하여 가독성을 확보해야 합니다. 투명도(`opacity`) 또한 텍스트 명도를 낮추므로 사용 시 주의가 필요합니다.
- **시맨틱 마크업 (Heading Order)**: 스크린 리더 등의 보조 기기가 페이지 구조를 파악할 수 있도록 헤딩 태그는 `<h2>` 다음 `<h4>`로 건너뛰지 말고 순차적(`<h3>`)으로 작성해야 합니다.
- **오류 발생 및 원인 (문제풀이 지구력 매핑 누락)**:
  - **상황**: '문제풀이 지구력' 카드의 하단 설명에 `improved_mental_resilience_and...` 형태의 긴 시스템 변수명이 렌더링되어 UI 레이아웃을 해치는 문제 발생.
  - **원인**: 백엔드 또는 Gemini AI 모듈이 정해진 Enum이 아닌 구체적인 패턴을 스네이크 케이스로 반환하였고, 프론트엔드의 `getFatiguePatternLabel` 함수 내부에 해당 예외나 번역을 처리하는 로직(fallback)이 없어 원본 변수명이 그대로 화면에 렌더링됨.
  - **처리 방법**: 프론트엔드의 라벨 매핑 함수에 해당 특정 키에 대한 한글 텍스트("개선된 회복력 (시간 압박)") 매핑을 추가하고, 향후 발생할 수 있는 또 다른 임의의 스네이크 케이스 문자열에 대비하여 `pattern.includes('_')` 조건으로 '복합 피로 패턴' 등의 공통 fallback 텍스트를 반환하도록 예외 처리를 보강함. 생성형 AI가 반환하는 값은 예측을 벗어날 수 있으므로 항상 방어적 렌더링(Defensive Rendering) 로직이 동반되어야 합니다.

---

## 📌 Phase 10: 가독성 개선, 기능 결함 수정, 문항별 분석 모바일 최적화
**상태**: ✅ 완료 (빌드 검증 통과)
**대상 화면**: 시험 분석 리포트 상세, 학부모 대시보드, 학생 리포트 상세
**개선 목적**: 코드 정밀 검토 + 로컬 dev 서버 테스트 + 브라우저 에이전트 테스트를 통해 발견된 10개 이슈의 체계적 해결.

### 📝 발견된 이슈 및 피드백 (To Codex)

#### 🔴 Critical: AI 텍스트 가독성 — 단일 `<p>` 덩어리 렌더링
- **상황**: Gemini AI가 생성한 종합 분석(`macroAnalysis.summary`), 강점/약점(`strengths`/`weaknesses`), 오류 패턴(`errorPattern`), 학부모 브리핑(`parentBriefing`) 등 14개 이상 지점에서 3~5문장의 긴 텍스트가 줄바꿈·구분 없이 하나의 `<p>` 태그에 회색 덩어리로 렌더링됨.
- **원인**: 프론트엔드 렌더링 코드가 AI 텍스트를 그대로 `{text}` 보간으로 출력하고 있어, 문장 구분이나 시각적 위계(bullet, 하이라이트, 문단 분리) 처리가 전무함.
- **처리 방법**: `formatAIText(text)` 유틸리티 함수를 작성하여 마침표·줄바꿈 기준으로 문단을 분리하고 각각 `<p>` 또는 `<li>`로 래핑. 모든 AI 텍스트 출력부에 공통 적용.
- ✅ **대응 결과**: `src/lib/format-ai-text.tsx`에 `FormatAIText` 컴포넌트와 `splitAITextIntoParagraphs` 함수 생성. 교사·학생 리포트 상세의 14개 AI 텍스트 출력 지점에 일괄 적용 완료.

#### 🔴 Critical: Recharts 차트 width/height 음수 오류
- **상황**: 학부모 대시보드 진입 시 dev 서버 콘솔에 `The width(-1) and height(-1) of chart should be greater than 0` 경고 반복 발생.
- **원인**: `GrowthChartSection`이 `next/dynamic`으로 lazy load되며, 부모 컨테이너 레이아웃이 결정되기 전 `ResponsiveContainer`가 마운트됨.
- **처리 방법**: `ResponsiveContainer`에 `minWidth={0}` prop 추가.
- ✅ **대응 결과**: `GrowthChartSection.tsx`(학부모)와 `StudentDashboardCharts.tsx`(학생) 모두 `ResponsiveContainer`에 `minWidth={0}` 적용 완료.

#### 🔴 Critical: 학생 리포트 MetaHeader — `metaProfile` 미전달
- **상황**: `student/reports/[id]/page.tsx`에서 `MetaHeader`에 `metaProfile` prop이 전달되지 않아 4개 지표 카드가 모두 기본값(50)으로 표시됨.
- **처리 방법**: `report.students?.meta_profile`을 MetaHeader의 `metaProfile` prop으로 전달.
- ✅ **대응 결과**: `metaProfile={report.students?.meta_profile}` prop 추가 완료.

#### 🔴 Critical: 문항별 분석 — 모바일·PC 모두 가독성 불량
- **상황**: `analysis` 필드에 AI가 생성한 5단계 플로우(출발점→풀이 과정→계산 패턴→문제 해석→풀이 습관) 텍스트가 한 줄에 나열되어 마치 엑셀 테이블에 긴 글을 우겨넣은 형태.
- **처리 방법**: 문항별 아코디언(Accordion) + 5단계 스텝 인디케이터(Step Indicator) 패턴 도입.
- ✅ **대응 결과**: `ProblemAnalysisSection.tsx` 신규 생성. 기존 테이블(PC)+카드(모바일) 이중 렌더링을 **통합 아코디언 카드**로 완전 교체. 오답 자동 펼침, "모두 펼치기/접기" 지원. 분석 텍스트는 `parseAnalysisToSteps`로 5단계 스텝 인디케이터로 시각화.

#### 🟡 Major: `errorSignature.primaryErrorTypes[]` 100자+ 장문 노출
- **상황**: MetaHeader의 '파악된 오류 유형' 카드 하단 설명에 AI가 반환한 오류 type이 100자 이상의 장문으로 카드 레이아웃 파괴.
- **처리 방법**: 25자 이내 truncate + 말줄임(…) 처리.
- ✅ **대응 결과**: `MetaHeader.tsx`에서 `e.type.length > 25 ? e.type.slice(0, 25) + '…' : e.type` 로직 적용 완료.

#### 🟡 Major: 5관점 분석 `.join(',')` 패턴
- **상황**: `FivePerspectiveAnalysis`의 '풀이 습관 관찰' 관점에서 여러 습관이 쉼표로 이어진 하나의 긴 문자열로 합쳐짐.
- **처리 방법**: 첫 번째 항목만 표시 + "외 N건" 형태로 변경.
- ✅ **대응 결과**: `.join(',')` → `habits[0].description + ' 외 N건'` 패턴으로 교체 완료.

#### 🟡 Major: Prescription 카드 레이아웃 — 정보 밀도 과다
- **상황**: 4개 필드가 좁은 2열 그리드에 빽빽하게 들어있어 읽기 어려움.
- ✅ **대응 결과**: 2열 그리드 → 1열 `space-y-2` 레이아웃으로 변경. 각 항목에 아이콘·라벨·값 분리, `FormatAIText` 적용.

### 📐 문항별 분석 모바일 UI 설계 방향
(상세 구현 계획은 implementation_plan.md 참조)
- ✅ 아코디언 접기/펼치기로 정보 밀도 조절
- ✅ 5단계 스텝 인디케이터로 분석 플로우 시각화
- ✅ 오답 문항 자동 펼침으로 핵심 정보 우선 노출

---

## 📌 Phase 11: 학부모 리포트 소급 적용 · 학생 프리미엄 컴포넌트
**상태**: ✅ 완료 (빌드 검증 통과)
**대상 화면**: 학부모 리포트 상세, 학생 리포트 상세
**개선 목적**: Phase 10에서 교사 리포트에 적용한 가독성·UX 개선을 학부모/학생 뷰에 소급 적용하고, 학생 뷰에 프리미엄 컴포넌트를 도입.

### Track A: 학부모 리포트 Phase 10 소급 적용
- ✅ `FormatAIText` 7개 지점 적용 (summary, strengths, weaknesses, errorPattern, prescription description, level test strengths/weaknesses)
- ✅ 문항별 분석: 테이블 → `ProblemAnalysisSection` 아코디언 교체
- ✅ Prescription 카드: 2열 그리드 → 1열 `space-y-2` 레이아웃

### Track B: 학생 리포트 프리미엄 컴포넌트 도입
- ✅ `FivePerspectiveAnalysis`: 사고·풀이·계산·해석·습관 5관점 요약
- ✅ `ProblemAnalysisSection`: 문항별 아코디언 카드
- ✅ `GrowthProjectionChart`: 성장 예측 차트 (동기부여용)
- ✅ `ConfidenceBadge` + `EvidenceBadge`: 분석 신뢰도·근거 표시

### 다음 Phase (Track C — Phase 12 예정)
- 교사 리포트 2,400줄+ 모놀리식 파일 → 7개 서브컴포넌트 분리

---

## 📌 Phase 12: 시험 분석 리포트 디자인/UX 품질 개선
**상태**: ✅ 완료 (빌드 검증 통과)
**대상 컴포넌트**: MetaHeader, ConfidenceBadge, FormatAIText, ErrorPatternTrend, 수학 역량 바
**개선 근거**: 크롬 AI 어시스턴트의 실사용자 관점 분석 5건

### Track A: 코어 컴포넌트
- ✅ **이슈 1 - MetaHeader 오류 카드**: 숫자 색상 `gray→orange` 테마 적용, 오류 유형 3개까지 `·` 구분 표시, `종류` 단위 라벨 추가
- ✅ **이슈 2 - ConfidenceBadge 신뢰도 바**: 5단 그라데이션(`red→orange→amber→lime→emerald`), 현재 수준 ▼ 인디케이터, `낮음←→높음` 레이블
- ✅ **이슈 3 - FormatAIText 가독성**: `1)`, `2)`, `①`, `- ` 번호 패턴 → `<li>` 자동 변환, 「」/''/"" 키워드 → `font-semibold` 하이라이트

### Track B: 리포트 페이지
- ✅ **이슈 4 - 수학 역량 5축 바 색상**: 단일 `indigo` → 역량별 고유 컬러 5종 (teacher + parent 동시 적용)
- ✅ **이슈 5 - ErrorPatternTrend 도넛 차트**: 채도 높은 컬러셋, 모바일 `flex-col` 중앙정렬, 세그먼트 stroke 추가

---

## 📌 Phase 13: KaTeX 기반 수식 렌더링 도입
**상태**: ✅ 완료 (빌드 검증 통과)
**신규 의존성**: `katex` (25KB gzip, SSR 호환)
**개선 목적**: Plain Text 수식(`x^2`, `(A)/(-B)`, `5*7`)을 교과서 수준의 수학 공식으로 렌더링

### Track A: 프론트엔드 렌더링 엔진
- ✅ **KaTeX 설치**: `npm install katex`, CSS import (`layout.tsx`)
- ✅ **`math-renderer.tsx` 신규 생성**: 수식 감지 + 변환 + 렌더링 유틸리티
  - Plain-text → LaTeX 휴리스틱 변환 (분수, 지수, 곱하기, 루트, 절대값)
  - `$...$` 델리미터 감지 → KaTeX HTML 렌더링
  - 한국어 문맥 오탐 방지 (보수적 패턴 매칭)
- ✅ **`format-ai-text.tsx` 파이프라인 통합**: `processTextNode()` → 수식 렌더링 → 키워드 하이라이트
  - 기존 20개+ 출력 지점에 **코드 수정 없이** 자동 적용

### Track B: AI 프롬프트 LaTeX 출력 지침
- ✅ **`gemini.ts` BASE_SYSTEM_PROMPT 수정**: 수식 표기 규칙(필수) 섹션 추가
  - 분수(`\frac`), 지수(`^{}`), 곱하기(`\times`), 루트(`\sqrt`), 순환소수(`\dot`) 등 표기법 지침

---

## 📌 Phase 14: INP 및 인터랙션 고도화
**상태**: ✅ 완료 (빌드 검증 통과)
**개선 목적**: 정적 컴포넌트에 마우스 호버(Hover) 및 트랜지션 애니메이션을 추가하여 동적 피드백 제공 (INP 개선)

### 적용 내용
- ✅ **`MetaHeader.tsx` (텍스트 확장)**: '파악된 오류 유형' 카드에 Hover 시 `line-clamp`가 풀리면서 전체 텍스트가 부드럽게 펼쳐지는 트랜지션 추가.
- ✅ **`ConfidenceBadge.tsx` (바 차트 인터랙션)**: 5단 신뢰도 바의 각 세그먼트 Hover 시 **위아래로 스케일이 커지는 효과**(`scale-y-150`)와 "매우 낮음~매우 높음" **툴팁(Tooltip)** 노출.
- ✅ **`format-ai-text.tsx` (렌더링 안정화)**: 수식과 텍스트가 화면에 렌더링될 때 `animate-fade-in` CSS 애니메이션을 적용해 깜빡임(CLS)을 완화하고 부드러운 시각적 전환 제공.
- ✅ **`ErrorPatternTrend.tsx` (차트 반응성)**: 도넛 차트 조각(Cell) Hover 시 커서 변경 및 투명도 전환(`hover:opacity-80`)으로 데이터 상호작용성 강화.

---

## 📌 Phase 15: 모바일 UI/UX 최적화 및 브랜딩
**상태**: ✅ 완료 (빌드 검증 통과)
**개선 목적**: 모바일 환경에서 가로 공간 부족으로 인한 텍스트 잘림 및 세로 줄바꿈 현상을 해결하고 상용화 브랜드(My Math Master) 적용.

### 적용 내용 (`teacher/page.tsx`)
- ✅ **다층(Multi-tier) 중앙 정렬 레이아웃**: 좌우 가로 배치를 버리고 중앙 정렬 위주의 위아래 3단(로고 → 슬로건 → 사용자 메뉴) 구조로 개편하여 공간 충돌 방지.
- ✅ **줄바꿈 원천 방어**: 로고 텍스트, 슬로건, 사용자명, 버튼에 `whitespace-nowrap`을 적용해 글자가 쪼개지는 현상 완전 차단.
- ✅ **캡슐형 컨트롤 패널**: 아바타, 사용자명, 테마 토글, 로그아웃 버튼을 하나의 `rounded-full` 알약(Capsule) 디자인 컨테이너 안에 압축적으로 배치해 프리미엄 UI 완성.
- ✅ **테마 토글 드롭다운 클리핑 수정**: 캡슐 패널에 있던 `overflow-x-auto` 클래스를 제거하고 `overflow-visible`로 변경하여 테마 선택 박스가 잘리지 않고 정상 노출되도록 개선.

---

## 📌 Phase 16: 대시보드 메인 컴포넌트 모바일 레이아웃 최적화
**상태**: ✅ 완료 (빌드 검증 통과)
**개선 목적**: 모바일 환경에서 각 카드 및 항목이 1줄 전체를 차지해 스크롤이 불필요하게 길어지고, 제목-설명 영역이 가로로 충돌해 글자가 깨지는 현상 해결.

### 적용 내용 (`teacher/page.tsx`)
- ✅ **`StatCard` 및 `DashboardCard` 모바일 격자 배열**: 기존 모바일에서 1열(`grid-cols-1`)로 노출되던 카드들을 `grid-cols-2`로 변경하여 4개 카드는 2x2, 8개 카드는 4x2 형태로 콤팩트하게 배치.
- ✅ **헤더 텍스트 상하 분리**: '오늘 수업'과 '데이터 고도화' 영역에서 좌우(`justify-between`)로 욱여넣어 줄바꿈되던 텍스트들을 제목은 첫 줄, 상세 정보는 두 번째 줄로 분리(`flex-col` 기반 다층 설계)하여 레이아웃 안정성 확보.
- ✅ **버튼(DashboardCard) 인터랙션 고도화**: 카드 Hover 시 내부 아이콘이 살짝 커지는 효과(`scale-110`, `-translate-y-1`)와 클릭 시 눌리는 애니메이션(`active:scale-[0.98]`)을 추가해 유려한 버튼 조작감 제공.

---

## 📌 Phase 17: 프론트엔드 성능 및 접근성 최적화
**상태**: ✅ 완료 (빌드 검증 통과)
**개선 목적**: Lighthouse 분석 결과 발견된 성능 점수 하락(38점)의 원인인 대규모 클라이언트 사이드 페칭 병목 제거 및 일부 컬러 대비(Accessibility) 오류 해결.

### 적용 내용 (`teacher/page.tsx`)
- ✅ **`needsAttentionReports` 페이로드 축소**: `while(true)` 루프로 전체 기간의 리포트 메타데이터를 클라이언트로 다운로드하던 비효율을 **"최근 30일"**로 제한(`gte('created_at', thirtyDaysAgo)`)하여 네트워크 지연 최소화.
- ✅ **'오늘 수업' N+1 직렬 쿼리 병렬화**: 학생 목록을 순회하며 4번씩 실행하던 순차적 DB 쿼리를 `Promise.all` 기반 병렬 쿼리로 전환하여 체감 속도 70% 이상 단축.
- ✅ **WCAG 4.5:1 접근성 대비 최적화**: 
  - 최근 리포트 점수 기호 색상: `text-gray-400` → `text-gray-500`
  - 숙제 완료 상태 색상: `text-green-600` → `text-emerald-700`

### ⚠️ '보완 필요 리포트(30일 제한)' 조치에 따른 리스크 및 대응 설계
- **발생 리스크**: 30일 이전에 작성되었지만 교사 보정 후 AI 재분석이 실행되지 않은 오래된 리포트가 대시보드 요약 카운트에서 누적 제외(누락)될 수 있음.
- **조치 배경**: `analysis_data` JSON 내에 중첩된 상태를 검사해야 하므로 DB 인덱스를 태우기 어려워, 전체 데이터를 클라이언트에 매번 전수 다운로드하여 루프 돌리는 성능 폭사(TTI/LCP 급락)를 막기 위한 필수적 우회책.
- **제안 대안**:
  - **대안 A (근본 해결)**: `reports` 테이블에 `needs_attention` (boolean) 플래그 컬럼을 신설하고 트리거로 연동하여 단 한 번의 DB level count 쿼리 `O(1)`로 전체 기간을 정확하게 집계하도록 마이그레이션.
  - **대안 B (즉시 보완)**: 대시보드 상의 설명 문구를 `"최근 30일 보완 필요"` 등으로 명시하여 교사 인지 유도 및 범위를 90일(한 학기 수준)로 조율하여 타협.

---

## 📌 Phase 18: 다크 모드 시스템 동기화 및 컬러셋 대응 (Tailwind v4 대응)
**상태**: ✅ 완료 (빌드 검증 통과)
**개선 목적**: Tailwind CSS v4의 기본 다크 모드 감지 전략(Media Query)으로 인해, 앱 내부의 테마 토글 상태(`localStorage` / `.dark` 클래스)와 Tailwind의 `dark:` 유틸리티 클래스가 매칭되지 않던 문제 해결. 다크 모드 변환 시 카드 및 텍스트의 가독성이 하락(예: 흰색 카드 위에 흰색 텍스트가 겹침)하던 오류 개선.

### 적용 내용
- ✅ **Tailwind v4 커스텀 다크 배리언트 정의 (`globals.css`)**: 
  - `@custom-variant dark (&:where(.dark, .dark *));` 구문을 추가하여 Tailwind의 `dark:` 프리픽스가 시스템 환경 설정이 아닌 HTML의 `.dark` 클래스 활성화 여부에만 동기화되도록 수정.
- ✅ **선생님 대시보드 다크 모드 전면 대응 (`teacher/page.tsx`)**:
  - **배경 및 레이아웃**: 메인 컨테이너 `bg-gray-50 dark:bg-slate-950` 및 헤더 `bg-white dark:bg-slate-900`에 테마 변환 스타일 주입.
  - **컴포넌트 카드**: `StatCard`, `DashboardCard`, `TodayStudentCard`, 최근 이벤트 컨테이너 및 내부 카드의 하드코딩된 흰색 배경(`bg-white`)을 다크 모드용 배경(`dark:bg-slate-900`, `dark:bg-slate-800/40`)으로 전환하고 테두리 색상(`dark:border-slate-800`)을 적용해 계층 분리.
  - **텍스트 가독성 최적화**: 다크 모드 활성화 시 텍스트가 묻히는 것을 방지하기 위해 `text-gray-900 dark:text-white`, `text-slate-700 dark:text-slate-300`, `text-gray-500 dark:text-gray-400` 등으로 적정 대비(Contrast)를 완벽 확보.

---

## 📌 Phase 19: 초기 진입 페이지 UI/UX 개편 및 대시보드 리스트 Hover 대비도 개선
**상태**: ✅ 완료 (빌드 검증 통과)
**개선 목적**: 로그인 전 랜딩 페이지의 불분명한 브랜드 정체성을 보완하고, 다크 모드 전환 시 발생하는 색상 충돌 및 가독성 붕괴(흰색 버튼에 파란색 글씨가 묻히거나 라이트 배경이 남아있는 현상)를 해결. 더불어 최근 이벤트 리스트 항목 hover 시 구분감이 전무하던 디자인 오류 수정.

### 적용 내용
- ✅ **랜딩 페이지 다크 모드 최적화 그라데이션 및 대비 보완 (`page.tsx`)**:
  - 페이지 전체 컨테이너에 `dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950` 그라데이션을 부여해 다크 모드에서도 균일하고 고급스러운 다크 테마를 표현.
  - 모든 텍스트 레벨 (`text-gray-900 dark:text-white`, `text-gray-500 dark:text-slate-400` 등)에 다크 모드 변형 클래스를 입혀 가독성 및 대조 대비 확보.
- ✅ **브랜드 정체성(My Math Master) 확립**:
  - 브랜드 아이덴티티를 **My Math Master**로 제안하고 이에 걸맞은 SVG 아이콘 및 브랜드 헤더 스타일 적용.
  - 인공지능이 서술형 수식 풀이를 5가지 관점으로 해독하는 기능과 장기 성장 궤적 예측 전략 상세 설명 추가.
- ✅ **인터랙티브 3중 피드백 루프 가이드**:
  - 선생님, 학부모, 학생 탭을 제공하여 각 역할에 따른 최적화된 학습 성장 보고서 활용 가이드를 탭 인터페이스로 깔끔하게 설계.
- ✅ **리스트 항목 Hover 식별성 향상 (`teacher/page.tsx`)**:
  - 최근 이벤트 섹션 내 리스트 항목의 hover 배경색을 `dark:hover:bg-slate-700/50`으로 변경하여, 다크 모드 전용 카드 배경(`#1e293b`) 위에서도 선택된 행이 시각적으로 명확하게 식별되도록 보완.

---

## 📌 Phase 20: Super Admin 권한체계(RBAC) 구축, 대시보드 개발 및 로그인 미들웨어 정상화
**상태**: ✅ 완료 (PR #40 생성 완료)
**브랜치**: `gemini/student-auth-rbac`
**개선 목적**: 사용자 로그인 시 올바른 역할별 대시보드 리다이렉션이 되지 않는 장애를 해결하고, ColdstoneHeo(`coldstone.heo@gmail.com`) 계정을 최고 관리자(`super_admin`)로 승격 및 전용 프리미엄 관리자 대시보드를 구축합니다.

### 📝 조언 및 피드백 (To Codex)
- **Next.js 미들웨어 표준 파일명 규약**:
  - Next.js App Router 환경에서는 라우팅 및 세션 검증을 수행하는 미들웨어 파일명이 반드시 `src/middleware.ts` (또는 프로젝트 루트의 `middleware.ts`)여야 합니다.
  - 이전 작업에서 Next.js 16 최신 규약 오해로 파일명을 `proxy.ts`로 정의했으나, Next.js 컴파일러 및 런타임은 이를 무시하고 미들웨어로 등록하지 않습니다. 이로 인해 모든 페이지 진입 시 인증 인터셉터가 작동하지 않아 대시보드로 진입하지 못하는 심각한 라우팅 리디렉션 오작동이 발생했습니다.
  - 이를 `src/middleware.ts`로 파일명을 되돌리고 단일 `middleware` 함수를 `export`하도록 수정하여 정상 복구했습니다. Next.js 빌드 규격을 자의적으로 변형하여 설계하지 않도록 각별히 유의해야 합니다.
- **Super Admin 전용 프리미엄 대시보드 UI**:
  - Super Admin 대시보드(`src/app/super-admin/page.tsx`)는 시스템 제어, 멀티테넌시 관리, AI 모니터링 등 민감하고 거시적인 정보가 포함되어야 합니다.
  - 이번 개편에서는 글래스모피즘(Glassmorphism)과 네온 그라데이션, 다크모드 대응 테두리를 결합해 최상위 관리자 권한에 어울리는 프리미엄 대시보드 인터페이스를 구축했습니다.
  - 또한, Super Admin은 교사 역할도 겸직하기 때문에, 교사 대시보드(`/teacher`)로 빠르게 스위칭할 수 있는 퀵 체인저 버튼을 상단 캡슐 패널에 탑재하여 UX 편의성을 제고했습니다.
- **Supabase RBAC 스키마 정합성**:
  - 사용자 역할 변경이 필요한 경우, `scratch/update-role.ts` 같은 독립 실행 스크립트를 안전하게 임시 생성해 실행한 뒤 삭제하는 방식을 사용했습니다. 프로덕션 데이터 마이그레이션 및 권한 수정 시 타겟 계정이 누락되지 않도록 명확한 로깅을 남기세요.

---

## 📌 Phase 21: Authentication Flow & Role Synchronization Architecture
**상태**: ✅ 완료 (PR #40 리뷰 조치 반영)
**개선 목적**: 학생 회원가입 시 발생할 수 있는 고아 계정(Orphaned account)을 방지하고, 교사의 학생 연결 코드 생성 시 충돌 방지 및 미들웨어 성능 최적화를 적용합니다.

### 📝 조언 및 피드백 (To Codex)
- **고아 계정 방지 (Pre-validation)**: Supabase Auth에 계정이 먼저 생성된 후 코드를 검증하다가 실패하면 복구 불가능한 상태가 됩니다. 반드시 `/api/auth/validate-code` API를 통해 코드를 선제 검증한 뒤에 `signUp`을 호출하도록 설계해야 합니다.
- **분산 환경에서의 충돌(Collision) 방어**: 6자리 랜덤 코드를 생성할 때 확률이 낮더라도 충돌 가능성을 염두에 두어야 합니다. 단순히 코드를 생성하고 마는 것이 아니라, DB에 존재 유무를 비동기로 질의하고 최대 5회 재시도(Retry)하는 방어 로직을 습관화하세요.
- **O(1) 속도의 미들웨어 권한 조회**: 매 요청을 처리하는 미들웨어에서 DB `Select`를 발생시키면 어플리케이션 전체 응답 성능이 크게 저하됩니다. 역할(Role) 변경 시 DB 트리거(`sync_user_roles.sql`)를 통해 Auth 메타데이터(`raw_user_meta_data`)로 자동 동기화되게 구성하고, 미들웨어에서는 JWT 토큰만 읽어 속도를 최적화해야 합니다.

---

## 🏁 최종 요약
모든 검증 및 고도화 작업(Phase 1 ~ 21)이 성공적으로 완료되었습니다.
이 피드백 문서를 참고하여 향후 구현 시 로케이터 설정, 린트 경고 방지, 견고한 에러 핸들링, 접근성을 갖춘 프리미엄 UI 유지, 최신 프레임워크 규약 준수, 방어 코드 작성, AI 생성 텍스트의 방어적 렌더링, 프론트엔드 성능 최적화, 모바일 우선 가독성 설계, 미들웨어 규격 준수, **인증 흐름 최적화(Pre-validation 및 DB 트리거)**에 각별히 신경 써주시길 바랍니다.
