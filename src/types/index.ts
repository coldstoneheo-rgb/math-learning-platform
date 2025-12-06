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
