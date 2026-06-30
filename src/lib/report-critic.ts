/**
 * Report Critic Loop (Loop Engineering 하네스 — 앱 층위)
 *
 * "만드는 AI ↔ 평가하는 AI 분리" 원칙을 리포트 생성에 적용한다.
 * 이 파일은 **순수 오케스트레이터**다: AI 호출은 주입된 클로저(evaluate/regenerate)로만
 * 수행하므로 AI 없이 단위 테스트할 수 있다. (생성 로직은 gemini.ts가 담당)
 *
 * self-bias 주의: 생성·평가가 같은 모델 계열이면 자가평가 편향이 생긴다.
 * 평가자는 생성자와 다른 모델 tier + 독립 루브릭을 써서 상관을 줄인다(gemini.ts 참조).
 */
import type { AnalysisData } from '@/types';

export type QaSeverity = 'critical' | 'major' | 'minor';

export interface QaIssue {
  severity: QaSeverity;
  area: string;   // 예: '실행가능성', '논리 일관성'
  detail: string; // 구체적 결함 + 권장 조치
}

export interface QaReport {
  score: number;                       // 0-10
  verdict: 'PASS' | 'NEEDS_REVISION';
  issues: QaIssue[];
  selfBiasNote: string;                // self-bias 경고(평가자가 강제 부착)
}

export interface CriticLoopOptions {
  /** 1차 생성 결과(Maker 산출물) */
  draft: AnalysisData;
  /** 독립 평가자 — draft를 채점한다 */
  evaluate: (draft: AnalysisData) => Promise<QaReport>;
  /** 보정 생성 — Critic 피드백을 받아 다시 생성한다 */
  regenerate: (feedback: string) => Promise<AnalysisData>;
  /** 합격 임계 점수(기본 7) */
  threshold?: number;
  /** 최대 보정 횟수(기본 1) */
  maxRevisions?: number;
}

export interface CriticLoopResult {
  /** 최종 채택된 분석(best-of: 가장 높은 점수본) */
  analysis: AnalysisData;
  /** 최종 채택본의 평가 리포트 */
  finalReport: QaReport;
  /** 실제 수행한 보정 횟수 */
  revisions: number;
  /** 모든 평가 리포트(관측용) */
  reports: QaReport[];
}

/** QaReport의 결함을 보정 프롬프트용 텍스트로 변환 */
export function formatCriticFeedback(report: QaReport): string {
  if (report.issues.length === 0) {
    return `종합 점수 ${report.score}/10. 전반적인 깊이와 구체성을 높이세요.`;
  }
  const lines = report.issues
    .map((issue, i) => `${i + 1}. [${issue.severity}] (${issue.area}) ${issue.detail}`)
    .join('\n');
  return `종합 점수 ${report.score}/10. 아래 결함을 보정하세요:\n${lines}`;
}

/**
 * 생성 → 독립 평가 → (임계 미달 시) 1회 보정 루프.
 *
 * - draft를 평가한다.
 * - PASS이거나 임계 이상이면 즉시 반환.
 * - NEEDS_REVISION이고 임계 미달이면 보정 생성 후 재평가한다.
 * - best-of: 보정본 점수가 원본보다 높을 때만 채택. 개선이 없으면 원본을 유지하고 중단.
 *
 * evaluate/regenerate가 throw하면 호출자(라우트)가 잡아 원본으로 폴백한다.
 */
export async function applyCriticLoop(options: CriticLoopOptions): Promise<CriticLoopResult> {
  const threshold = options.threshold ?? 7;
  const maxRevisions = options.maxRevisions ?? 1;

  let bestAnalysis = options.draft;
  let bestReport = await options.evaluate(bestAnalysis);
  const reports: QaReport[] = [bestReport];
  let revisions = 0;

  while (
    bestReport.verdict === 'NEEDS_REVISION' &&
    bestReport.score < threshold &&
    revisions < maxRevisions
  ) {
    revisions += 1;
    const feedback = formatCriticFeedback(bestReport);
    const revised = await options.regenerate(feedback);
    const revisedReport = await options.evaluate(revised);
    reports.push(revisedReport);

    // best-of: 보정이 실제로 개선했을 때만 채택. 아니면 원본 유지하고 중단.
    if (revisedReport.score > bestReport.score) {
      bestAnalysis = revised;
      bestReport = revisedReport;
    } else {
      break;
    }
  }

  return { analysis: bestAnalysis, finalReport: bestReport, revisions, reports };
}
