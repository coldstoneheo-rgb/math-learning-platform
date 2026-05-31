export type UserRole = 'super_admin' | 'teacher' | 'parent' | 'student';

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
  user_id?: string; // 학생 계정과 연결되는 auth.users(id)
  connection_code?: string; // 학생용 고유 연결 코드 (STU-XXXXXX)
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
  | 'consolidated'   // 레거시: 통합 리포트 (deprecated)
  | 'self_analysis'; // 학생/학부모 자기 분석 (Self-Analysis)

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

export interface VerifiedDerivedGuidance {
  macroAnalysis: MacroAnalysis;
  actionablePrescription: ActionablePrescriptionItem[];
  growthPredictions?: GrowthPrediction[];
  learningHabits?: LearningHabit[];
  riskFactors?: RiskFactor[];
  swotAnalysis?: SwotData;
  trendComment?: string;
}

/**
 * MetaCognitionAnalysis - 시험 풀이에서 관찰된 메타인지 분석
 * AI가 시험지 이미지에서 추론한 학생의 메타인지 능력
 */
export interface MetaCognitionAnalysis {
  // 전체 메타인지 점수 (AI 추정)
  overallScore: number; // 0-100

  // 오답 인식 능력 (풀이 과정에서 오류를 발견하고 수정한 흔적)
  errorRecognition: {
    score: number;
    evidence: string[]; // "2번 문제에서 계산 오류를 발견하고 수정한 흔적"
    analysis: string;
  };

  // 전략 선택 능력 (문제 유형에 맞는 풀이법 선택)
  strategySelection: {
    score: number;
    optimalCount: number;
    suboptimalCount: number;
    analysis: string;
  };

  // 시간 관리 추정 (풀이 완성도, 문제별 시간 배분)
  timeManagement: {
    score: number;
    completedProblems: number;
    totalProblems: number;
    analysis: string;
  };

  // 자기 점검 습관 (검산, 재확인 흔적)
  selfChecking: {
    score: number;
    evidence: string[];
    analysis: string;
  };

  // 메타인지 발달 단계
  developmentStage: 'beginner' | 'developing' | 'competent' | 'proficient' | 'expert';

  // 세부 개선 권장사항
  recommendations: string[];
}

/**
 * StaminaAnalysis - 시험 풀이 지구력 분석
 * 단일 시험에서 관찰된 집중력과 지구력 패턴
 */
export interface StaminaAnalysis {
  // 전체 지구력 점수 (0-100)
  overallScore: number;

  // 문제 순서별 정확도 분포
  accuracyBySequence: {
    range: string; // e.g., "1-5", "6-10"
    correctCount: number;
    totalCount: number;
    accuracy: number;
  }[];

  // 피로도 패턴 분석
  fatiguePattern: {
    type: 'consistent' | 'early-fatigue' | 'mid-dip' | 'late-fatigue' | 'improving';
    description: string;
    peakPerformanceRange?: string; // 가장 잘한 구간
    lowPerformanceRange?: string; // 가장 못한 구간
  };

  // 시간 배분 분석 (추정)
  timeDistribution: {
    estimatedTotalTime?: number; // 분
    estimatedTimePerProblem?: number; // 분
    rushedProblems?: string[]; // 급하게 푼 것 같은 문제
    overthoughtProblems?: string[]; // 너무 오래 고민한 것 같은 문제
    analysis: string;
  };

  // 집중력 유지 분석
  focusAnalysis: {
    score: number;
    signs: string[]; // 집중/비집중 징후
    analysis: string;
  };

  // 권장사항
  recommendations: string[];
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
  // 메타인지 분석 (시험 풀이에서 관찰된 메타인지 능력)
  metaCognitionAnalysis?: MetaCognitionAnalysis;
  // 지구력 분석 (시험 풀이 집중력 및 시간 배분)
  staminaAnalysis?: StaminaAnalysis;
  // AI 초안과 교사 확정값을 구분하기 위한 검증 메타데이터
  verificationStatus?: 'ai_draft' | 'teacher_verified';
  aiInferred?: {
    capturedAt: string;
    testResults?: Partial<TestResults>;
    detailedAnalysis?: DetailedProblemAnalysis[];
    note: string;
  };
  teacherVerified?: {
    verifiedAt: string;
    testResults: TestResults;
    detailedAnalysis: DetailedProblemAnalysis[];
    verificationNote?: string;
    adjustedFields: string[];
    derivedGuidanceStatus?: 'ai_draft_retained' | 'excluded_after_teacher_adjustment' | 'regenerated_from_teacher_verified';
    derivedGuidanceRegeneratedAt?: string;
    derivedGuidanceError?: string;
  };
  processingTrace?: ReportProcessingTrace;
}

export type ReportProcessingStatus = 'success' | 'failed' | 'skipped';

export interface ReportProcessingStepTrace {
  status: ReportProcessingStatus;
  message?: string;
  updatedAt: string;
}

export interface ReportProcessingTrace {
  savedAt: string;
  sourceOfTruth: 'teacher_verified' | 'ai_draft';
  teacherVerification?: {
    status: 'not_required' | 'verified';
    adjustedFields: string[];
    derivedGuidanceStatus?: NonNullable<TestAnalysisData['teacherVerified']>['derivedGuidanceStatus'];
  };
  downstream?: {
    studentProfile?: ReportProcessingStepTrace;
    metaProfile?: ReportProcessingStepTrace;
    feedbackLoop?: ReportProcessingStepTrace;
    studyPlan?: ReportProcessingStepTrace;
    embeddings?: ReportProcessingStepTrace;
  };
}

/**
 * SelfAnalysisReport - 학생/학부모 자기 분석 리포트
 * 교사 리포트와 별개로, 학생/학부모가 문제풀이 스캔본을 업로드하여 AI 분석을 요청할 때 사용
 */
export type SelfAnalysisProblemType =
  | '연습문제'
  | '교재'
  | '숙제'
  | '시험대비'
  | '자유학습';

export interface SelfAnalysisProblemFeedback {
  problemIdentifier?: string; // "3번", "p.42 4번" 등 문제 식별자
  observation: string;       // 5관점에서 관찰한 내용
  whatWentWell?: string;     // 잘한 점
  suggestion?: string;       // 개선 제안
  errorType?: string;        // 오류 유형 (오답인 경우)
}

export interface SelfAnalysisReport {
  analysisDate: string;
  problemType: SelfAnalysisProblemType;
  topicTags: string[];       // ['일차방정식', '인수분해'] 등
  studentNote?: string;      // 학생이 입력한 메모 (어려웠던 부분 등)
  uploadedBy: 'student' | 'parent';

  // AI 종합 평가
  overallAssessment: string;
  oneLineSummary: string;

  // 잘한 점 (강화할 것)
  strengthsObserved: string[];

  // 개선할 점 (집중할 것)
  areasToImprove: string[];

  // 과거 데이터와의 비교 (누적 학습 데이터 기반)
  comparisonWithHistory: {
    improvements: string[];        // 과거 대비 나아진 점
    persistentIssues: string[];    // 여전히 지속되는 이슈
    newObservations: string[];     // 이번에 새로 발견된 패턴
    overallTrend: 'improving' | 'stable' | 'needs_attention';
    trendSummary: string;
  };

  // 문항별 피드백
  problemFeedback: SelfAnalysisProblemFeedback[];

  // 당장 실천할 수 있는 다음 단계
  nextSteps: {
    immediate: string[];           // 오늘 바로 할 수 있는 것
    thisWeek: string[];            // 이번 주 목표
    studyTip: string;              // AI가 제안하는 학습 팁
  };

  // 동기부여 메시지
  encouragement: string;

  // 성장 마일스톤 (이번 분석에서 눈에 띄는 성취)
  milestone?: string;
}

/**
 * AnalysisData - 레거시 호환용 (TestAnalysisData와 동일)
 * @deprecated 새 코드에서는 AnyAnalysisData 또는 구체적 타입 사용 권장
 */
export type AnalysisData = TestAnalysisData;

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
  | ({ _type: 'self_analysis' } & SelfAnalysisReport)
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

export interface ProblemBehaviorData {
  problemNumber: string;
  selfConfidence?: 1 | 2 | 3; // 1: 찍음(낮음), 2: 헷갈림(보통), 3: 확신함(높음)
  timeSpentMins?: number; // 유독 오래 머무른 문제의 체공 시간 (분)
}

export interface TeacherComments {
  attitudeAndFocus?: string; // 문제 풀이 태도 및 집중도
  hesitationAndTime?: string; // 망설임 및 체공 시간 관찰
  metacognition?: string; // 메타인지 상태 (정답 확신도, 질문 빈도 등)
  additionalNote?: string; // 기타 교사 관찰 특이사항
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
  // Phase 1: 행동 데이터 트래킹
  teacherComments?: TeacherComments;
  problemBehaviorData?: ProblemBehaviorData[];
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

export interface RegenerateVerifiedDerivedAnalysisResponse {
  success: boolean;
  derivedGuidance?: VerifiedDerivedGuidance;
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
  // 과거 데이터 마이그레이션 핵심 시그널 (Phase 3 고도화)
  legacySignals?: {
    id: string;
    date: string;
    sourceType: string; // 시험지, 리포트 등
    affectedPillars: ('ErrorSignature' | 'AbsorptionRate' | 'SolvingStamina' | 'MetaCognition')[];
    insight: string; // 심층 분석 내용
    relatedConcepts: string[]; // 관련 단원/개념
    confidenceScore: number; // 추출에 대한 AI의 확신도 (1-100)
  }[];
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
  // 초기 Baseline 설정 (AI가 반환하는 간소화된 형식)
  initialBaseline: {
    overallLevel: string;
    strengths: string;
    weaknesses: string;
    errorPatterns: string;
    learningPotential: string;
    // 구조화된 오류 패턴 (primaryErrorTypes용)
    detailedErrorPatterns?: {
      type: '개념 오류' | '절차 오류' | '계산 오류' | '문제 오독' | '기타/부주의';
      frequency: number;
      description: string;
    }[];
  };
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
    // 연속성 지표 (내부용, UI에서는 habitScore 사용)
    continuityScore: number;
    // 모멘텀 상태
    momentumStatus: 'accelerating' | 'maintaining' | 'slowing' | 'recovering';
  };
  // 간단한 격려 메시지
  encouragement: string;
  // 선생님 코멘트
  teacherComment: string;

  // ===== 확장 필드 (Phase 1.2) =====

  // 학습 습관 점수 (부모 친화적 용어)
  // 0-100점, 숙제완료율 + 집중도 + 이해도 종합
  habitScore?: {
    score: number;  // 0-100
    breakdown: {
      assignmentCompletion: number;  // 숙제 완료 기여분 (0-40)
      focusLevel: number;            // 집중도 기여분 (0-30)
      understandingLevel: number;    // 이해도 기여분 (0-30)
    };
    trend: 'up' | 'stable' | 'down';  // 지난주 대비 추세
    explanation: string;  // "숙제를 잘 수행하고 수업에 집중하고 있어요"
  };

  // 성장 모멘텀 (부모 친화적 용어로 변환)
  growthMomentum?: {
    status: 'rising' | 'steady' | 'needs_attention';  // 상승중 / 유지중 / 관심필요
    statusLabel: string;  // "꾸준히 성장하고 있어요!" 등
    weeklyComparison: string;  // "지난주 대비 이해도가 15% 향상되었습니다"
  };

  // 팩트 기반 근거 (이미지 분석 결과)
  factBasedEvidence?: {
    imageAnalysis?: string[];  // 이미지에서 관찰된 구체적 내용
    dataPoints: string[];      // 데이터 기반 관찰 (수치, 비율 등)
    teacherObservations: string[];  // 선생님 메모에서 추출된 관찰
  };

  // 성장 추적 데이터 (차트용)
  growthTracking?: {
    weeklyScores: {
      weekNumber: number;
      habitScore: number;
      understandingAvg: number;
      focusAvg: number;
    }[];
    improvementRate: number;  // 지난 4주 대비 개선율 (%)
  };
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

  // ===== 확장 필드 (Phase 2.3) =====

  // 5개 역량 레이더 차트 데이터 (0-100)
  capabilityScores?: {
    conceptUnderstanding: number;  // 개념이해도
    problemSolving: number;        // 문제풀이력
    learningHabit: number;         // 학습습관
    assignmentPerformance: number; // 숙제수행
    testPerformanceScore: number;  // 시험성과
  };

  // 취약점 상태별 분류 (WeaknessResolutionMap 용)
  weaknessStatusMap?: {
    resolved: string[];   // 이번 달 해결됨
    improving: string[];  // 개선 진행 중
    ongoing: string[];    // 여전히 지속됨
    newlyFound: string[]; // 이번 달 새로 발견
  };

  // 주간 습관 점수 추이 (HabitTrendChart 용)
  weeklyHabitScores?: {
    weekNumber: number;
    score: number;
    understandingAvg: number;
    focusAvg: number;
  }[];

  // 월간 성장 한 줄 요약 (부모가 한눈에 볼 핵심)
  monthlyGrowthSummary?: {
    headline: string;          // "이번 달은 개념 이해가 크게 향상되었어요!"
    growthEmoji: string;       // "🚀" | "📈" | "👍" | "💪"
    keyAchievement: string;    // 가장 큰 성취 1문장
    keyFocus: string;          // 다음 달 집중 포인트 1문장
  };
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
  // (선택) UI용 성장 서사 배너 — AI 또는 클라이언트에서 생성
  growthSummaryBanner?: {
    headline: string;
    growthEmoji: string;
    keyAchievement: string;
    keyFocus: string;
  };
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
  // (선택) UI용 성장 서사 배너 — AI 또는 클라이언트에서 생성
  growthSummaryBanner?: {
    headline: string;
    growthEmoji: string;
    keyAchievement: string;
    keyFocus: string;
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
 * RAG 기억 서랍 - 의미적으로 유사한 과거 리포트 메모리
 */
export interface RelevantMemory {
  reportId: number;
  reportType: string;
  testDate: string | null;
  sourceType: string;
  text: string;
  similarity: number;
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
  // 지식 추적 기반 하위 스킬 검증 (Phase 2)
  failedMicroSkills?: string[];
  // 망각 곡선 적용 대상 스킬 (Phase 2)
  masteredSkills?: {
    skillId: string;
    skillName: string;
    lastMasteredDate: string;
    memoryStrength: number;
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
  // 전략 피드백 데이터 (Phase 2: 피드백 루프)
  strategyFeedback?: StrategyFeedbackContext;
  // RAG 기억 서랍 (과거 유사 분석 메모리)
  relevantMemories?: RelevantMemory[];
}

/**
 * StrategyFeedbackContext - AI 분석에 제공되는 전략 피드백 데이터
 * 과거 전략의 효과를 분석하여 새로운 전략 제안에 활용
 */
export interface StrategyFeedbackContext {
  // 효과적이었던 전략 (성공률 높은 순)
  effectiveStrategies: {
    type: string;
    title: string;
    concept?: string;
    avgImprovement: number;
    successRate: number;
    usageCount: number;
  }[];
  // 효과 없었던 전략 (다른 접근 필요)
  ineffectiveStrategies: {
    type: string;
    title: string;
    concept?: string;
    improvement: number;
    feedback?: string;
  }[];
  // 개념별 개선 현황
  conceptImprovements: {
    concept: string;
    totalImprovement: number;
    occurrenceCount: number;
  }[];
  // 전략 유형별 통계
  typeStats: {
    type: string;
    avgImprovement: number;
    completionRate: number;
    successRate: number;
  }[];
  // 전체 통계
  overallStats: {
    totalStrategies: number;
    completedCount: number;
    avgImprovement: number;
    successRate: number;
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

// ============================================
// Phase 5: CRM & 학부모-교사 상호작용 타입 정의
// ============================================

/**
 * ReportComment - 리포트 단위 교사-학부모 코멘트 스레드
 * 특정 AI 분석 리포트에 교사의 현장 의견 및 학부모 피드백을 기록
 */
export interface ReportComment {
  id: number;
  report_id: number;
  author_id: string;          // auth.users(id) - UUID
  content: string;
  created_at: string;
  updated_at: string;
  // JOIN 결과 (author 정보)
  author?: {
    id: string;
    name: string;
    role: UserRole;
    email: string;
  };
}

export type ReportCommentInput = Omit<ReportComment, 'id' | 'created_at' | 'updated_at' | 'author'>;

/**
 * ParentChecklistItem - 학부모 주간 가이드 체크리스트 항목
 * AI의 Actionable Prescription 기반으로 자동 생성
 */
export interface ParentChecklistItem {
  id: string;                 // 항목 고유 ID (UUID 또는 sequential)
  title: string;              // 항목 제목
  description?: string;       // 상세 설명
  priority: 1 | 2 | 3;       // 1=지금 바로, 2=이번 주, 3=꾸준히
  completed: boolean;
  source_report_id?: number;  // 해당 항목이 파생된 리포트 ID
  completed_at?: string;      // 완료 시각
}

/**
 * ParentChecklist - 학부모 주간 가이드 체크리스트
 */
export interface ParentChecklist {
  id: number;
  parent_id: string;          // auth.users(id)
  student_id: number;
  week_start_date: string;    // 'YYYY-MM-DD' (해당 주 월요일)
  items: ParentChecklistItem[];
  completed: boolean;         // 모든 항목 완료 여부
  created_at: string;
  updated_at: string;
}

export type ParentChecklistInput = Omit<ParentChecklist, 'id' | 'created_at' | 'updated_at'>;

/**
 * NotificationChannel - 알림 발송 채널
 * 카카오 알림톡 확장을 고려한 유연한 설계
 */
export type NotificationChannel = 'email' | 'kakao' | 'push' | 'in_app';

/**
 * NotificationStatus - 알림 발송 상태
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

/**
 * Notification - 멀티채널 알림 레코드
 * DB의 notifications 테이블과 1:1 매핑
 */
export interface Notification {
  id: number;
  user_id: string;              // 수신자 auth.users(id)
  title: string;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  template_id?: string;         // 카카오 알림톡 템플릿 코드 (향후 확장)
  provider_response?: {
    // Resend 응답: { id: string }
    // 카카오 응답: { msgId: string, ... }
    [key: string]: unknown;
  };
  read: boolean;
  related_resource_type?: string; // 'report' | 'student' 등
  related_resource_id?: string;
  created_at: string;
  sent_at?: string;
}

/**
 * NotificationInput - 알림 생성용 입력 타입 (API 서버에서 사용)
 */
export type NotificationInput = Omit<
  Notification,
  'id' | 'created_at' | 'sent_at' | 'provider_response' | 'read' | 'status'
> & {
  status?: NotificationStatus;
};

/**
 * SendNotificationRequest - 알림 발송 API 요청 타입
 */
export interface SendNotificationRequest {
  recipientUserId: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  templateId?: string;              // 카카오 알림톡 템플릿 코드
  relatedResourceType?: string;
  relatedResourceId?: string;
  // 이메일 발송 시 추가 정보
  emailData?: {
    recipientEmail: string;
    recipientName: string;
    studentName?: string;
    reportId?: number;
    reportUrl?: string;
  };
}

/**
 * SendNotificationResponse - 알림 발송 API 응답 타입
 *
 * provider 실패도 notification record에는 failed 상태로 남을 수 있으므로,
 * 클라이언트는 HTTP status와 함께 이 응답의 status/error를 확인해야 한다.
 */
export interface SendNotificationResponse {
  success: boolean;
  notificationId?: number | null;
  channel?: NotificationChannel | string;
  status?: Extract<NotificationStatus, 'sent' | 'failed'>;
  error?: string;
  providerResponse?: Record<string, unknown>;
}

