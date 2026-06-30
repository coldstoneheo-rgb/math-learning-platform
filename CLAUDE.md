# CLAUDE.md

Math Learning Platform — Next.js + Supabase + Gemini로 학생 수학 학습을 분석·리포트하는 서비스.
이 파일은 **작업 원칙**만 담는다. 상세 레퍼런스는 아래 링크를 따라간다.

- 아키텍처·서비스·워크플로: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 데이터 모델·타입: [docs/DATA_MODELS.md](docs/DATA_MODELS.md) (구현: `src/types/index.ts`)
- 제품 요구사항(PRD): [MathLearning_PRD_v3.0_Implementation.md](MathLearning_PRD_v3.0_Implementation.md)

## 작업 원칙 (Karpathy)

1. **Think Before Coding** — 코딩 전에 가정을 명시한다. 모호하면 여러 해석을 제시하고,
   혼란스러운 부분을 먼저 명확히 한다. 필요하면 더 단순한 접근을 역제안한다.
2. **Simplicity First** — 요청 이상을 만들지 않는다. 과도한 추상화 금지.
   200줄로 될 일을 50줄로 줄일 수 있으면 다시 쓴다.
3. **Surgical Changes** — 필요한 것만 건드린다. 무관한 코드를 "개선"하지 않는다.
   기존 스타일을 따른다. 내 변경이 만든 군더더기만 제거한다.
4. **Goal-Driven Execution** — 명령형을 선언형으로 바꾼다.
   "검증 추가" → "실패하는 테스트 작성 → 통과시키기". 목표에 도달할 때까지 반복한다.

## 루프 하네스 (Loop Engineering)

만드는 AI와 평가하는 AI를 **반드시 분리**한다. 동일 계열 모델의 자가평가는 self-bias가 있다.

- **생성 ↔ 평가 분리** — 산출물(코드/리포트)을 만든 주체가 스스로 합격 판정하지 않는다.
  독립 Evaluator/Critic이 채점하고, 임계 미달이면 보정 루프를 돈다.
- **상태파일 체인** — 작업 산출물은 `spec → plan → draft → qa_report → final` 순서로 남긴다.
  임시 산출물은 `scratch/`에 둔다(gitignore됨).
- **6부품** — 오토메이션 / 스킬(`SKILL.md`) / 커넥터(MCP) / 서브에이전트 / 상태파일 / Critic.
  코드 인덱싱은 `code-index` MCP(로컬 `.mcp.json`, gitignore됨)를 쓴다.

## PR 규칙

- **1 PR = 1 의도.** 문서 / UI / DB(마이그레이션) / 테스트를 한 PR에 섞지 않는다.
- PR은 작게 유지한다. 큰 변경은 점진적 작은 PR로 쪼갠다.
- `main`에서 바로 작업하지 않는다. 의도별 브랜치를 판다.
- PRD는 살아있는 문서다. 동작이 바뀌면 같은 흐름에서 PRD/문서를 갱신한다.

## 핵심 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 타입체크 + 빌드 — 변경 후 반드시 통과 확인
npm run lint     # ESLint
npx playwright test   # E2E (e2e/)
```

## 안전 규칙

- API 키는 **서버 전용**. `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 클라이언트에 절대 노출 금지.
- 모든 민감 작업은 API Route(`src/app/api/*`)에서. Supabase RLS 정책을 신뢰한다.
- 커밋 메시지: `feat:`/`fix:`/`docs:`/`chore:` + 한 줄 의도.

---
**Last Updated:** 2026-06-30 · **Stack:** Next.js 16 + Supabase + Vercel
