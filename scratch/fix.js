const fs = require('fs');
const path = 'src/lib/gemini.ts';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const newBlock = [
    "${context.recentReports.map((r, i) =>",
    "      `${i + 1}. [${r.type}] ${r.date} - ${r.title}\\n   - 주요 메시지: ${r.summary}\\n   - 핵심 성취: ${r.keyAchievements?.join(', ') || '없음'}\\n   - 보완 필요: ${r.weaknesses?.join(', ') || '없음'}`",
    "    ).join('\\n')}`);",
    "  }",
    "",
    "  // 3. 성장 루프 시스템 피드백",
    "  if (context.systemFeedback) {",
    "    const sf = context.systemFeedback;",
    "    const feedbackParts = [];",
    "",
    "    // 효과적인 전략",
    "    if (sf.effectiveStrategies && sf.effectiveStrategies.length > 0) {",
    "      const es = sf.effectiveStrategies;",
    "      feedbackParts.push(`### 가장 효과적이었던 전략 (유지 권장)",
    "${es.slice(0, 5).map((s, i) =>",
    "        `${i + 1}. **${s.type}**: ${s.title}",
    "   - 평균 개선율: ${s.avgImprovement}%, 성공률: ${s.successRate}%",
    "   - 적용 횟수: ${s.usageCount}회${s.concept ? `, 관련 개념: ${s.concept}` : ''}`",
    "      ).join('\\n')}`);",
    "    }"
];

// replace lines 326 to 332 (index 325 to 331)
lines.splice(325, 7, ...newBlock);
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed gemini.ts');
