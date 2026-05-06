/**
 * 예방적 분석 (Predictive Analysis) 유틸리티
 * 
 * 에빙하우스 망각 곡선(Ebbinghaus Forgetting Curve) 기반 모델
 * $R = e^{-t/S}$
 * R: 기억 유지율 (Retention)
 * t: 학습 후 경과 시간 (Days)
 * S: 기억의 상대적 강도 (Strength of memory)
 */

export interface MasteredSkillRecord {
  skillId: string;
  skillName: string;
  lastMasteredDate: string; // ISO date string
  memoryStrength: number; // 1~10 (복습 횟수나 이전 성취도에 따라 증가)
}

/**
 * 에빙하우스 망각 곡선을 기반으로 현재 시점의 '잊어버릴 확률'을 계산합니다.
 * @param lastMasteredDate 마지막으로 해당 스킬을 마스터(복습)한 날짜
 * @param memoryStrength 기억의 상대적 강도 (기본값: 1, 복습할수록 수치 증가)
 * @returns 망각 확률 (0 ~ 100의 퍼센티지)
 */
export function calculateForgettingProbability(
  lastMasteredDate: string | Date,
  memoryStrength: number = 1
): number {
  const lastDate = new Date(lastMasteredDate);
  const now = new Date();
  
  // 경과 시간(일) 계산
  const diffTime = Math.abs(now.getTime() - lastDate.getTime());
  const t = diffTime / (1000 * 60 * 60 * 24); 

  if (t < 0) return 0; // 미래 날짜 방어 로직
  
  // 기억 유지율 계산 (Retention = e^(-t/S))
  // S값이 커질수록(기억 강도가 셀수록) e의 지수가 0에 가까워져 R이 1(100%)에 수렴.
  const retention = Math.exp(-t / memoryStrength);
  
  // 망각 확률 = (1 - 유지율) * 100
  const forgettingProbability = (1 - retention) * 100;
  
  return Math.max(0, Math.min(100, forgettingProbability)); // 0~100 사이 값 보장
}

/**
 * 망각 확률 임계치를 초과한 취약 예상 스킬 목록을 추출합니다.
 */
export function getSkillsAtRisk(
  masteredSkills: MasteredSkillRecord[],
  threshold: number = 80
): Array<MasteredSkillRecord & { forgettingProbability: number }> {
  return masteredSkills
    .map(skill => ({
      ...skill,
      forgettingProbability: calculateForgettingProbability(skill.lastMasteredDate, skill.memoryStrength)
    }))
    .filter(skill => skill.forgettingProbability >= threshold)
    .sort((a, b) => b.forgettingProbability - a.forgettingProbability);
}

/**
 * 프롬프트 주입용 예방적 분석(망각 곡선) 컨텍스트를 생성합니다.
 * AI가 리포트 생성 시 "이 개념을 지금 복습하지 않으면 잊어버릴 위험이 높다"고 선제적으로 컨설팅하게 합니다.
 */
export function generatePredictiveAnalysisContext(masteredSkills: MasteredSkillRecord[]): string {
  const skillsAtRisk = getSkillsAtRisk(masteredSkills, 75); // 75% 이상이면 경고

  if (skillsAtRisk.length === 0) return '';

  let context = '### 망각 곡선 기반 예방적 분석 (Predictive Warning)\n';
  context += '과거에 마스터했으나 현재 망각이 진행되어 즉각적인 복습이 필요한 개념 목록입니다. 분석 리포트의 [개선 전략]이나 [다음 계획]에 선제적 복습을 강하게 권고하세요.\n\n';

  skillsAtRisk.slice(0, 3).forEach(skill => {
    const p = Math.round(skill.forgettingProbability);
    context += \`- 경고 개념: [\${skill.skillName}]\n\`;
    context += \`  👉 마지막 학습일: \${new Date(skill.lastMasteredDate).toLocaleDateString()}, 현재 망각 확률: \${p}%\n\`;
    context += \`  👉 AI 가이드: "과거 극복했던 [\${skill.skillName}] 개념, 지금 복습하지 않으면 잊어버릴 확률이 \${p}%입니다"와 같은 선제적 컨설팅 문구를 포함하세요.\n\`;
  });

  return context;
}
