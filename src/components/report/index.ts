/**
 * Report Components
 *
 * 리포트 관련 공통 컴포넌트 export
 */

export { default as MetaHeader } from './MetaHeader';
export { default as VisionFooter } from './VisionFooter';
export { default as GrowthTrajectoryChart } from './GrowthTrajectoryChart';
export { default as ErrorPatternTrend } from './ErrorPatternTrend';
export {
  default as GrowthLoopIndicator,
  BaselineReferenceCard,
  VisionDistanceFooter,
} from './GrowthLoopIndicator';

// Phase 1 확장 컴포넌트
export { default as HabitTrendChart } from './HabitTrendChart';
export { default as MomentumGauge, MomentumBadge } from './MomentumGauge';

// Phase 2 확장 컴포넌트
export { default as MonthlyRadarChart, buildRadarData } from './GrowthRadarChart';
export { default as WeaknessResolutionMap, buildWeaknessItems } from './WeaknessResolutionMap';

// Phase 3 확장 컴포넌트 (Macro Loop)
export { default as TrajectoryAreaChart } from './TrajectoryAreaChart';
export type { TrajectoryPoint } from './TrajectoryAreaChart';
export { default as MetaProfileComparison, buildMetaProfileMetrics } from './MetaProfileComparison';
export type { MetricChange } from './MetaProfileComparison';
export { default as AnnualGrowthStory } from './AnnualGrowthStory';
export type { GrowthStoryData } from './AnnualGrowthStory';

// Phase 5: CRM 컴포넌트
export { default as ReportComments } from './ReportComments';

