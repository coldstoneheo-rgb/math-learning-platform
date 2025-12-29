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
  created_at: string;
}

export type StudentInput = Omit<Student, 'id' | 'created_at'>;
export type ReportType = 'test' | 'weekly' | 'monthly' | 'consolidated';

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

export interface AnalysisData {
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
  analysis_data: AnalysisData;
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
  points3: number;
  points4: number;
  points5: number;
  points6: number;
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
