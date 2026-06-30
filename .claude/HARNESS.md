# 개발 워크플로 하네스 (Loop Engineering)

이 프로젝트의 작업은 **루프 엔지니어링 하네스** 위에서 진행한다.
핵심 원칙은 루트 [`../CLAUDE.md`](../CLAUDE.md)에 있고, 이 문서는 그 운영 메커니즘을 정의한다.

## 핵심 원칙: 생성 ↔ 평가 분리

만드는 주체와 평가하는 주체를 **반드시 분리한다.** 동일 계열 모델의 자가평가는
self-bias가 있어(자기채점 ↑ vs 독립평가 ↓) 신뢰할 수 없다.

- **Maker** = 메인 세션. 코드/리포트/문서를 생성한다. **스스로 합격 판정하지 않는다.**
- **Critic** = 독립 서브에이전트([`agents/critic.md`](agents/critic.md)). draft를 채점하고 결함을 보고한다.
- Maker는 Critic의 `qa_report`가 임계(기본 7/10)를 넘을 때까지 **보정 루프**를 돈다.

## 6부품 매핑

| 부품 | 이 프로젝트에서 |
|------|----------------|
| 오토메이션 | 빌드/E2E (`npm run build`, `npx playwright test`), 향후 cron/heartbeat |
| 스킬 | [`skills/*/SKILL.md`](skills/) — 파이프라인 지식 코드화 |
| 커넥터(MCP) | `code-index`(코드 인덱싱), `Sentry`(에러). 설정: [`../.mcp.json.example`](../.mcp.json.example) |
| 서브에이전트 | [`agents/critic.md`](agents/critic.md) — 독립 평가자 |
| 상태파일 체인 | 아래 참조 |
| Critic | 최종 합격 판정 |

## 상태파일 체인

작업 산출물은 다음 순서로 남긴다. 임시 파일은 `scratch/`(gitignore됨)에 둔다.

```
spec  →  plan  →  draft  →  qa_report  →  final
```

- `spec` — 무엇을/왜 (요구사항, 수용 기준)
- `plan` — 어떻게 (단계, 건드릴 파일)
- `draft` — 1차 산출물 (Maker)
- `qa_report` — 독립 채점 결과 (Critic)
- `final` — 합격 후 확정본

## PR 규율

- **1 PR = 1 의도.** 문서 / UI / DB(마이그레이션) / 테스트를 한 PR에 섞지 않는다.
- 큰 변경은 점진적 작은 PR로 쪼갠다. `main`에서 직접 작업하지 않는다.
- 분리 판단 기준은 [`skills/report-harness/SKILL.md`](skills/report-harness/SKILL.md) 참고.

## 레거시 정리 방침

- `.codex/`(config.toml, hooks)는 직전 Codex 작업 잔재다. 동작에 영향이 없으면 두되,
  **별도 PR**에서 제거를 검토한다(이 PR에 섞지 않는다).
