/**
 * API Input Validation Schemas (Zod)
 *
 * 모든 API 입력 데이터의 유효성 검사를 위한 스키마 정의
 */

import { z } from 'zod';

// ===== 공통 스키마 =====

/** 양의 정수 */
export const positiveIntSchema = z.number().int().positive();

/** 연도 (2000-2100) */
export const yearSchema = z.number().int().min(2000).max(2100);

/** 월 (1-12) */
export const monthSchema = z.number().int().min(1).max(12);

/** 주차 (1-53) */
export const weekNumberSchema = z.number().int().min(1).max(53);

/** 학년 (1-12) */
export const gradeSchema = z.number().int().min(1).max(12);

/** 날짜 문자열 (YYYY-MM-DD) */
export const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)'
);

/** Base64 이미지 (최대 5MB) */
export const base64ImageSchema = z.string()
  .refine(
    (val) => {
      // Base64 데이터 URL 또는 순수 Base64 문자열 허용
      if (val.startsWith('data:image/')) {
        const base64Part = val.split(',')[1] || '';
        // Base64 크기 추정: 원본 바이트 크기 ≈ Base64 길이 * 0.75
        return base64Part.length * 0.75 < 5 * 1024 * 1024; // 5MB
      }
      return val.length * 0.75 < 5 * 1024 * 1024;
    },
    { message: '이미지 크기가 너무 큽니다 (최대 5MB)' }
  );

/** 이미지 배열 (최대 20장) */
export const imageArraySchema = z.array(base64ImageSchema)
  .min(1, '최소 1개의 이미지가 필요합니다')
  .max(20, '최대 20개의 이미지만 허용됩니다');

/** 파일 데이터 (이미지 또는 PDF) */
export const fileDataSchema = z.object({
  data: z.string().refine(
    (val) => val.length * 0.75 < 10 * 1024 * 1024, // 10MB
    { message: '파일 크기가 너무 큽니다 (최대 10MB)' }
  ),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']),
});

/** 파일 배열 (최대 20개) */
export const fileArraySchema = z.array(fileDataSchema)
  .min(1, '최소 1개의 파일이 필요합니다')
  .max(20, '최대 20개의 파일만 허용됩니다');

// ===== 시험 분석 API 스키마 =====

export const testFormDataSchema = z.object({
  testName: z.string().min(1).max(100),
  testDate: dateStringSchema,
  testRange: z.string().max(200),
  totalQuestions: z.number().int().min(1).max(500),
  maxScore: z.number().min(0).max(1000),
  points2: z.number().int().min(0).max(100),
  points3: z.number().int().min(0).max(100),
  points4: z.number().int().min(0).max(100),
  points5: z.number().int().min(0).max(100),
  points6: z.number().int().min(0).max(100),
  pointsEssay: z.number().int().min(0).max(100),
  difficulty: z.string().max(50).optional(),
  questionsByPoint: z.array(z.object({
    points: z.string(),
    count: z.number().int().min(0),
  })).optional(),
  totalScore: z.number().min(0).max(1000).optional(),
  rank: z.number().int().min(1).max(10000).optional(),
  totalStudents: z.number().int().min(1).max(10000).optional(),
}).passthrough(); // 추가 필드 허용

export const analyzeRequestSchema = z.object({
  studentId: positiveIntSchema.optional(),
  studentName: z.string().min(1, '학생 이름이 필요합니다').max(50),
  formData: testFormDataSchema,
  currentImages: imageArraySchema,
  pastImages: z.array(base64ImageSchema).max(20).optional(),
  reportType: z.enum(['level_test', 'test', 'weekly', 'monthly', 'semi_annual', 'annual', 'consolidated']).optional(),
});

// ===== 레벨 테스트 API 스키마 =====

export const levelTestRequestSchema = z.object({
  studentId: positiveIntSchema,
  testFiles: fileArraySchema,  // { data, mimeType }[] 형식 (이미지 + PDF 지원)
  additionalInfo: z.object({
    school: z.string().max(100).optional(),
    previousExperience: z.string().max(1000).optional(),
    parentExpectations: z.string().max(1000).optional(),
  }).optional(),
});

// ===== 주간 리포트 API 스키마 =====

export const weeklyReportRequestSchema = z.object({
  studentId: positiveIntSchema,
  year: yearSchema,
  weekNumber: weekNumberSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  teacherNotes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  },
  { message: '종료일은 시작일 이후여야 합니다', path: ['endDate'] }
);

// ===== 월간 리포트 API 스키마 =====

export const monthlyReportRequestSchema = z.object({
  studentId: positiveIntSchema,
  year: yearSchema,
  month: monthSchema,
  teacherNotes: z.string().max(2000).optional(),
});

// ===== 반기 리포트 API 스키마 =====

export const semiAnnualReportRequestSchema = z.object({
  studentId: positiveIntSchema,
  year: yearSchema,
  halfYear: z.enum(['상반기', '하반기']),
});

// ===== 연간 리포트 API 스키마 =====

export const annualReportRequestSchema = z.object({
  studentId: positiveIntSchema,
  year: yearSchema,
});

// ===== 학생 관련 스키마 =====

export const studentCreateSchema = z.object({
  student_id: z.string().regex(/^[A-Z]\d{7}$/, '학생 ID 형식이 올바르지 않습니다').optional(),
  name: z.string().min(1).max(50, '이름은 최대 50자까지 가능합니다'),
  grade: gradeSchema,
  school: z.string().max(100).optional(),
  start_date: dateStringSchema.optional(),
  parent_id: z.string().uuid().optional(),
  learning_style: z.enum(['visual', 'verbal', 'logical']).optional(),
  personality_traits: z.array(z.string().max(50)).max(10).optional(),
});

export const studentUpdateSchema = studentCreateSchema.partial();

// ===== 유틸리티 함수 =====

/**
 * 요청 데이터 검증
 * @param schema - Zod 스키마
 * @param data - 검증할 데이터
 * @returns 검증 결과 (성공 시 data, 실패 시 error)
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // 첫 번째 에러 메시지 반환
  const firstError = result.error.issues[0];
  const path = firstError.path.join('.');
  const message = firstError.message;

  return {
    success: false,
    error: path ? `${path}: ${message}` : message,
  };
}

/**
 * 입력 데이터 정제 (XSS 방지)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * 객체 내 모든 문자열 정제
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };

  for (const key in result) {
    const value = result[key];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }

  return result;
}

// ===== 타입 추론 =====

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type LevelTestRequest = z.infer<typeof levelTestRequestSchema>;
export type WeeklyReportRequest = z.infer<typeof weeklyReportRequestSchema>;
export type MonthlyReportRequest = z.infer<typeof monthlyReportRequestSchema>;
export type SemiAnnualReportRequest = z.infer<typeof semiAnnualReportRequestSchema>;
export type AnnualReportRequest = z.infer<typeof annualReportRequestSchema>;
export type StudentCreate = z.infer<typeof studentCreateSchema>;
export type StudentUpdate = z.infer<typeof studentUpdateSchema>;
