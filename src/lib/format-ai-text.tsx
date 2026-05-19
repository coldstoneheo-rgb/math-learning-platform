import React from 'react';
import { renderMathInText, hasMathContent } from './math-renderer';

/**
 * AI가 생성한 긴 텍스트를 가독성 높은 문단으로 분리하여 렌더링합니다.
 *
 * 분리 기준:
 * 1. 줄바꿈(\n) → 무조건 문단 분리
 * 2. 마침표 + 공백('. ') → 문장 단위 분리 (3문장 이상일 때만)
 * 3. 쉼표로 나열된 항목 → bullet list 변환 (선택적)
 *
 * @see docs/CODEX_REVIEW_FEEDBACK.md Phase 10
 */

/** 텍스트를 문단 배열로 분리 */
export function splitAITextIntoParagraphs(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // 1차: 줄바꿈 기준 분리
  const byNewline = text.split(/\n+/).map(s => s.trim()).filter(Boolean);

  // 줄바꿈으로 이미 2개 이상 분리되면 그대로 사용
  if (byNewline.length >= 2) return byNewline;

  // 2차: 마침표 기준 분리 (한국어: '. ' 또는 '다. ', '요. ' 등)
  const sentences = text
    .split(/(?<=[\.\!\?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // 3문장 이상이면 2~3문장씩 묶어서 문단화
  if (sentences.length >= 3) {
    const paragraphs: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const chunk = sentences.slice(i, i + 2).join(' ');
      paragraphs.push(chunk);
    }
    return paragraphs;
  }

  // 분리할 게 없으면 원본 반환
  return [text];
}

/** 텍스트를 30자 이내로 truncate */
export function truncateText(text: string, maxLength: number = 30): string {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

interface FormatAITextProps {
  /** AI가 생성한 원본 텍스트 */
  text: string | undefined | null;
  /** 텍스트 스타일 className (각 문단에 적용) */
  className?: string;
  /** bullet point 스타일로 렌더링할지 여부 */
  asBullets?: boolean;
}

/** 텍스트 내 키워드 하이라이트 (따옴표/괄호 안 텍스트를 강조) */
function highlightKeywords(text: string): React.ReactNode[] {
  // 「」, '', "", ** 안의 텍스트를 bold로
  const parts = text.split(/(「[^」]+」|'[^']+'|"[^"]+"|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^[「'"\*\*]/.test(part) && /[」'"\*\*]$/.test(part)) {
      const inner = part.replace(/^[「'"\*\*]+|[」'"\*\*]+$/g, '');
      return <span key={i} className="font-semibold text-gray-900">{inner}</span>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/**
 * 텍스트를 처리하는 통합 파이프라인:
 * 1. 수식 감지 + KaTeX 렌더링
 * 2. 키워드 하이라이트
 *
 * 수식이 포함된 경우 수식 부분은 KaTeX로, 나머지는 키워드 하이라이트로 처리합니다.
 */
function processTextNode(text: string): React.ReactNode[] {
  if (hasMathContent(text)) {
    // 수식이 있으면 먼저 수식 처리 (수식 부분은 이미 React 노드로 변환됨)
    const mathNodes = renderMathInText(text);
    return mathNodes.flatMap((node, i) => {
      // 문자열 부분만 키워드 하이라이트 적용
      if (typeof node === 'string') {
        return highlightKeywords(node);
      }
      return [node];
    });
  }
  // 수식이 없으면 키워드 하이라이트만
  return highlightKeywords(text);
}

/** 번호 패턴 감지 (1), 2), ①, - 등) */
const NUMBERED_PATTERN = /^(?:\d+[).\]]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*|[-·•]\s+)/;

/**
 * AI 생성 텍스트를 가독성 높게 렌더링하는 컴포넌트.
 *
 * @example
 * // Before: <p className="text-gray-700">{analysis.summary}</p>
 * // After:  <FormatAIText text={analysis.summary} className="text-gray-700" />
 */
export function FormatAIText({ text, className = '', asBullets = false }: FormatAITextProps) {
  if (!text) return null;

  const paragraphs = splitAITextIntoParagraphs(text);

  if (paragraphs.length === 0) return null;

  // 번호 패턴이 있는 항목들을 리스트로 분리
  const hasNumberedItems = paragraphs.some(p => NUMBERED_PATTERN.test(p));

  // 단일 문단이면 그냥 <p> 렌더링
  if (paragraphs.length === 1 && !asBullets && !hasNumberedItems) {
    return <p className={`leading-relaxed ${className}`}>{processTextNode(paragraphs[0])}</p>;
  }

  if (asBullets || hasNumberedItems) {
    const items: { isListItem: boolean; text: string }[] = paragraphs.map(p => ({
      isListItem: NUMBERED_PATTERN.test(p),
      text: p.replace(NUMBERED_PATTERN, '').trim(),
    }));

    return (
      <div className={`space-y-2 ${className}`}>
        {items.map((item, i) =>
          item.isListItem ? (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-40" />
              <span>{processTextNode(item.text)}</span>
            </div>
          ) : (
            <p key={i} className="leading-relaxed">{processTextNode(item.text)}</p>
          )
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="leading-relaxed">{processTextNode(p)}</p>
      ))}
    </div>
  );
}

/**
 * 문항별 분석의 analysis 텍스트를 5단계 플로우로 파싱합니다.
 *
 * AI가 생성하는 analysis 텍스트는 대략 아래 플로우를 따릅니다:
 * 1) 출발점 → 2) 풀이 진행 과정 → 3) 계산 및 실수 패턴 → 4) 문제 해석 능력 → 5) 풀이 습관
 */
export interface AnalysisStep {
  label: string;
  emoji: string;
  content: string;
}

const STEP_LABELS: { label: string; emoji: string }[] = [
  { label: '출발점', emoji: '🎯' },
  { label: '풀이 과정', emoji: '📝' },
  { label: '계산 패턴', emoji: '🔢' },
  { label: '문제 해석', emoji: '🔍' },
  { label: '풀이 습관', emoji: '💡' },
];

export function parseAnalysisToSteps(analysis: string): AnalysisStep[] {
  if (!analysis || typeof analysis !== 'string') return [];

  // 마침표 기준으로 문장 분리
  const sentences = analysis
    .split(/(?<=[\.\!\?])\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (sentences.length === 0) {
    return [{ ...STEP_LABELS[0], content: analysis }];
  }

  // 5문장 이상이면 균등 배분, 미만이면 가용 단계만 사용
  const steps: AnalysisStep[] = [];
  const stepCount = Math.min(sentences.length, 5);
  const chunkSize = Math.ceil(sentences.length / stepCount);

  for (let i = 0; i < stepCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, sentences.length);
    const content = sentences.slice(start, end).join(' ');

    steps.push({
      ...STEP_LABELS[i],
      content,
    });
  }

  return steps;
}
