/**
 * 임베딩 텍스트 추출기
 *
 * AnalysisData에서 의미 있는 텍스트를 추출해 임베딩 대상 목록을 반환합니다.
 * 각 리포트 유형에서 가장 정보 밀도 높은 필드를 우선 추출합니다.
 */

import type { AnalysisData } from '@/types';

export interface EmbeddableChunk {
  sourceType: 'summary' | 'weakness' | 'strength' | 'errorPattern' | 'prescription' | 'combined';
  text: string;
}

/**
 * AnalysisData에서 임베딩 대상 텍스트 추출
 * - 최대 8개 청크로 제한 (DB 부하 + 토큰 비용 관리)
 */
export function extractEmbeddableTexts(analysisData: AnalysisData): EmbeddableChunk[] {
  const chunks: EmbeddableChunk[] = [];
  const macro = analysisData.macroAnalysis;

  // 1. 전체 요약 (combined) — 가장 중요, 항상 포함
  const summaryParts: string[] = [];
  if (macro?.oneLineSummary) summaryParts.push(macro.oneLineSummary);
  if (macro?.summary) summaryParts.push(macro.summary.slice(0, 300));
  if (macro?.analysisMessage) summaryParts.push(macro.analysisMessage.slice(0, 200));

  if (summaryParts.length > 0) {
    chunks.push({ sourceType: 'summary', text: summaryParts.join(' | ') });
  }

  // 2. 취약점
  if (macro?.weaknesses) {
    const text = macro.weaknesses.slice(0, 400);
    if (text.trim()) chunks.push({ sourceType: 'weakness', text });
  }

  // 3. 오류 패턴
  if (macro?.errorPattern) {
    const text = macro.errorPattern.slice(0, 400);
    if (text.trim()) chunks.push({ sourceType: 'errorPattern', text });
  }

  // 4. 강점
  if (macro?.strengths) {
    const text = macro.strengths.slice(0, 300);
    if (text.trim()) chunks.push({ sourceType: 'strength', text });
  }

  // 5. 실행 처방 (상위 3개)
  const prescriptions = analysisData.actionablePrescription ?? [];
  const topPrescriptions = prescriptions
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
    .slice(0, 3);

  for (const p of topPrescriptions) {
    const text = [p.title, p.description].filter(Boolean).join(': ').slice(0, 300);
    if (text.trim()) {
      chunks.push({ sourceType: 'prescription', text });
    }
  }

  // 6. combined — summary + weakness + errorPattern 통합 (의미 밀도 최고)
  const combinedParts: string[] = [];
  if (macro?.oneLineSummary) combinedParts.push(macro.oneLineSummary);
  if (macro?.weaknesses) combinedParts.push(macro.weaknesses.slice(0, 200));
  if (macro?.errorPattern) combinedParts.push(macro.errorPattern.slice(0, 150));

  if (combinedParts.length >= 2) {
    chunks.push({
      sourceType: 'combined',
      text: combinedParts.join(' / '),
    });
  }

  return chunks.slice(0, 8);
}

/**
 * 주간/월간/반기/연간 리포트 등 다양한 타입의 AnalysisData에서 공통 추출
 * (분석 데이터가 AnalysisData와 다른 구조일 경우 안전하게 처리)
 */
export function extractEmbeddableTextsFromAny(
  data: Record<string, unknown>
): EmbeddableChunk[] {
  const chunks: EmbeddableChunk[] = [];

  // macroAnalysis 계층
  const macro = data.macroAnalysis as Record<string, string> | undefined;
  if (macro?.summary) {
    chunks.push({ sourceType: 'summary', text: macro.summary.slice(0, 400) });
  }
  if (macro?.oneLineSummary) {
    chunks.push({ sourceType: 'summary', text: macro.oneLineSummary });
  }
  if (macro?.weaknesses) {
    chunks.push({ sourceType: 'weakness', text: macro.weaknesses.slice(0, 400) });
  }
  if (macro?.errorPattern) {
    chunks.push({ sourceType: 'errorPattern', text: macro.errorPattern.slice(0, 400) });
  }
  if (macro?.strengths) {
    chunks.push({ sourceType: 'strength', text: macro.strengths.slice(0, 300) });
  }

  // 주간 리포트 specific: learningContent
  const weekly = data as Record<string, unknown>;
  const whatWentWell = weekly.whatWentWell as string | undefined;
  const improvements = weekly.improvements as string | undefined;
  if (whatWentWell) chunks.push({ sourceType: 'strength', text: whatWentWell.slice(0, 300) });
  if (improvements) chunks.push({ sourceType: 'weakness', text: improvements.slice(0, 300) });

  return chunks.slice(0, 8);
}
