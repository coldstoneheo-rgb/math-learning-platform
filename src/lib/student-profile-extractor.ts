/**
 * 학생 프로필 자동 추출 서비스
 *
 * 리포트의 AI 분석 데이터에서 취약점, 강점, 패턴을 추출하여
 * 학생의 전역 프로필에 저장합니다.
 */

import { createClient } from '@/lib/supabase/client';
import type {
  AnalysisData,
  MonthlyReportData,
  WeeklyReportData,
  ConsolidatedReportData,
  StudentWeakness,
  StudentStrength,
  StudentPattern,
  WeaknessCategory,
  WeaknessStatus,
  StrengthCategory,
  PatternType,
  PatternFrequency,
  ProfileChangeType,
} from '@/types';

// 추출된 취약점 정보
interface ExtractedWeakness {
  concept: string;
  category: WeaknessCategory;
  severity: number; // 1-5
}

// 추출된 강점 정보
interface ExtractedStrength {
  concept: string;
  category: StrengthCategory;
  level: number; // 1-5
}

// 추출된 패턴 정보
interface ExtractedPattern {
  patternType: PatternType;
  description: string;
  isPositive: boolean;
  frequency: PatternFrequency;
}

/**
 * 분석 데이터에서 취약점 추출
 */
function extractWeaknesses(analysisData: AnalysisData): ExtractedWeakness[] {
  const weaknesses: ExtractedWeakness[] = [];
  const seenConcepts = new Set<string>();

  // 1. macroAnalysis.weaknesses에서 추출
  if (analysisData.macroAnalysis?.weaknesses) {
    const weaknessText = analysisData.macroAnalysis.weaknesses;
    // 문장 단위로 분리하여 개념 추출
    const concepts = parseConceptsFromText(weaknessText);
    concepts.forEach(concept => {
      if (!seenConcepts.has(concept.toLowerCase())) {
        seenConcepts.add(concept.toLowerCase());
        weaknesses.push({
          concept,
          category: categorizeWeakness(concept, weaknessText),
          severity: 3, // 기본값
        });
      }
    });
  }

  // 2. detailedAnalysis에서 오류 유형별 추출
  if (analysisData.detailedAnalysis) {
    const errorTypeCounts: Record<string, number> = {};
    const errorConcepts: Record<string, string[]> = {};

    analysisData.detailedAnalysis.forEach(item => {
      if (item.isCorrect === 'X' || item.isCorrect === '△') {
        const errorType = item.errorType;
        if (errorType && errorType !== 'N/A') {
          errorTypeCounts[errorType] = (errorTypeCounts[errorType] || 0) + 1;
          if (!errorConcepts[errorType]) {
            errorConcepts[errorType] = [];
          }
          if (item.keyConcept && !errorConcepts[errorType].includes(item.keyConcept)) {
            errorConcepts[errorType].push(item.keyConcept);
          }
        }
      }
    });

    // 2회 이상 발생한 오류 유형을 취약점으로 추가
    Object.entries(errorTypeCounts).forEach(([errorType, count]) => {
      if (count >= 2) {
        const concept = `${errorType} (${errorConcepts[errorType]?.slice(0, 2).join(', ') || '다수 문항'})`;
        if (!seenConcepts.has(concept.toLowerCase())) {
          seenConcepts.add(concept.toLowerCase());
          weaknesses.push({
            concept,
            category: mapErrorTypeToCategory(errorType),
            severity: Math.min(5, count + 2), // 횟수에 따라 심각도 증가
          });
        }
      }
    });
  }

  // 3. actionablePrescription에서 추출
  if (analysisData.actionablePrescription) {
    analysisData.actionablePrescription.forEach(item => {
      if (item.type === '개념 교정' && item.title) {
        if (!seenConcepts.has(item.title.toLowerCase())) {
          seenConcepts.add(item.title.toLowerCase());
          weaknesses.push({
            concept: item.title,
            category: 'concept',
            severity: item.priority === 1 ? 5 : item.priority === 2 ? 4 : 3,
          });
        }
      }
    });
  }

  // 4. riskFactors에서 추출
  if (analysisData.riskFactors) {
    analysisData.riskFactors.forEach(risk => {
      if (!seenConcepts.has(risk.factor.toLowerCase())) {
        seenConcepts.add(risk.factor.toLowerCase());
        weaknesses.push({
          concept: risk.factor,
          category: 'habit',
          severity: risk.severity === 'high' ? 5 : risk.severity === 'medium' ? 3 : 2,
        });
      }
    });
  }

  return weaknesses;
}

/**
 * 분석 데이터에서 강점 추출
 */
function extractStrengths(analysisData: AnalysisData): ExtractedStrength[] {
  const strengths: ExtractedStrength[] = [];
  const seenConcepts = new Set<string>();

  // 1. macroAnalysis.strengths에서 추출
  if (analysisData.macroAnalysis?.strengths) {
    const strengthText = analysisData.macroAnalysis.strengths;
    const concepts = parseConceptsFromText(strengthText);
    concepts.forEach(concept => {
      if (!seenConcepts.has(concept.toLowerCase())) {
        seenConcepts.add(concept.toLowerCase());
        strengths.push({
          concept,
          category: categorizeStrength(concept, strengthText),
          level: 3,
        });
      }
    });
  }

  // 2. detailedAnalysis에서 최적/창의적 풀이 추출
  if (analysisData.detailedAnalysis) {
    const optimalConcepts: string[] = [];
    const creativeConcepts: string[] = [];

    analysisData.detailedAnalysis.forEach(item => {
      if (item.isCorrect === 'O') {
        if (item.solutionStrategy === '최적 풀이' && item.keyConcept) {
          optimalConcepts.push(item.keyConcept);
        } else if (item.solutionStrategy === '창의적 접근' && item.keyConcept) {
          creativeConcepts.push(item.keyConcept);
        }
      }
    });

    // 최적 풀이가 많은 개념을 강점으로 추가
    const conceptCounts: Record<string, number> = {};
    optimalConcepts.forEach(c => {
      conceptCounts[c] = (conceptCounts[c] || 0) + 1;
    });

    Object.entries(conceptCounts).forEach(([concept, count]) => {
      if (count >= 2 && !seenConcepts.has(concept.toLowerCase())) {
        seenConcepts.add(concept.toLowerCase());
        strengths.push({
          concept: `${concept} 숙달`,
          category: 'concept',
          level: Math.min(5, count + 2),
        });
      }
    });

    // 창의적 접근 강점 추가
    if (creativeConcepts.length > 0) {
      const creativeSummary = `창의적 문제 접근 (${creativeConcepts.slice(0, 2).join(', ')})`;
      if (!seenConcepts.has(creativeSummary.toLowerCase())) {
        strengths.push({
          concept: creativeSummary,
          category: 'creativity',
          level: 4,
        });
      }
    }
  }

  // 3. mathCapability에서 높은 점수 항목 추출
  if (analysisData.macroAnalysis?.mathCapability) {
    const cap = analysisData.macroAnalysis.mathCapability;
    const capabilityMap: Record<string, { name: string; category: StrengthCategory }> = {
      calculationSpeed: { name: '계산 속도', category: 'calculation' },
      calculationAccuracy: { name: '계산 정확도', category: 'calculation' },
      applicationAbility: { name: '응용력', category: 'application' },
      logic: { name: '논리적 사고', category: 'concept' },
    };

    Object.entries(capabilityMap).forEach(([key, info]) => {
      const value = cap[key as keyof typeof cap];
      if (value && value >= 70 && !seenConcepts.has(info.name.toLowerCase())) {
        seenConcepts.add(info.name.toLowerCase());
        strengths.push({
          concept: info.name,
          category: info.category,
          level: value >= 90 ? 5 : value >= 80 ? 4 : 3,
        });
      }
    });
  }

  return strengths;
}

/**
 * 분석 데이터에서 패턴 추출
 */
function extractPatterns(analysisData: AnalysisData): ExtractedPattern[] {
  const patterns: ExtractedPattern[] = [];
  const seenDescriptions = new Set<string>();

  // 1. learningHabits에서 추출
  if (analysisData.learningHabits) {
    analysisData.learningHabits.forEach(habit => {
      if (!seenDescriptions.has(habit.description.toLowerCase())) {
        seenDescriptions.add(habit.description.toLowerCase());
        patterns.push({
          patternType: 'habit',
          description: habit.description,
          isPositive: habit.type === 'good',
          frequency: habit.frequency,
        });
      }
    });
  }

  // 2. macroAnalysis.errorPattern에서 추출
  if (analysisData.macroAnalysis?.errorPattern) {
    const errorPattern = analysisData.macroAnalysis.errorPattern;
    if (!seenDescriptions.has(errorPattern.toLowerCase())) {
      seenDescriptions.add(errorPattern.toLowerCase());
      patterns.push({
        patternType: 'error',
        description: errorPattern,
        isPositive: false,
        frequency: 'often',
      });
    }
  }

  // 3. detailedAnalysis에서 반복되는 오류 패턴 추출
  if (analysisData.detailedAnalysis) {
    // 같은 오류 유형이 여러 번 나타나면 패턴으로 인식
    const errorPatterns: Record<string, number> = {};
    analysisData.detailedAnalysis.forEach(item => {
      if (item.isCorrect !== 'O' && item.errorType && item.errorType !== 'N/A') {
        errorPatterns[item.errorType] = (errorPatterns[item.errorType] || 0) + 1;
      }
    });

    Object.entries(errorPatterns).forEach(([errorType, count]) => {
      if (count >= 3) {
        const desc = `반복적 ${errorType} 발생`;
        if (!seenDescriptions.has(desc.toLowerCase())) {
          seenDescriptions.add(desc.toLowerCase());
          patterns.push({
            patternType: 'error',
            description: desc,
            isPositive: false,
            frequency: count >= 5 ? 'always' : 'often',
          });
        }
      }
    });
  }

  // 4. actionablePrescription에서 습관 관련 추출
  if (analysisData.actionablePrescription) {
    analysisData.actionablePrescription.forEach(item => {
      if (item.type === '습관 교정' && item.title) {
        const desc = item.title;
        if (!seenDescriptions.has(desc.toLowerCase())) {
          seenDescriptions.add(desc.toLowerCase());
          patterns.push({
            patternType: 'habit',
            description: desc,
            isPositive: false,
            frequency: 'often',
          });
        }
      }
    });
  }

  return patterns;
}

/**
 * 텍스트에서 개념 추출 (간단한 파싱)
 */
function parseConceptsFromText(text: string): string[] {
  const concepts: string[] = [];

  // 쉼표, 세미콜론, 숫자+점으로 구분된 항목 추출
  const items = text.split(/[,;]|\d+\.\s*/);

  items.forEach(item => {
    const trimmed = item.trim();
    // 너무 짧거나 긴 항목은 제외
    if (trimmed.length >= 2 && trimmed.length <= 50) {
      // 괄호 내용이나 부가 설명 제거
      const cleaned = trimmed.replace(/\([^)]*\)/g, '').trim();
      if (cleaned.length >= 2) {
        concepts.push(cleaned);
      }
    }
  });

  // 최대 5개까지만 반환
  return concepts.slice(0, 5);
}

/**
 * 취약점 카테고리 분류
 */
function categorizeWeakness(concept: string, context: string): WeaknessCategory {
  const lowerConcept = concept.toLowerCase();
  const lowerContext = context.toLowerCase();

  if (lowerConcept.includes('계산') || lowerContext.includes('계산')) {
    return 'calculation';
  }
  if (lowerConcept.includes('응용') || lowerContext.includes('응용') || lowerConcept.includes('활용')) {
    return 'application';
  }
  if (lowerConcept.includes('문제 해석') || lowerConcept.includes('독해') || lowerContext.includes('오독')) {
    return 'reading';
  }
  if (lowerConcept.includes('습관') || lowerContext.includes('습관') || lowerConcept.includes('부주의')) {
    return 'habit';
  }
  return 'concept';
}

/**
 * 강점 카테고리 분류
 */
function categorizeStrength(concept: string, context: string): StrengthCategory {
  const lowerConcept = concept.toLowerCase();
  const lowerContext = context.toLowerCase();

  if (lowerConcept.includes('계산') || lowerContext.includes('계산')) {
    return 'calculation';
  }
  if (lowerConcept.includes('응용') || lowerContext.includes('응용') || lowerConcept.includes('활용')) {
    return 'application';
  }
  if (lowerConcept.includes('문제 이해') || lowerConcept.includes('독해')) {
    return 'reading';
  }
  if (lowerConcept.includes('창의') || lowerContext.includes('창의')) {
    return 'creativity';
  }
  return 'concept';
}

/**
 * 오류 유형을 취약점 카테고리로 매핑
 */
function mapErrorTypeToCategory(errorType: string): WeaknessCategory {
  switch (errorType) {
    case '계산 오류':
      return 'calculation';
    case '개념 오류':
      return 'concept';
    case '문제 오독':
      return 'reading';
    case '기타/부주의':
      return 'habit';
    default:
      return 'concept';
  }
}

/**
 * 학생 프로필 업데이트 (메인 함수)
 *
 * @param studentId - 학생 ID
 * @param reportId - 리포트 ID
 * @param analysisData - AI 분석 데이터
 */
export async function updateStudentProfile(
  studentId: number,
  reportId: number,
  analysisData: AnalysisData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();

    // 1. 취약점 추출 및 업데이트
    const extractedWeaknesses = extractWeaknesses(analysisData);
    await processWeaknesses(supabase, studentId, reportId, extractedWeaknesses, now);

    // 2. 강점 추출 및 업데이트
    const extractedStrengths = extractStrengths(analysisData);
    await processStrengths(supabase, studentId, reportId, extractedStrengths, now);

    // 3. 패턴 추출 및 업데이트
    const extractedPatterns = extractPatterns(analysisData);
    await processPatterns(supabase, studentId, reportId, extractedPatterns, now);

    return { success: true };
  } catch (error) {
    console.error('학생 프로필 업데이트 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 취약점 처리
 */
async function processWeaknesses(
  supabase: ReturnType<typeof createClient>,
  studentId: number,
  reportId: number,
  extractedWeaknesses: ExtractedWeakness[],
  now: string
) {
  for (const weakness of extractedWeaknesses) {
    // 기존 취약점 조회 (유사한 개념)
    const { data: existing } = await supabase
      .from('student_weaknesses')
      .select('*')
      .eq('student_id', studentId)
      .ilike('concept', `%${weakness.concept.substring(0, 10)}%`)
      .single();

    if (existing) {
      // 기존 취약점 업데이트
      const newStatus = determineWeaknessStatus(existing as StudentWeakness, weakness.severity);
      const relatedIds = existing.related_report_ids || [];
      if (!relatedIds.includes(reportId)) {
        relatedIds.push(reportId);
      }

      const updateData: Partial<StudentWeakness> = {
        severity: Math.max(existing.severity, weakness.severity),
        status: newStatus,
        occurrence_count: existing.occurrence_count + 1,
        last_detected_at: now,
        last_detected_report_id: reportId,
        related_report_ids: relatedIds,
        updated_at: now,
      };

      // 재발 시 recurred_at 설정
      if (existing.status === 'resolved' && newStatus === 'recurring') {
        updateData.recurred_at = now;
      }

      await supabase
        .from('student_weaknesses')
        .update(updateData)
        .eq('id', existing.id);

      // 변경 이력 기록
      await logProfileChange(
        supabase,
        studentId,
        reportId,
        existing.status === 'resolved' ? 'weakness_recurred' : 'weakness_updated',
        'weakness',
        existing.id,
        existing,
        { ...existing, ...updateData },
        now
      );
    } else {
      // 새 취약점 생성
      const newWeakness = {
        student_id: studentId,
        concept: weakness.concept,
        category: weakness.category,
        severity: weakness.severity,
        status: 'active' as WeaknessStatus,
        occurrence_count: 1,
        first_detected_at: now,
        first_detected_report_id: reportId,
        last_detected_at: now,
        last_detected_report_id: reportId,
        related_report_ids: [reportId],
        is_manually_added: false,
      };

      const { data: inserted, error } = await supabase
        .from('student_weaknesses')
        .insert(newWeakness)
        .select()
        .single();

      if (!error && inserted) {
        await logProfileChange(
          supabase,
          studentId,
          reportId,
          'weakness_added',
          'weakness',
          inserted.id,
          null,
          inserted,
          now
        );
      }
    }
  }
}

/**
 * 강점 처리
 */
async function processStrengths(
  supabase: ReturnType<typeof createClient>,
  studentId: number,
  reportId: number,
  extractedStrengths: ExtractedStrength[],
  now: string
) {
  for (const strength of extractedStrengths) {
    // 기존 강점 조회
    const { data: existing } = await supabase
      .from('student_strengths')
      .select('*')
      .eq('student_id', studentId)
      .ilike('concept', `%${strength.concept.substring(0, 10)}%`)
      .single();

    if (existing) {
      // 기존 강점 업데이트
      const relatedIds = existing.related_report_ids || [];
      if (!relatedIds.includes(reportId)) {
        relatedIds.push(reportId);
      }

      await supabase
        .from('student_strengths')
        .update({
          level: Math.max(existing.level, strength.level),
          status: 'active',
          confirmation_count: existing.confirmation_count + 1,
          last_confirmed_at: now,
          last_confirmed_report_id: reportId,
          related_report_ids: relatedIds,
          updated_at: now,
        })
        .eq('id', existing.id);

      await logProfileChange(
        supabase,
        studentId,
        reportId,
        'strength_updated',
        'strength',
        existing.id,
        existing,
        { ...existing, level: Math.max(existing.level, strength.level) },
        now
      );
    } else {
      // 새 강점 생성
      const newStrength = {
        student_id: studentId,
        concept: strength.concept,
        category: strength.category,
        level: strength.level,
        status: 'active',
        confirmation_count: 1,
        first_detected_at: now,
        first_detected_report_id: reportId,
        last_confirmed_at: now,
        last_confirmed_report_id: reportId,
        related_report_ids: [reportId],
        is_manually_added: false,
      };

      const { data: inserted, error } = await supabase
        .from('student_strengths')
        .insert(newStrength)
        .select()
        .single();

      if (!error && inserted) {
        await logProfileChange(
          supabase,
          studentId,
          reportId,
          'strength_added',
          'strength',
          inserted.id,
          null,
          inserted,
          now
        );
      }
    }
  }
}

/**
 * 패턴 처리
 */
async function processPatterns(
  supabase: ReturnType<typeof createClient>,
  studentId: number,
  reportId: number,
  extractedPatterns: ExtractedPattern[],
  now: string
) {
  for (const pattern of extractedPatterns) {
    // 기존 패턴 조회
    const { data: existing } = await supabase
      .from('student_patterns')
      .select('*')
      .eq('student_id', studentId)
      .ilike('description', `%${pattern.description.substring(0, 20)}%`)
      .single();

    if (existing) {
      // 기존 패턴 업데이트
      const relatedIds = existing.related_report_ids || [];
      if (!relatedIds.includes(reportId)) {
        relatedIds.push(reportId);
      }

      await supabase
        .from('student_patterns')
        .update({
          frequency: pattern.frequency,
          occurrence_count: existing.occurrence_count + 1,
          last_detected_at: now,
          related_report_ids: relatedIds,
          updated_at: now,
        })
        .eq('id', existing.id);

      await logProfileChange(
        supabase,
        studentId,
        reportId,
        'pattern_changed',
        'pattern',
        existing.id,
        existing,
        { ...existing, frequency: pattern.frequency },
        now
      );
    } else {
      // 새 패턴 생성
      const newPattern = {
        student_id: studentId,
        pattern_type: pattern.patternType,
        description: pattern.description,
        is_positive: pattern.isPositive,
        frequency: pattern.frequency,
        status: 'active',
        occurrence_count: 1,
        first_detected_at: now,
        last_detected_at: now,
        related_report_ids: [reportId],
      };

      const { data: inserted, error } = await supabase
        .from('student_patterns')
        .insert(newPattern)
        .select()
        .single();

      if (!error && inserted) {
        await logProfileChange(
          supabase,
          studentId,
          reportId,
          'pattern_added',
          'pattern',
          inserted.id,
          null,
          inserted,
          now
        );
      }
    }
  }
}

/**
 * 취약점 상태 결정
 */
function determineWeaknessStatus(
  existing: StudentWeakness,
  newSeverity: number
): WeaknessStatus {
  // 이전에 해결됐던 취약점이 다시 발견되면 recurring
  if (existing.status === 'resolved') {
    return 'recurring';
  }
  // 심각도가 감소하면 improving
  if (newSeverity < existing.severity) {
    return 'improving';
  }
  // 그 외에는 기존 상태 유지 또는 active
  return existing.status === 'improving' ? 'improving' : 'active';
}

/**
 * 프로필 변경 이력 기록
 */
async function logProfileChange(
  supabase: ReturnType<typeof createClient>,
  studentId: number,
  reportId: number,
  changeType: ProfileChangeType,
  attributeType: 'weakness' | 'strength' | 'pattern',
  attributeId: number,
  previousState: Record<string, unknown> | null,
  newState: Record<string, unknown>,
  now: string
) {
  await supabase.from('student_profile_history').insert({
    student_id: studentId,
    report_id: reportId,
    change_type: changeType,
    attribute_type: attributeType,
    attribute_id: attributeId,
    previous_state: previousState,
    new_state: newState,
    changed_by: 'ai',
    teacher_approved: false,
    created_at: now,
  });
}

/**
 * 학생의 활성 취약점 조회
 */
export async function getActiveWeaknesses(studentId: number): Promise<StudentWeakness[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('student_weaknesses')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['active', 'recurring'])
    .order('severity', { ascending: false });

  return (data as StudentWeakness[]) || [];
}

/**
 * 학생의 활성 강점 조회
 */
export async function getActiveStrengths(studentId: number): Promise<StudentStrength[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('student_strengths')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('level', { ascending: false });

  return (data as StudentStrength[]) || [];
}

/**
 * 학생의 활성 패턴 조회
 */
export async function getActivePatterns(studentId: number): Promise<StudentPattern[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('student_patterns')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('occurrence_count', { ascending: false });

  return (data as StudentPattern[]) || [];
}

/**
 * 월간 리포트 데이터에서 취약점 추출
 */
function extractWeaknessesFromMonthly(data: MonthlyReportData): ExtractedWeakness[] {
  const weaknesses: ExtractedWeakness[] = [];
  const seenConcepts = new Set<string>();

  // 1. learningContent에서 'not_good' 평가 항목 추출
  if (data.learningContent) {
    data.learningContent.forEach(item => {
      if (item.evaluation === 'not_good' && item.topic && !seenConcepts.has(item.topic.toLowerCase())) {
        seenConcepts.add(item.topic.toLowerCase());
        weaknesses.push({
          concept: item.topic,
          category: 'concept',
          severity: 3,
        });
      }
    });
  }

  // 2. needsImprovement에서 추출
  if (data.needsImprovement) {
    data.needsImprovement.forEach(item => {
      if (item && !seenConcepts.has(item.toLowerCase())) {
        seenConcepts.add(item.toLowerCase());
        weaknesses.push({
          concept: item,
          category: categorizeWeaknessText(item),
          severity: 2,
        });
      }
    });
  }

  // 3. reviewProblems에서 반복되는 concept 추출
  if (data.reviewProblems) {
    const conceptCounts: Record<string, number> = {};
    data.reviewProblems.forEach(problem => {
      if (problem.concept) {
        conceptCounts[problem.concept] = (conceptCounts[problem.concept] || 0) + 1;
      }
    });

    Object.entries(conceptCounts).forEach(([concept, count]) => {
      if (count >= 2 && !seenConcepts.has(concept.toLowerCase())) {
        seenConcepts.add(concept.toLowerCase());
        weaknesses.push({
          concept: `복습 필요: ${concept}`,
          category: 'concept',
          severity: count >= 3 ? 4 : 3,
        });
      }
    });
  }

  return weaknesses;
}

/**
 * 월간 리포트 데이터에서 강점 추출
 */
function extractStrengthsFromMonthly(data: MonthlyReportData): ExtractedStrength[] {
  const strengths: ExtractedStrength[] = [];
  const seenConcepts = new Set<string>();

  // 1. learningContent에서 'excellent' 평가 항목 추출
  if (data.learningContent) {
    data.learningContent.forEach(item => {
      if (item.evaluation === 'excellent' && item.topic && !seenConcepts.has(item.topic.toLowerCase())) {
        seenConcepts.add(item.topic.toLowerCase());
        strengths.push({
          concept: item.topic,
          category: 'concept',
          level: 4,
        });
      }
    });
  }

  // 2. whatWentWell에서 추출
  if (data.whatWentWell) {
    data.whatWentWell.forEach(item => {
      if (item && !seenConcepts.has(item.toLowerCase())) {
        seenConcepts.add(item.toLowerCase());
        strengths.push({
          concept: item,
          category: categorizeStrengthText(item),
          level: 3,
        });
      }
    });
  }

  return strengths;
}

/**
 * 텍스트 기반 취약점 카테고리 분류
 */
function categorizeWeaknessText(text: string): WeaknessCategory {
  const lower = text.toLowerCase();
  if (lower.includes('계산') || lower.includes('연산')) return 'calculation';
  if (lower.includes('응용') || lower.includes('활용') || lower.includes('문장제')) return 'application';
  if (lower.includes('독해') || lower.includes('이해') || lower.includes('해석')) return 'reading';
  if (lower.includes('습관') || lower.includes('태도') || lower.includes('집중')) return 'habit';
  return 'concept';
}

/**
 * 텍스트 기반 강점 카테고리 분류
 */
function categorizeStrengthText(text: string): StrengthCategory {
  const lower = text.toLowerCase();
  if (lower.includes('계산') || lower.includes('연산')) return 'calculation';
  if (lower.includes('응용') || lower.includes('활용')) return 'application';
  if (lower.includes('독해') || lower.includes('이해')) return 'reading';
  if (lower.includes('창의') || lower.includes('새로운')) return 'creativity';
  return 'concept';
}

/**
 * 월간 리포트에서 학생 프로필 업데이트
 */
export async function updateStudentProfileFromMonthly(
  studentId: number,
  reportId: number,
  monthlyData: MonthlyReportData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();

    // 취약점 추출 및 업데이트
    const extractedWeaknesses = extractWeaknessesFromMonthly(monthlyData);
    await processWeaknesses(supabase, studentId, reportId, extractedWeaknesses, now);

    // 강점 추출 및 업데이트
    const extractedStrengths = extractStrengthsFromMonthly(monthlyData);
    await processStrengths(supabase, studentId, reportId, extractedStrengths, now);

    return { success: true };
  } catch (error) {
    console.error('월간 리포트 프로필 업데이트 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 주간 리포트 데이터에서 취약점 추출
 */
function extractWeaknessesFromWeekly(data: WeeklyReportData): ExtractedWeakness[] {
  const weaknesses: ExtractedWeakness[] = [];
  const seenConcepts = new Set<string>();

  // 1. learningContent에서 'not_good' 평가 항목 추출
  if (data.learningContent) {
    data.learningContent.forEach(item => {
      if (item.evaluation === 'not_good' && item.topic && !seenConcepts.has(item.topic.toLowerCase())) {
        seenConcepts.add(item.topic.toLowerCase());
        weaknesses.push({
          concept: item.topic,
          category: 'concept',
          severity: 2, // 주간은 월간보다 낮은 심각도
        });
      }
    });
  }

  // 2. improvements에서 추출
  if (data.improvements) {
    data.improvements.forEach(item => {
      if (item && !seenConcepts.has(item.toLowerCase())) {
        seenConcepts.add(item.toLowerCase());
        weaknesses.push({
          concept: item,
          category: categorizeWeaknessText(item),
          severity: 2,
        });
      }
    });
  }

  // 3. reviewProblems에서 추출
  if (data.reviewProblems && data.reviewProblems.length >= 3) {
    weaknesses.push({
      concept: `이번 주 복습 필요 문제 ${data.reviewProblems.length}개`,
      category: 'concept',
      severity: 2,
    });
  }

  return weaknesses;
}

/**
 * 주간 리포트 데이터에서 강점 추출
 */
function extractStrengthsFromWeekly(data: WeeklyReportData): ExtractedStrength[] {
  const strengths: ExtractedStrength[] = [];
  const seenConcepts = new Set<string>();

  // 1. learningContent에서 'excellent' 평가 항목 추출
  if (data.learningContent) {
    data.learningContent.forEach(item => {
      if (item.evaluation === 'excellent' && item.topic && !seenConcepts.has(item.topic.toLowerCase())) {
        seenConcepts.add(item.topic.toLowerCase());
        strengths.push({
          concept: item.topic,
          category: 'concept',
          level: 3,
        });
      }
    });
  }

  // 2. achievements에서 추출
  if (data.achievements) {
    data.achievements.forEach(item => {
      if (item && !seenConcepts.has(item.toLowerCase())) {
        seenConcepts.add(item.toLowerCase());
        strengths.push({
          concept: item,
          category: categorizeStrengthText(item),
          level: 3,
        });
      }
    });
  }

  return strengths;
}

/**
 * 주간 리포트에서 학생 프로필 업데이트
 */
export async function updateStudentProfileFromWeekly(
  studentId: number,
  reportId: number,
  weeklyData: WeeklyReportData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();

    // 취약점 추출 및 업데이트
    const extractedWeaknesses = extractWeaknessesFromWeekly(weeklyData);
    await processWeaknesses(supabase, studentId, reportId, extractedWeaknesses, now);

    // 강점 추출 및 업데이트
    const extractedStrengths = extractStrengthsFromWeekly(weeklyData);
    await processStrengths(supabase, studentId, reportId, extractedStrengths, now);

    return { success: true };
  } catch (error) {
    console.error('주간 리포트 프로필 업데이트 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 통합 리포트 데이터에서 취약점 추출
 * (선생님이 수동으로 입력한 통합 분석에서 추출)
 */
function extractWeaknessesFromConsolidated(data: ConsolidatedReportData): ExtractedWeakness[] {
  const weaknesses: ExtractedWeakness[] = [];
  const seenConcepts = new Set<string>();

  // 1. consolidatedQualitative.macroAnalysis.weaknesses에서 추출
  if (data.consolidatedQualitative?.macroAnalysis?.weaknesses) {
    const weaknessText = data.consolidatedQualitative.macroAnalysis.weaknesses;
    const concepts = parseConceptsFromText(weaknessText);
    concepts.forEach(concept => {
      if (!seenConcepts.has(concept.toLowerCase())) {
        seenConcepts.add(concept.toLowerCase());
        weaknesses.push({
          concept,
          category: categorizeWeaknessText(concept),
          severity: 4, // 통합 분석에서의 취약점은 더 높은 심각도
        });
      }
    });
  }

  // 2. actionablePrescription에서 '개념 교정' 타입 추출
  if (data.consolidatedQualitative?.actionablePrescription) {
    data.consolidatedQualitative.actionablePrescription.forEach(item => {
      if (item.type === '개념 교정' && item.title && !seenConcepts.has(item.title.toLowerCase())) {
        seenConcepts.add(item.title.toLowerCase());
        weaknesses.push({
          concept: item.title,
          category: 'concept',
          severity: item.priority === 1 ? 5 : item.priority === 2 ? 4 : 3,
        });
      }
    });
  }

  return weaknesses;
}

/**
 * 통합 리포트 데이터에서 강점 추출
 */
function extractStrengthsFromConsolidated(data: ConsolidatedReportData): ExtractedStrength[] {
  const strengths: ExtractedStrength[] = [];
  const seenConcepts = new Set<string>();

  // consolidatedQualitative.macroAnalysis.strengths에서 추출
  if (data.consolidatedQualitative?.macroAnalysis?.strengths) {
    const strengthText = data.consolidatedQualitative.macroAnalysis.strengths;
    const concepts = parseConceptsFromText(strengthText);
    concepts.forEach(concept => {
      if (!seenConcepts.has(concept.toLowerCase())) {
        seenConcepts.add(concept.toLowerCase());
        strengths.push({
          concept,
          category: categorizeStrengthText(concept),
          level: 4, // 통합 분석에서의 강점은 더 높은 레벨
        });
      }
    });
  }

  return strengths;
}

/**
 * 통합 리포트에서 학생 프로필 업데이트
 */
export async function updateStudentProfileFromConsolidated(
  studentId: number,
  reportId: number,
  consolidatedData: ConsolidatedReportData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();

    // 취약점 추출 및 업데이트
    const extractedWeaknesses = extractWeaknessesFromConsolidated(consolidatedData);
    await processWeaknesses(supabase, studentId, reportId, extractedWeaknesses, now);

    // 강점 추출 및 업데이트
    const extractedStrengths = extractStrengthsFromConsolidated(consolidatedData);
    await processStrengths(supabase, studentId, reportId, extractedStrengths, now);

    return { success: true };
  } catch (error) {
    console.error('통합 리포트 프로필 업데이트 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}
