export type UserRole = 'teacher' | 'parent' | 'student';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export interface Student {
  id: number;
  student_id: string;
  name: string;
  grade: number;
  school?: string;
  start_date?: string;
  parent_id?: string;
  learning_style?: 'visual' | 'verbal' | 'logical';
  personality_traits?: string[];
  // 학생 메타프로필 (JSONB)
  meta_profile?: StudentMetaProfile | null;
  created_at: string;
}

export type StudentInput = Omit<Student, 'id' | 'created_at'>;
// 6대 리포트 타입 (확장된 버전)
export type ReportType =
  | 'level_test'     // 진단/레벨 테스트 (신규 등록 시)
  | 'test'           // 일반 시험 분석
  | 'weekly'         // 주간 리포트
  | 'monthly'        // 월간 리포트
  | 'semi_annual'    // 반기 리포트
  | 'annual'         // 연간 리포트
  | 'consolidated';  // 레거시: 통합 리포트 (deprecated)

export interface TestInfo {
  testName: string;
  studentName: string;
  testDate: string;
  testRange: string;
  difficulty: string;
  totalQuestions: number;
  questionsByPoint: { points: string; count: number }[];
  percentageByPoint: { name: string; value: number }[];
}

export interface TestResults {
  totalScore: number;
  maxScore: number;
  rank: number;
  totalStudents: number;
  correctRateByPoint: { name: string; value: number; total: number }[];
}

export interface DetailedProblemAnalysis {
  problemNumber: string;
  keyConcept: string;
  isCorrect: 'O' | 'X' | '△' | '-';
  errorType: '개념 오류' | '절차 오류' | '계산 오류' | '문제 오독' | '기타/부주의' | 'N/A';
  solutionStrategy: '최적 풀이' | '차선 풀이' | '창의적 접근' | 'N/A';
  analysis: string;
}

export interface ResultAnalysis {
  scoreComparison: {
    studentTotal: number;
    averageTotal: number;
    byPoint: { points: string; studentScore: number; averageScore: number }[];
  };
  attemptAnalysisByRank: { rankGroup: string; attemptSuccessRate: number }[];
  gradeTrend: { date: string; score: number }[];
  performanceTrend: { date: string; problemsSolvedInTime: number; solveSuccessRate: number }[];
}

export interface MacroAnalysis {
  summary: string;
  oneLineSummary?: string;
  analysisKeyword?: string;
  analysisMessage?: string;
  strengths: string;
  weaknesses: string;
  errorPattern: string;
  futureVision?: {
    threeMonths: string;
    sixMonths: string;
    longTerm: string;
    encouragement: string;
  };
  weaknessFlow?: {
    step1: { title: string; description: string };
    step2: { title: string; description: string };
    step3: { title: string; description: string };
  };
  mathCapability?: {
    calculationSpeed: number;
    calculationAccuracy: number;
    applicationAbility: number;
    logic: number;
    anxietyControl: number;
  };
}

export interface ActionablePrescriptionItem {
  priority: number;
  type: '개념 교정' | '습관 교정' | '전략 개선';
  title: string;
  description: string;
  whatToDo: string;
  where: string;
  howMuch: string;
  howTo: string;
  measurementMethod: string;
  expectedEffect?: string;
}

export interface SwotData {
  strength: string;
  weakness: string;
  opportunity: string;
  threat: string;
}

export interface LearningHabit {
  type: 'good' | 'bad';
  description: string;
  frequency: 'always' | 'often' | 'sometimes';
}

export interface RiskFactor {
  factor: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface GrowthPrediction {
  timeframe: '1개월' | '3개월' | '6개월' | '1년';
  predictedScore: number;
  confidenceLevel: number;
  assumptions: string[];
}

/**
 * TestAnalysisData - 시험 분석 리포트 데이터 (기본 형태)
 * report_type: 'test' 또는 'level_test'에 사용
 */
export interface TestAnalysisData {
  testInfo: TestInfo;
  testResults: TestResults;
  resultAnalysis: ResultAnalysis;
  detailedAnalysis: DetailedProblemAnalysis[];
  macroAnalysis: MacroAnalysis;
  swotAnalysis?: SwotData;
  actionablePrescription: ActionablePrescriptionItem[];
  learningHabits?: LearningHabit[];
  riskFactors?: RiskFactor[];
  growthPredictions?: GrowthPrediction[];
  trendComment?: string;
}

/**
 * AnalysisData - 레거시 호환용 (TestAnalysisData와 동일)
 * @deprecated 새 코드에서는 AnyAnalysisData 또는 구체적 타입 사용 권장
 */
export interface AnalysisData extends TestAnalysisData {}

/**
 * AnyAnalysisData - 모든 리포트 타입의 분석 데이터 Union
 * 타입 가드를 사용하여 구체적인 타입으로 좁힐 수 있음
 */
export type AnyAnalysisData =
  | ({ _type: 'level_test' } & LevelTestAnalysis)
  | ({ _type: 'test' } & TestAnalysisData)
  | ({ _type: 'weekly' } & WeeklyReportAnalysis)
  | ({ _type: 'monthly' } & MonthlyReportAnalysis)
  | ({ _type: 'semi_annual' } & SemiAnnualReportAnalysis)
  | ({ _type: 'annual' } & AnnualReportAnalysis)
  | ({ _type?: undefined } & TestAnalysisData); // 레거시 데이터 호환

/**
 * 타입 가드 함수들
 */
export function isLevelTestAnalysis(data: AnyAnalysisData): data is { _type: 'level_test' } & LevelTestAnalysis {
  return '_type' in data && data._type === 'level_test';
}

export function isWeeklyAnalysis(data: AnyAnalysisData): data is { _type: 'weekly' } & WeeklyReportAnalysis {
  return '_type' in data && data._type === 'weekly';
}

export function isMonthlyAnalysis(data: AnyAnalysisData): data is { _type: 'monthly' } & MonthlyReportAnalysis {
  return '_type' in data && data._type === 'monthly';
}

export function isSemiAnnualAnalysis(data: AnyAnalysisData): data is { _type: 'semi_annual' } & SemiAnnualReportAnalysis {
  return '_type' in data && data._type === 'semi_annual';
}

export function isAnnualAnalysis(data: AnyAnalysisData): data is { _type: 'annual' } & AnnualReportAnalysis {
  return '_type' in data && data._type === 'annual';
}

export interface Report {
  id: number;
  student_id: number;
  report_type: ReportType;
  test_name?: string;
  test_date?: string;
  total_score?: number;
  max_score?: number;
  rank?: number;
  total_students?: number;
  // analysis_data는 report_type에 따라 다른 구조를 가짐
  // 레거시 호환성을 위해 AnalysisData | AnyAnalysisData 사용
  analysis_data: AnalysisData | AnyAnalysisData;
  created_at: string;
}

export type ReportInput = Omit<Report, 'id' | 'created_at'>;

export interface WeeklyReportData {
  id?: number;
  period: string;
  studentName: string;
  studentGrade: string;
  learningDates: string[];
  teacherNotes: string;
  keywords: string[];
  learningContent: { topic: string; evaluation: 'excellent' | 'good' | 'not_good' }[];
  analysis: {
    totalProblems: number;
    correctProblems: number;
    topicUnderstanding: { topic: string; understanding: number }[];
  };
  achievements: string[];
  improvements: string[];
  reviewProblems: { source: string; page: string; number: string }[];
  nextWeekPlan: { goal: string; plan: string }[];
  teacherComment: string;
}

export interface MonthlyReportData {
  id?: number;
  period: string;
  studentName: string;
  announcements: string;
  cost: string;
  schedule: { year: number; month: number };
  classDates: string[];
  classNotes: string;
  textbookCompletion: { percentage: number; description: string };
  learningContent: { topic: string; evaluation: 'excellent' | 'good' | 'not_good' }[];
  whatWentWell: string[];
  needsImprovement: string[];
  reviewProblems: { source: string; page: string; number: string; concept: string }[];
  nextMonthGoals: string[];
  performanceSummary: string;
  improvementPlan: string;
  messageToParents: string;
}

export interface ConsolidatedReportData {
  reports: [Report, Report];
  allReportsForStudent: Report[];
  consolidatedQualitative: {
    macroAnalysis: MacroAnalysis;
    actionablePrescription: ActionablePrescriptionItem[];
    growthPredictions?: GrowthPrediction[];
  };
}

export interface TestAnalysisFormData {
  testName: string;
  testDate: string;
  testRange: string;
  totalQuestions: number;
  maxScore: number;
  points2: number;      // 2점 배점 문항 수
  points3: number;
  points4: number;
  points5: number;
  points6: number;
  pointsEssay: number;  // 서술형 배점 문항 수
  difficulty?: string;
  questionsByPoint?: { points: string; count: number }[];
  totalScore?: number;
  rank?: number;
  totalStudents?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnalyzeApiRequest {
  studentName: string;
  formData: TestAnalysisFormData;
  currentImages: string[];
  pastImages?: string[];
  // 성장 컨텍스트 주입을 위한 추가 필드
  studentId?: number;
  reportType?: ReportType;
}

export interface AnalyzeApiResponse {
  success: boolean;
  analysisData?: AnalysisData;
  error?: string;
}

// ============================================
// 수업 관리 시스템 타입 정의
// ============================================

// 수업 일정 (정기 스케줄)
export interface Schedule {
  id: number;
  student_id: number;
  day_of_week: number; // 0=일, 1=월, ..., 6=토
  start_time: string; // "HH:MM:SS"
  end_time?: string;
  is_active: boolean;
  created_at: string;
  // JOIN 결과
  students?: Student;
}

export type ScheduleInput = Omit<Schedule, 'id' | 'created_at' | 'students'>;

// 일정 예외 (휴강/보강)
export type ScheduleExceptionType = 'cancel' | 'makeup' | 'holiday';

export interface ScheduleException {
  id: number;
  student_id: number;
  exception_date: string;
  exception_type: ScheduleExceptionType;
  original_time?: string;
  new_time?: string;
  note?: string;
  created_at: string;
}

export type ScheduleExceptionInput = Omit<ScheduleException, 'id' | 'created_at'>;

// 커리큘럼 단원
export interface CurriculumUnit {
  id: number;
  grade: number;
  semester?: number;
  unit_order: number;
  unit_name: string;
  chapter_name?: string;
  key_concepts?: string[];
  estimated_hours?: number;
  created_at: string;
}

export type CurriculumUnitInput = Omit<CurriculumUnit, 'id' | 'created_at'>;

// 학생별 진도
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface StudentProgress {
  id: number;
  student_id: number;
  curriculum_unit_id: number;
  status: ProgressStatus;
  completion_percentage: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  // JOIN 결과
  curriculum_units?: CurriculumUnit;
}

export type StudentProgressInput = Omit<StudentProgress, 'id' | 'created_at' | 'curriculum_units'>;

// 수업 기록
export interface ClassSession {
  id: number;
  student_id: number;
  session_date: string;
  start_time?: string;
  end_time?: string;
  curriculum_unit_id?: number;
  learning_keywords?: string[];
  covered_concepts?: string[];
  summary?: string;
  understanding_level?: number; // 1-5
  attention_level?: number; // 1-5
  notes?: string;
  created_at: string;
  // JOIN 결과
  students?: Student;
  curriculum_units?: CurriculumUnit;
}

export type ClassSessionInput = Omit<ClassSession, 'id' | 'created_at' | 'students' | 'curriculum_units'>;

// 숙제
export type AssignmentType = 'workbook' | 'review' | 'practice' | 'preview';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

export interface Assignment {
  id: number;
  student_id: number;
  class_session_id?: number;
  assignment_type?: AssignmentType;
  title: string;
  description?: string;
  source?: string;
  page_range?: string;
  problem_numbers?: string;
  due_date?: string;
  status: AssignmentStatus;
  completed_at?: string;
  completion_note?: string;
  created_at: string;
  // JOIN 결과
  students?: Student;
  class_sessions?: ClassSession;
}

export type AssignmentInput = Omit<Assignment, 'id' | 'created_at' | 'students' | 'class_sessions'>;

// ============================================
// 학생 전역 속성 타입 정의
// ============================================

// 취약점 카테고리
export type WeaknessCategory = 'calculation' | 'concept' | 'application' | 'reading' | 'habit';
export type WeaknessStatus = 'active' | 'improving' | 'resolved' | 'recurring';

export interface StudentWeakness {
  id: number;
  student_id: number;
  concept: string;
  category?: WeaknessCategory;
  severity: number; // 1-5
  status: WeaknessStatus;
  occurrence_count: number;
  first_detected_at: string;
  first_detected_report_id?: number;
  last_detected_at: string;
  last_detected_report_id?: number;
  resolved_at?: string;
  resolved_report_id?: number;
  recurred_at?: string;
  related_report_ids?: number[];
  teacher_note?: string;
  is_manually_added: boolean;
  created_at: string;
  updated_at: string;
}

export type StudentWeaknessInput = Omit<StudentWeakness, 'id' | 'created_at' | 'updated_at'>;

// 강점 카테고리
export type StrengthCategory = 'calculation' | 'concept' | 'application' | 'reading' | 'creativity';
export type StrengthStatus = 'active' | 'declining' | 'inactive';

export interface StudentStrength {
  id: number;
  student_id: number;
  concept: string;
  category?: StrengthCategory;
  level: number; // 1-5
  status: StrengthStatus;
  confirmation_count: number;
  first_detected_at: string;
  first_detected_report_id?: number;
  last_confirmed_at: string;
  last_confirmed_report_id?: number;
  related_report_ids?: number[];
  teacher_note?: string;
  is_manually_added: boolean;
  created_at: string;
  updated_at: string;
}

export type StudentStrengthInput = Omit<StudentStrength, 'id' | 'created_at' | 'updated_at'>;

// 풀이 패턴
export type PatternType = 'solving' | 'error' | 'habit' | 'time_management';
export type PatternFrequency = 'always' | 'often' | 'sometimes' | 'rarely';
export type PatternStatus = 'active' | 'improving' | 'resolved';

export interface StudentPattern {
  id: number;
  student_id: number;
  pattern_type: PatternType;
  description: string;
  is_positive: boolean;
  frequency: PatternFrequency;
  status: PatternStatus;
  occurrence_count: number;
  first_detected_at: string;
  last_detected_at: string;
  related_report_ids?: number[];
  teacher_note?: string;
  improvement_plan?: string;
  created_at: string;
  updated_at: string;
}

export type StudentPatternInput = Omit<StudentPattern, 'id' | 'created_at' | 'updated_at'>;

// 전역 속성 변경 이력
export type ProfileChangeType =
  | 'weakness_added'
  | 'weakness_resolved'
  | 'weakness_recurred'
  | 'weakness_updated'
  | 'strength_added'
  | 'strength_updated'
  | 'pattern_added'
  | 'pattern_changed';

export type ProfileAttributeType = 'weakness' | 'strength' | 'pattern';

export interface StudentProfileHistory {
  id: number;
  student_id: number;
  report_id?: number;
  change_type: ProfileChangeType;
  attribute_type: ProfileAttributeType;
  attribute_id?: number;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  changed_by: 'ai' | 'teacher';
  teacher_approved: boolean;
  note?: string;
  created_at: string;
}

// ============================================
// 대시보드용 복합 타입
// ============================================

// 오늘 수업 학생 정보 (대시보드 표시용)
export interface TodayClassStudent {
  student: Student;
  schedule: Schedule;
  // 진도 정보
  currentProgress?: {
    unit_name: string;
    completion_percentage: number;
  };
  // 최근 수업 키워드
  recentKeywords?: string[];
  // 숙제 상태
  pendingAssignments?: {
    total: number;
    completed: number;
    overdue: number;
  };
  // 주요 취약점 (active/recurring 상태)
  activeWeaknesses?: Pick<StudentWeakness, 'concept' | 'severity' | 'status'>[];
  // 최근 리포트 점수
  recentScore?: {
    score: number;
    max_score: number;
    trend: 'up' | 'down' | 'stable';
  };
}

// ============================================
// 학생 메타 프로필 (5대 핵심 지표)
// ============================================

/**
 * ErrorSignature - 오류 서명
 * 학생의 고유한 오류 패턴을 식별하는 지표
 */
export interface ErrorSignature {
  // 주요 오류 유형과 빈도
  primaryErrorTypes: {
    type: '개념 오류' | '절차 오류' | '계산 오류' | '문제 오독' | '기타/부주의';
    frequency: number; // 0-100 (백분율)
    recentTrend: 'increasing' | 'decreasing' | 'stable';
  }[];
  // 특징적 오류 패턴 (자연어 설명)
  signaturePatterns: string[];
  // 영역별 취약도 맵
  domainVulnerability: {
    domain: string; // e.g., "분수 계산", "방정식", "도형"
    vulnerabilityScore: number; // 0-100 (높을수록 취약)
    lastAssessed: string; // ISO date
  }[];
  // 마지막 업데이트 시점
  lastUpdated: string;
}

/**
 * AbsorptionRate - 흡수율
 * 새로운 개념을 학습하고 적용하는 속도
 */
export interface AbsorptionRate {
  // 전체 흡수율 점수
  overallScore: number; // 0-100
  // 영역별 흡수율
  byDomain: {
    domain: string;
    score: number;
    assessmentCount: number;
  }[];
  // 흡수 패턴 유형
  learningType: 'fast-starter' | 'steady-grower' | 'slow-but-deep' | 'inconsistent';
  // 최적 학습 조건
  optimalConditions: string[];
  // 최근 3개월 트렌드
  recentTrend: {
    month: string;
    score: number;
  }[];
  lastUpdated: string;
}

/**
 * SolvingStamina - 문제풀이 지구력
 * 장시간 집중력과 문제풀이 지속 능력
 */
export interface SolvingStamina {
  // 전체 지구력 점수
  overallScore: number; // 0-100
  // 최적 집중 시간대 (분 단위)
  optimalDuration: number;
  // 문제 수별 정확도 변화
  accuracyBySequence: {
    problemRange: string; // e.g., "1-5", "6-10", "11-15"
    accuracy: number; // 0-100
  }[];
  // 피로도 패턴
  fatiguePattern: 'early-fatigue' | 'mid-dip' | 'late-fatigue' | 'consistent';
  // 회복 전략 효과성
  recoveryStrategies: {
    strategy: string;
    effectiveness: 'high' | 'medium' | 'low';
  }[];
  lastUpdated: string;
}

/**
 * MetaCognitionLevel - 메타인지 수준
 * 자신의 학습 상태를 인지하고 조절하는 능력
 */
export interface MetaCognitionLevel {
  // 전체 메타인지 점수
  overallScore: number; // 0-100
  // 세부 영역별 점수
  subScores: {
    // 자기 평가 정확도 (예측 점수 vs 실제 점수)
    selfAssessmentAccuracy: number;
    // 오답 인식 능력 (틀린 문제 자각 정도)
    errorRecognition: number;
    // 전략 선택 능력 (상황에 맞는 풀이법 선택)
    strategySelection: number;
    // 시간 관리 능력
    timeManagement: number;
  };
  // 메타인지 발달 단계
  developmentStage: 'beginner' | 'developing' | 'competent' | 'proficient' | 'expert';
  // 개선 영역
  improvementAreas: string[];
  lastUpdated: string;
}

/**
 * Baseline - 기준점 데이터
 * 최초 진단 시점의 학습 상태 스냅샷
 */
export interface Baseline {
  // 최초 진단 일자
  assessmentDate: string;
  // 진단 시험 ID (level_test report)
  levelTestReportId?: number;
  // 초기 학력 수준 (학년 기준)
  initialLevel: {
    grade: number; // 해당 학년
    percentile: number; // 백분위
    evaluatedAt: string;
  };
  // 영역별 초기 점수
  domainScores: {
    domain: string;
    score: number;
    maxScore: number;
    percentile: number;
  }[];
  // 초기 강점/약점 요약
  initialStrengths: string[];
  initialWeaknesses: string[];
  // 초기 학습 성향
  initialLearningStyle: 'visual' | 'verbal' | 'logical' | 'mixed';
}

/**
 * StudentMetaProfile - 학생 메타 프로필
 * 학생의 5대 핵심 학습 지표를 종합한 프로필
 */
export interface StudentMetaProfile {
  // 기준점 (최초 진단 데이터)
  baseline: Baseline;
  // 오류 서명 (고유 오류 패턴)
  errorSignature: ErrorSignature;
  // 흡수율 (학습 속도)
  absorptionRate: AbsorptionRate;
  // 문제풀이 지구력
  solvingStamina: SolvingStamina;
  // 메타인지 수준
  metaCognitionLevel: MetaCognitionLevel;
  // 마지막 업데이트 (any indicator)
  lastUpdated: string;
  // 프로필 버전 (스키마 변경 추적용)
  version: string;
}

// ============================================
// 6대 리포트 분석 타입 정의
// ============================================

/**
 * GrowthComparison - 성장 비교 데이터
 * 이전 리포트와의 비교 분석
 */
export interface GrowthComparison {
  // 비교 대상 리포트
  comparedTo: {
    reportId: number;
    reportType: ReportType;
    reportDate: string;
  };
  // 점수 변화
  scoreChange: {
    previous: number;
    current: number;
    delta: number;
    percentageChange: number;
  };
  // 개선된 영역
  improvedAreas: {
    area: string;
    previousScore: number;
    currentScore: number;
    improvement: number;
  }[];
  // 퇴보한 영역
  declinedAreas: {
    area: string;
    previousScore: number;
    currentScore: number;
    decline: number;
  }[];
  // 해결된 취약점
  resolvedWeaknesses: string[];
  // 새로 발견된 취약점
  newWeaknesses: string[];
  // 성장 요약
  growthSummary: string;
}

/**
 * FutureVisionExtended - 확장된 미래 비전
 * 단기/중기/장기 예측 및 격려 메시지
 */
export interface FutureVisionExtended {
  // 단기 비전 (1개월)
  shortTerm: {
    timeframe: '1개월';
    goals: string[];
    predictedScore?: number;
    confidenceLevel: number;
    milestones: string[];
  };
  // 중기 비전 (3개월)
  midTerm: {
    timeframe: '3개월';
    goals: string[];
    predictedScore?: number;
    confidenceLevel: number;
    milestones: string[];
  };
  // 장기 비전 (6개월~1년)
  longTerm: {
    timeframe: '6개월' | '1년';
    goals: string[];
    predictedScore?: number;
    confidenceLevel: number;
    milestones: string[];
  };
  // 성장 경로 서사
  growthNarrative: string;
  // 맞춤 격려 메시지
  encouragementMessage: string;
}

/**
 * LevelTestAnalysis - 진단/레벨 테스트 분석
 * 신규 학생 등록 시 최초 진단 리포트
 */
export interface LevelTestAnalysis {
  // 기본 테스트 정보
  testInfo: TestInfo;
  testResults: TestResults;
  // 영역별 진단 결과
  domainDiagnosis: {
    domain: string;
    score: number;
    maxScore: number;
    percentile: number;
    gradeEquivalent: string; // e.g., "중1 수준", "초6 상위"
    diagnosis: string;
  }[];
  // 학년 수준 평가
  gradeLevelAssessment: {
    currentGrade: number;
    assessedLevel: number;
    gap: number; // 양수: 앞서있음, 음수: 뒤처짐
    explanation: string;
  };
  // 선수학습 결손 분석
  prerequisiteGaps: {
    concept: string;
    expectedLevel: string;
    actualLevel: string;
    priority: 'critical' | 'important' | 'minor';
    remedyPlan: string;
  }[];
  // 초기 학습 성향 진단
  learningStyleDiagnosis: {
    style: 'visual' | 'verbal' | 'logical' | 'mixed';
    confidence: number;
    characteristics: string[];
    recommendations: string[];
  };
  // 초기 Baseline 설정
  initialBaseline: Baseline;
  // 맞춤 커리큘럼 제안
  suggestedCurriculum: {
    phase: string;
    duration: string;
    focus: string;
    goals: string[];
  }[];
  // 부모님께 전달할 메시지
  parentBriefing: string;
}

/**
 * TestReportAnalysis - 일반 시험 분석
 * 기존 AnalysisData를 확장한 시험 분석
 */
export interface TestReportAnalysis extends AnalysisData {
  // 메타프로필 기반 분석
  metaProfileAnalysis?: {
    // 오류 서명 매칭
    errorSignatureMatch: {
      matchedPatterns: string[];
      newPatterns: string[];
      resolvedPatterns: string[];
    };
    // 흡수율 평가
    absorptionAssessment: {
      newConceptsIntroduced: string[];
      absorptionRate: number;
      comparison: string;
    };
    // 지구력 분석
    staminaAssessment: {
      problemSequenceAnalysis: string;
      fatigueIndicators: string[];
    };
    // 메타인지 분석
    metaCognitionAssessment: {
      selfAwarenessIndicators: string[];
      strategyUseAnalysis: string;
    };
  };
  // 성장 비교 (이전 시험 대비)
  growthComparison?: GrowthComparison;
  // 미래 비전
  futureVision?: FutureVisionExtended;
}

/**
 * WeeklyReportAnalysis - 주간 리포트 분석
 * 주간 학습 피드백 및 마이크로 루프
 */
export interface WeeklyReportAnalysis {
  // 기본 정보
  period: string;
  weekNumber: number;
  studentName: string;
  studentGrade: string;
  // 수업 정보
  classSessions: {
    date: string;
    duration: number;
    keywords: string[];
    understandingLevel: number;
    attentionLevel: number;
  }[];
  // 학습 내용 평가
  learningContent: {
    topic: string;
    evaluation: 'excellent' | 'good' | 'not_good';
    details: string;
  }[];
  // 숙제 완료율
  assignmentCompletion: {
    total: number;
    completed: number;
    rate: number;
    quality: 'excellent' | 'good' | 'needs_improvement';
  };
  // 주간 성취
  weeklyAchievements: string[];
  // 개선 필요 영역
  areasForImprovement: string[];
  // 복습 과제
  reviewAssignments: {
    source: string;
    page: string;
    number: string;
    concept: string;
    reason: string;
  }[];
  // 다음 주 계획
  nextWeekPlan: {
    focus: string;
    goals: string[];
    assignments: string[];
  };
  // 마이크로 루프 피드백
  microLoopFeedback: {
    // 지난주 목표 달성도
    lastWeekGoalAchievement: {
      goal: string;
      achieved: boolean;
      notes: string;
    }[];
    // 연속성 지표
    continuityScore: number;
    // 모멘텀 상태
    momentumStatus: 'accelerating' | 'maintaining' | 'slowing' | 'recovering';
  };
  // 간단한 격려 메시지
  encouragement: string;
  // 선생님 코멘트
  teacherComment: string;
}

/**
 * MonthlyReportAnalysis - 월간 리포트 분석
 * 월간 성장 종합 및 마이크로 루프 점검
 */
export interface MonthlyReportAnalysis {
  // 기본 정보
  period: string;
  month: { year: number; month: number };
  studentName: string;
  // 월간 수업 요약
  classSessionsSummary: {
    totalClasses: number;
    totalHours: number;
    attendanceRate: number;
    averageUnderstanding: number;
    averageAttention: number;
  };
  // 커리큘럼 진도
  curriculumProgress: {
    startUnit: string;
    endUnit: string;
    completionRate: number;
    paceAssessment: 'ahead' | 'on_track' | 'behind';
    paceAdjustmentNeeded: string;
  };
  // 학습 내용 종합
  learningContentSummary: {
    excellentTopics: string[];
    goodTopics: string[];
    challengingTopics: string[];
  };
  // 월간 시험 성적 (있는 경우)
  testPerformance?: {
    testCount: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  // 숙제 수행 종합
  assignmentSummary: {
    totalAssigned: number;
    completionRate: number;
    averageQuality: number;
    consistencyScore: number;
  };
  // 월간 성취
  monthlyAchievements: string[];
  // 해결된 취약점
  resolvedWeaknesses: string[];
  // 새로 발견된 이슈
  newChallenges: string[];
  // 부모님 보고 섹션
  parentReport: {
    highlights: string[];
    concerns: string[];
    recommendations: string[];
    costInfo?: string;
  };
  // 마이크로 루프 월간 점검
  microLoopMonthlyReview: {
    // 월간 목표 달성도
    monthlyGoalAchievement: number;
    // 주간 연속성 점수 평균
    weeklyConsistency: number;
    // 성장 모멘텀
    growthMomentum: 'accelerating' | 'maintaining' | 'slowing';
    // 조정 필요 여부
    adjustmentNeeded: boolean;
    adjustmentRecommendations: string[];
  };
  // 다음 달 계획
  nextMonthPlan: {
    mainGoals: string[];
    focusAreas: string[];
    expectedCoverage: string;
  };
  // 미래 비전 (1개월 단위)
  shortTermVision: {
    predictedProgress: string;
    keyMilestones: string[];
    potentialChallenges: string[];
  };
  // 선생님 종합 메시지
  teacherMessage: string;
}

/**
 * SemiAnnualReportAnalysis - 반기 리포트 분석
 * 6개월 성장 종합 및 매크로 루프
 */
export interface SemiAnnualReportAnalysis {
  // 기본 정보
  period: string;
  halfYear: '상반기' | '하반기';
  year: number;
  studentName: string;
  // 반기 요약 통계
  periodSummary: {
    totalClasses: number;
    totalHours: number;
    totalTests: number;
    averageScore: number;
    scoreImprovement: number;
  };
  // 성장 궤적 분석
  growthTrajectory: {
    startingPoint: {
      date: string;
      score: number;
      level: string;
    };
    currentPoint: {
      date: string;
      score: number;
      level: string;
    };
    growthCurve: {
      month: string;
      score: number;
      milestone?: string;
    }[];
    growthRate: number; // 백분율
    growthType: 'exponential' | 'linear' | 'plateau' | 'fluctuating';
  };
  // 메타프로필 변화 분석
  metaProfileEvolution: {
    errorSignatureChange: {
      resolvedPatterns: string[];
      persistentPatterns: string[];
      newPatterns: string[];
      overallTrend: 'improving' | 'stable' | 'concerning';
    };
    absorptionRateChange: {
      previous: number;
      current: number;
      trend: 'improving' | 'stable' | 'declining';
    };
    staminaChange: {
      previous: number;
      current: number;
      trend: 'improving' | 'stable' | 'declining';
    };
    metaCognitionChange: {
      previous: number;
      current: number;
      trend: 'improving' | 'stable' | 'declining';
    };
  };
  // 취약점 종합 점검
  weaknessReview: {
    startingWeaknesses: string[];
    resolved: string[];
    improved: string[];
    persistent: string[];
    new: string[];
    resolutionRate: number;
  };
  // 강점 발전 현황
  strengthDevelopment: {
    consolidatedStrengths: string[];
    emergingStrengths: string[];
    leveragedFor: string[];
  };
  // 매크로 루프 분석
  macroLoopAnalysis: {
    // 반기 목표 달성도
    goalAchievementRate: number;
    // 월간 리포트 기반 일관성
    monthlyConsistency: {
      month: string;
      score: number;
    }[];
    // 전체 학습 효율성
    learningEfficiency: number;
    // 전략적 조정 제안
    strategicAdjustments: {
      area: string;
      currentApproach: string;
      suggestedChange: string;
      expectedImpact: string;
    }[];
  };
  // 학년 수준 재평가
  levelReassessment: {
    previousLevel: string;
    currentLevel: string;
    gradeGrowth: number;
    comparisonToStandard: string;
  };
  // 다음 반기 전략
  nextHalfStrategy: {
    primaryGoals: string[];
    focusDomains: string[];
    targetScore: number;
    keyMilestones: {
      month: number;
      milestone: string;
    }[];
    riskMitigation: string[];
  };
  // 장기 비전 업데이트
  longTermVisionUpdate: {
    yearEndProjection: string;
    nextYearOutlook: string;
    potentialPaths: string[];
  };
  // 부모님 종합 보고
  parentComprehensiveReport: {
    executiveSummary: string;
    detailedAnalysis: string;
    investmentReturn: string;
    recommendations: string[];
  };
  // 선생님 반기 평가
  teacherAssessment: string;
}

/**
 * AnnualReportAnalysis - 연간 리포트 분석
 * 1년 성장 종합 및 다음 학년 준비
 */
export interface AnnualReportAnalysis {
  // 기본 정보
  year: number;
  studentName: string;
  startGrade: number;
  endGrade: number;
  // 연간 통계
  annualStatistics: {
    totalClasses: number;
    totalHours: number;
    totalTests: number;
    totalReports: number;
    averageScore: number;
    scoreImprovement: number;
    attendanceRate: number;
  };
  // 연간 성장 스토리
  growthStory: {
    beginningState: {
      date: string;
      description: string;
      keyMetrics: Record<string, number>;
    };
    majorMilestones: {
      date: string;
      milestone: string;
      significance: string;
    }[];
    turningPoints: {
      date: string;
      event: string;
      impact: string;
    }[];
    endingState: {
      date: string;
      description: string;
      keyMetrics: Record<string, number>;
    };
    narrativeSummary: string;
  };
  // Baseline 대비 성장
  baselineComparison: {
    initialBaseline: Baseline;
    currentMetrics: {
      domain: string;
      initial: number;
      current: number;
      growth: number;
      growthRate: number;
    }[];
    overallGrowthRate: number;
    growthCategory: 'exceptional' | 'excellent' | 'good' | 'steady' | 'needs_attention';
  };
  // 메타프로필 연간 진화
  metaProfileAnnualEvolution: {
    errorSignature: {
      yearStart: ErrorSignature;
      yearEnd: ErrorSignature;
      improvements: string[];
      persistentIssues: string[];
    };
    absorptionRate: {
      trend: { month: string; score: number }[];
      improvement: number;
      assessment: string;
    };
    solvingStamina: {
      trend: { month: string; score: number }[];
      improvement: number;
      assessment: string;
    };
    metaCognitionLevel: {
      trend: { month: string; score: number }[];
      improvement: number;
      assessment: string;
    };
  };
  // 취약점 최종 점검
  weaknessFinalReview: {
    yearStartWeaknesses: string[];
    resolvedThisYear: string[];
    stillActive: string[];
    newlyDeveloped: string[];
    priorityForNextYear: string[];
    overallResolutionRate: number;
  };
  // 강점 발전 종합
  strengthFinalReview: {
    consolidatedStrengths: string[];
    newStrengths: string[];
    leverageOpportunities: string[];
  };
  // 학년 성취도
  gradeAchievement: {
    expectedCurriculum: string[];
    actualCompleted: string[];
    completionRate: number;
    gradeLevel: '학년 초과' | '학년 적정' | '학년 미달';
    nextGradeReadiness: number;
  };
  // 매크로 루프 연간 종합
  annualMacroLoopSummary: {
    // 상/하반기 비교
    halfYearComparison: {
      firstHalf: { averageScore: number; growthRate: number };
      secondHalf: { averageScore: number; growthRate: number };
    };
    // 학습 효율성 추이
    efficiencyTrend: {
      quarter: string;
      efficiency: number;
    }[];
    // 전략 효과성 평가
    strategyEffectiveness: {
      strategy: string;
      implemented: boolean;
      effectiveness: 'high' | 'medium' | 'low';
      notes: string;
    }[];
    // 전체 학습 ROI
    learningROI: {
      timeInvested: number;
      improvementAchieved: number;
      efficiencyRating: string;
    };
  };
  // 다음 학년 준비
  nextYearPreparation: {
    prerequisites: {
      concept: string;
      status: 'mastered' | 'adequate' | 'needs_work';
      action: string;
    }[];
    readinessScore: number;
    recommendedPace: 'accelerated' | 'normal' | 'supported';
    focusAreas: string[];
    earlyWarnings: string[];
  };
  // 장기 학습 경로
  longTermPath: {
    currentTrajectory: string;
    projectedOutcomes: {
      timeframe: string;
      projection: string;
      confidence: number;
    }[];
    recommendedPath: string;
    alternativePaths: string[];
  };
  // 성장 스토리 서사
  growthNarrativeFinal: {
    headline: string;
    journey: string;
    achievements: string[];
    challenges: string[];
    transformationSummary: string;
    lookingAhead: string;
  };
  // 부모님 연간 종합 보고
  parentAnnualReport: {
    letterToParents: string;
    yearHighlights: string[];
    investmentSummary: string;
    nextYearRecommendations: string[];
  };
  // 선생님 연간 평가
  teacherAnnualAssessment: {
    overallRating: 'exceptional' | 'excellent' | 'good' | 'satisfactory' | 'needs_improvement';
    assessment: string;
    proudMoments: string[];
    areasForGrowth: string[];
    personalMessage: string;
  };
}

// ============================================
// Growth Loop 시스템 타입
// ============================================

/**
 * MicroLoopData - 마이크로 루프 데이터
 * 주간/월간 피드백 사이클
 */
export interface MicroLoopData {
  loopType: 'weekly' | 'monthly';
  cycleNumber: number;
  // 이전 사이클 목표
  previousGoals: {
    goal: string;
    achieved: boolean;
    achievementRate: number;
    notes: string;
  }[];
  // 현재 사이클 성과
  currentPerformance: {
    metric: string;
    target: number;
    actual: number;
    variance: number;
  }[];
  // 조정 사항
  adjustments: {
    area: string;
    previousSetting: string;
    newSetting: string;
    reason: string;
  }[];
  // 다음 사이클 목표
  nextCycleGoals: {
    goal: string;
    metric: string;
    target: number;
    deadline: string;
  }[];
  // 연속성 점수
  continuityScore: number;
  // 모멘텀
  momentum: 'accelerating' | 'maintaining' | 'slowing' | 'recovering';
}

/**
 * MacroLoopData - 매크로 루프 데이터
 * 반기/연간 전략 사이클
 */
export interface MacroLoopData {
  loopType: 'semi_annual' | 'annual';
  // 장기 목표 진척
  longTermGoalProgress: {
    goal: string;
    startDate: string;
    targetDate: string;
    currentProgress: number;
    onTrack: boolean;
    adjustmentNeeded: string;
  }[];
  // 전략 효과성
  strategyEffectiveness: {
    strategy: string;
    implementedDuration: string;
    measuredOutcome: string;
    effectiveness: 'highly_effective' | 'effective' | 'neutral' | 'ineffective';
    recommendation: 'continue' | 'modify' | 'discontinue';
  }[];
  // 패턴 분석
  patternAnalysis: {
    identifiedPatterns: string[];
    positivePatterns: string[];
    negativePatterns: string[];
    interventionPlan: string[];
  };
  // Baseline 대비 성장
  baselineGrowth: {
    metric: string;
    baseline: number;
    current: number;
    growthPercentage: number;
    trajectory: 'above_expected' | 'on_track' | 'below_expected';
  }[];
  // 다음 매크로 사이클 전략
  nextCycleStrategy: {
    primaryObjectives: string[];
    keyStrategies: string[];
    resourceAllocation: string[];
    riskFactors: string[];
    contingencyPlans: string[];
  };
}

/**
 * ContextData - AI 프롬프트 컨텍스트 데이터
 * 이전 리포트에서 주입할 데이터
 */
export interface AnalysisContextData {
  // 학생 메타 프로필
  metaProfile?: StudentMetaProfile;
  // 최근 리포트 요약 (최대 3개)
  recentReports?: {
    reportId: number;
    reportType: ReportType;
    reportDate: string;
    summary: string;
    keyFindings: string[];
    unresolvedIssues: string[];
  }[];
  // 활성 취약점
  activeWeaknesses?: {
    concept: string;
    severity: number;
    duration: string;
    attempts: number;
  }[];
  // 활성 강점
  activeStrengths?: {
    concept: string;
    level: number;
    consistency: string;
  }[];
  // 현재 마이크로 루프 상태
  currentMicroLoop?: MicroLoopData;
  // 현재 매크로 루프 상태 (반기/연간 리포트용)
  currentMacroLoop?: MacroLoopData;
  // 이전 리포트의 미래 비전 (비교용)
  previousVision?: {
    reportId: number;
    predictions: string[];
    actualOutcomes: string[];
    accuracy: number;
  };
}

// ============================================
// Phase 3.1: 학습 계획 체크리스트
// ============================================

/**
 * StudyPlanStatus - 학습 계획 상태
 */
export type StudyPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';

/**
 * StudyTaskStatus - 학습 항목 상태
 */
export type StudyTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

/**
 * StudyTaskPriority - 학습 항목 우선순위
 */
export type StudyTaskPriority = 'high' | 'medium' | 'low';

/**
 * StudyTaskCategory - 학습 항목 카테고리
 */
export type StudyTaskCategory =
  | 'concept_review'    // 개념 복습
  | 'problem_solving'   // 문제 풀이
  | 'workbook'          // 교재 진도
  | 'test_prep'         // 시험 대비
  | 'weakness_practice' // 취약점 연습
  | 'enrichment'        // 심화 학습
  | 'custom';           // 기타

/**
 * StudyPlan - 학습 계획
 * 주간/월간 학습 계획을 관리
 */
export interface StudyPlan {
  id: number;
  student_id: number;
  // 계획 기본 정보
  title: string;
  description?: string;
  period_type: 'weekly' | 'monthly' | 'custom';
  start_date: string;
  end_date: string;
  // 상태
  status: StudyPlanStatus;
  // 연관 정보
  report_id?: number;           // 리포트에서 생성된 경우
  created_by: 'teacher' | 'ai'; // 생성자
  // 메타 정보
  total_tasks: number;
  completed_tasks: number;
  progress_percentage: number;
  // 타임스탬프
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // JOIN 결과
  students?: Student;
  study_tasks?: StudyTask[];
}

export type StudyPlanInput = Omit<
  StudyPlan,
  'id' | 'created_at' | 'updated_at' | 'completed_at' | 'students' | 'study_tasks' |
  'total_tasks' | 'completed_tasks' | 'progress_percentage'
>;

/**
 * StudyTask - 학습 항목 (체크리스트 아이템)
 */
export interface StudyTask {
  id: number;
  study_plan_id: number;
  student_id: number;
  // 항목 정보
  title: string;
  description?: string;
  category: StudyTaskCategory;
  priority: StudyTaskPriority;
  // 학습 자료 정보
  source?: string;        // 교재명
  page_range?: string;    // 페이지 범위
  problem_numbers?: string; // 문제 번호
  estimated_minutes?: number; // 예상 소요 시간
  // 상태
  status: StudyTaskStatus;
  order_index: number;    // 순서
  // 완료 정보
  completed_at?: string;
  completed_by?: 'student' | 'parent' | 'teacher';
  completion_note?: string;
  actual_minutes?: number;  // 실제 소요 시간
  difficulty_feedback?: 'easy' | 'appropriate' | 'hard'; // 난이도 피드백
  // 타임스탬프
  created_at: string;
  updated_at: string;
}

export type StudyTaskInput = Omit<
  StudyTask,
  'id' | 'created_at' | 'updated_at' | 'completed_at'
>;

/**
 * StudyTaskUpdate - 학습 항목 업데이트 데이터
 */
export interface StudyTaskUpdate {
  status?: StudyTaskStatus;
  completion_note?: string;
  actual_minutes?: number;
  difficulty_feedback?: 'easy' | 'appropriate' | 'hard';
}

/**
 * StudyPlanSummary - 학습 계획 요약 (목록 표시용)
 */
export interface StudyPlanSummary {
  id: number;
  title: string;
  period_type: 'weekly' | 'monthly' | 'custom';
  start_date: string;
  end_date: string;
  status: StudyPlanStatus;
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  student_name?: string;
}

/**
 * StudyPlanWithTasks - 학습 계획과 항목 전체
 */
export interface StudyPlanWithTasks extends StudyPlan {
  tasks: StudyTask[];
}
