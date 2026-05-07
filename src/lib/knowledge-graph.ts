/**
 * 초미세 스킬 (Micro-skill) 지식 그래프 유틸리티
 * 
 * 큰 단원(예: 이차방정식)을 쪼갠 미세 스킬 간의 선수학습(Prerequisite) 관계를 매핑합니다.
 * 오답 발생 시 이전 단계의 어떤 미세 스킬 누락에서 기인했는지 역추적하는 기능을 제공합니다.
 */

export interface MicroSkill {
  id: string;
  name: string;
  unitId: string; // 소속된 큰 단원 ID
  prerequisites: string[]; // 선수 스킬 ID 목록
  description: string;
}

// 예시 데이터: 실제 운영 환경에서는 데이터베이스에서 불러오거나 더 큰 구조를 가질 수 있습니다.
export const KNOWLEDGE_GRAPH: Record<string, MicroSkill> = {
  // --- 중학 수학 예시: 이차방정식 ---
  'eq2-01': {
    id: 'eq2-01',
    name: '이차방정식의 뜻과 형태',
    unitId: 'unit-eq2',
    prerequisites: ['poly-01'], // 다항식의 이해 필요
    description: 'ax^2 + bx + c = 0 (a ≠ 0) 형태를 이해하고 식별할 수 있다.'
  },
  'eq2-02': {
    id: 'eq2-02',
    name: '인수분해를 이용한 이차방정식의 풀이',
    unitId: 'unit-eq2',
    prerequisites: ['eq2-01', 'factor-01', 'factor-02'], // 이차방정식의 뜻, 공통인수 묶기, 기본 인수분해 공식 필요
    description: 'AB = 0 이면 A = 0 또는 B = 0 임을 이용하여 해를 구한다.'
  },
  'eq2-03': {
    id: 'eq2-03',
    name: '완전제곱식을 이용한 이차방정식의 풀이',
    unitId: 'unit-eq2',
    prerequisites: ['eq2-01', 'poly-02'], // 완전제곱식 전개/인수분해 필요
    description: '(x - p)^2 = q 형태에서 제곱근을 이용하여 해를 구한다.'
  },
  'eq2-04': {
    id: 'eq2-04',
    name: '이차방정식의 근의 공식',
    unitId: 'unit-eq2',
    prerequisites: ['eq2-03'], // 완전제곱식을 이용한 풀이 원리 이해 필요
    description: '근의 공식을 암기하고, 계수를 대입하여 빠르고 정확하게 해를 구한다.'
  },
  'eq2-05': {
    id: 'eq2-05',
    name: '복잡한 식의 이차방정식 풀이',
    unitId: 'unit-eq2',
    prerequisites: ['eq2-02', 'eq2-04'], // 인수분해, 근의 공식 모두 능숙해야 함
    description: '괄호가 있거나 계수가 소수/분수인 복잡한 식을 전개/정리하여 표준형으로 만든 후 해를 구한다.'
  },
  
  // 선수 스킬들 (단순화된 예시)
  'poly-01': { id: 'poly-01', name: '다항식과 단항식', unitId: 'unit-poly', prerequisites: [], description: '다항식의 기본 개념' },
  'poly-02': { id: 'poly-02', name: '완전제곱식 전개', unitId: 'unit-poly', prerequisites: ['poly-01'], description: '(a+b)^2 = a^2+2ab+b^2' },
  'factor-01': { id: 'factor-01', name: '공통인수로 묶기', unitId: 'unit-factor', prerequisites: ['poly-01'], description: 'ma + mb = m(a+b)' },
  'factor-02': { id: 'factor-02', name: '이차식의 인수분해', unitId: 'unit-factor', prerequisites: ['factor-01'], description: 'x^2+(a+b)x+ab = (x+a)(x+b)' },
};

/**
 * 특정 미세 스킬의 오답 원인이 될 수 있는 선수 스킬(Prerequisites)을 역추적하여 반환합니다.
 * @param skillId 틀린 미세 스킬의 ID
 * @param depth 역추적할 깊이 (기본값: 1단계 전까지만)
 * @returns 선수 스킬 목록
 */
export function tracePrerequisites(skillId: string, depth: number = 1): MicroSkill[] {
  const result: MicroSkill[] = [];
  const visited = new Set<string>();

  function traverse(currentId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(currentId)) return;
    visited.add(currentId);

    const skill = KNOWLEDGE_GRAPH[currentId];
    if (!skill) return;

    if (currentId !== skillId) { // 시작 노드는 결과에 포함하지 않음
      result.push(skill);
    }

    if (currentDepth < depth) {
      for (const reqId of skill.prerequisites) {
        traverse(reqId, currentDepth + 1);
      }
    }
  }

  traverse(skillId, 0);
  return result;
}

/**
 * 프롬프트 주입용 지식 추적 컨텍스트를 생성합니다.
 * AI가 어떤 하위 스킬의 결손을 의심해야 하는지 힌트를 제공합니다.
 */
export function generateKnowledgeTracingContext(failedSkillIds: string[]): string {
  if (!failedSkillIds || failedSkillIds.length === 0) return '';

  let context = '### 지식 추적 (Knowledge Tracing) 컨텍스트\n';
  context += '학생이 틀린 문제의 핵심 미세 스킬과 관련된 선수학습(Prerequisites) 목록입니다. 오답 원인을 분석할 때 이 중 어떤 하위 스킬이 누락되었는지 확인하세요.\n\n';

  const processed = new Set<string>();

  for (const skillId of failedSkillIds) {
    if (processed.has(skillId)) continue;
    processed.add(skillId);

    const skill = KNOWLEDGE_GRAPH[skillId];
    if (skill) {
      const prerequisites = tracePrerequisites(skillId, 1); // 1단계 선수 스킬만
      if (prerequisites.length > 0) {
        const reqNames = prerequisites.map(p => \`[\${p.name}]\`).join(', ');
        context += \`- 틀린 스킬: [\${skill.name}]\n\`;
        context += \`  👉 역추적 의심 하위 스킬: \${reqNames}에 대한 결손이 없는지 점검하세요.\n\`;
      }
    }
  }

  return context;
}
