/**
 * Premium Report Components
 *
 * 프리미엄 리포트 고도화를 위한 컴포넌트 모음
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md
 *
 * 핵심 원칙:
 * 1. 신뢰의 시각화 (Evidence-Based Trust)
 * 2. 서사의 연결 (Narrative Continuity)
 * 3. 학부모의 행동 유도 (Actionable Parenting)
 */

// Hero & Header Components
export { default as ReportGrowthHero } from './ReportGrowthHero';

// Trust & Evidence Components
export { default as EvidenceBadge, InlineEvidenceBadge } from './EvidenceBadge';
export {
  default as ConfidenceBadge,
  MiniConfidenceBadge,
  getConfidenceLevel,
} from './ConfidenceBadge';

// Growth & Projection Components
export { default as GrowthProjectionChart } from './GrowthProjectionChart';

// Action & Engagement Components
export { default as HomeActionCard } from './HomeActionCard';

// Journey & Progress Components
export { default as WeaknessJourneyMap, toJourneyStatus } from './WeaknessJourneyMap';

// Analysis Components
export { default as FivePerspectiveAnalysis } from './FivePerspectiveAnalysis';
export { default as ErrorSignatureTracker } from './ErrorSignatureTracker';

// Export Components
export { default as ReportPDFExporter, usePDFExport } from './ReportPDFExporter';

// Type Exports
export type { default as EvidenceType } from './EvidenceBadge';
export type { default as ConfidenceLevel } from './ConfidenceBadge';
