---
name: report-harness
description: 루프 엔지니어링 하네스로 작업하는 방법 — 생성·평가 분리, 상태파일 체인, 1 PR=1 의도 분할. 새 기능·리포트·문서를 만들거나 PR을 쪼갤 때 사용한다.
---

# Report Harness 작업 스킬

이 프로젝트의 모든 비자명한 작업은 **Maker→Critic 루프**로 진행한다.
전체 정의는 [`../../HARNESS.md`](../../HARNESS.md) 참고.

## 작업 루프

1. **spec** — 무엇을/왜를 한 단락으로 적는다(`scratch/`에). 수용 기준 명시.
2. **plan** — 건드릴 파일과 단계를 적는다. 가정을 드러낸다(Think Before Coding).
3. **draft** — 최소 범위로 구현한다(Simplicity First, Surgical Changes).
4. **qa_report** — `critic` 서브에이전트를 호출해 독립 채점받는다. **스스로 합격 판정 금지.**
5. **보정** — Critic 판정이 NEEDS_REVISION이면 결함만 고치고 4로 돌아간다(PASS까지).
6. **final** — `npm run build` 통과 확인 후 확정.

## Critic 호출 시점

- 코드 변경을 커밋하기 전
- AI 리포트 생성 직후(생성 모델과 다른 시각으로 검증)
- PR 올리기 직전(범위·안전성 점검)

## PR 분할 판단 (1 PR = 1 의도)

한 변경이 아래 중 **둘 이상**을 건드리면 PR을 쪼갠다:

| 계층 | 예 |
|------|-----|
| 문서 | `*.md`, `docs/`, PRD |
| UI | `src/app/**/page.tsx`, `src/components/` |
| DB | `supabase/migrations/`, `src/types/index.ts` 스키마 |
| 테스트 | `e2e/`, `tests/` |
| 설정 | `.mcp.json`, config, CI |

분할 순서: DB(마이그레이션) → 백엔드/API → UI → 테스트 → 문서. 의존 순서대로 작은 PR을 쌓는다.

## 재사용 자산 (새로 만들지 말 것)

- 평가/피드백: `src/lib/feedback-loop.ts`, `src/lib/teacher-verified-analysis.ts`
- 모델 라우팅: `src/lib/model-router.ts` (Critic엔 Maker와 다른 모델 라우팅 가능)
- 입력 검증: `src/lib/validations.ts` · 레이트리밋: `src/lib/rate-limiter.ts`
