'use client';

import React, { memo } from 'react';
import katex from 'katex';

/**
 * KaTeX 기반 수식 렌더링 유틸리티
 *
 * 2단계 처리:
 * 1. $...$ 델리미터가 있으면 → KaTeX로 직접 렌더링
 * 2. Plain-text 수식 패턴 → LaTeX로 자동 변환 후 렌더링
 *
 * @see docs/CODEX_REVIEW_FEEDBACK.md Phase 13
 */

// ============================================
// 1. Plain-text → LaTeX 변환 (휴리스틱)
// ============================================

/**
 * Plain-text 수식 패턴을 LaTeX로 변환합니다.
 * 보수적 접근: 오탐보다 미탐이 안전합니다.
 */
export function convertPlainMathToLatex(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // 이미 $...$로 래핑된 부분은 보호
  const protected_parts: string[] = [];
  result = result.replace(/\$[^$]+\$/g, (match) => {
    protected_parts.push(match);
    return `__MATH_PROTECTED_${protected_parts.length - 1}__`;
  });

  // 규칙 1: 괄호 분수 — (분자) / (분모) → $\frac{분자}{분모}$
  result = result.replace(
    /\(([^)]+)\)\s*[/÷]\s*\(([^)]+)\)/g,
    (_, num, den) => `$\\frac{${num.trim()}}{${den.trim()}}$`
  );

  // 규칙 2: 간단한 분수 — A/B (A, B가 수식일 때) → $\frac{A}{B}$
  // 단, 한국어 문맥의 "3/4분기", "1/2 이상" 등은 제외
  result = result.replace(
    /(?<![가-힣a-zA-Z])(-?\d+[a-zA-Z^0-9]*)\s*\/\s*(-?\d+[a-zA-Z^0-9]*)(?![가-힣분기이상])/g,
    (_, num, den) => `$\\frac{${num}}{${den}}$`
  );

  // 규칙 3: 지수 표현 — x^2, x^{10}, 5^2 등 → $x^2$
  result = result.replace(
    /(?<!\$)(?<![가-힣])(\b\d*[a-zA-Z]?\d*)\^(\{[^}]+\}|\d+)(?!\$)/g,
    (_, base, exp) => `$${base}^{${exp.replace(/[{}]/g, '')}}$`
  );

  // 규칙 4: 곱하기 기호 * → × (수식 문맥일 때)
  result = result.replace(
    /(\d+)\s*\*\s*(\d+)/g,
    (_, a, b) => `$${a} \\times ${b}$`
  );

  // 규칙 5: 루트 — sqrt(x), √x → $\sqrt{x}$
  result = result.replace(
    /sqrt\(([^)]+)\)|√(\d+[a-zA-Z]*)/g,
    (_, inside, num) => `$\\sqrt{${inside || num}}$`
  );

  // 규칙 6: 절대값 — |x+3| → $|x+3|$
  result = result.replace(
    /\|([^|]*[a-zA-Z^+\-*/][^|]*)\|/g,
    (_, content) => `$|${content}|$`
  );

  // 규칙 7: 변수를 포함한 수식 표현 — 2x+3y-5, 3a^2+b 등
  // 조건: 반드시 변수(알파벳) + 연산자(+,-) + 숫자/변수 조합이어야 함
  // 한국어 글자 앞뒤로는 변환하지 않음
  result = result.replace(
    /(?<![가-힣$])(-?\d*[a-zA-Z]+\^?\d*(?:\s*[+\-]\s*\d*[a-zA-Z]*\^?\d*){2,})(?![가-힣$])/g,
    (match) => {
      // 한국어가 섞여있으면 스킵
      if (/[가-힣]/.test(match)) return match;
      // 너무 짧으면 스킵 (x+y 같은 건 보통 수식이 아닌 경우가 많음)
      if (match.replace(/\s/g, '').length < 5) return match;
      return `$${match.trim()}$`;
    }
  );

  // 보호된 부분 복원
  protected_parts.forEach((part, i) => {
    result = result.replace(`__MATH_PROTECTED_${i}__`, part);
  });

  // 인접한 $$ 합치기 (예: $x^2$ + $3x$ → $x^2 + 3x$는 의미가 달라 하지 않음)
  return result;
}

// ============================================
// 2. KaTeX 렌더링
// ============================================

/**
 * LaTeX 문자열을 HTML로 변환합니다.
 * 실패 시 원본 텍스트를 반환하여 에러를 방지합니다.
 */
function renderLatexToHtml(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: false,
      trust: true,
      output: 'html',
    });
  } catch {
    // 렌더링 실패 시 원본 반환
    return latex;
  }
}

// ============================================
// 3. 텍스트 → React 노드 변환 (메인 함수)
// ============================================

/**
 * 텍스트 내의 $...$ 수식을 KaTeX로 렌더링된 React 노드로 변환합니다.
 * $...$가 없으면 원본 문자열을 그대로 반환합니다.
 */
export function renderMathInText(text: string): React.ReactNode[] {
  if (!text || typeof text !== 'string') return [text];

  // 먼저 plain-text 수식을 LaTeX로 변환
  const converted = convertPlainMathToLatex(text);

  // $...$가 없으면 원본 반환
  if (!converted.includes('$')) {
    return [converted];
  }

  // $...$ 기준으로 분리
  const parts = converted.split(/(\$[^$]+\$)/g);

  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const latex = part.slice(1, -1);
      const html = renderLatexToHtml(latex);
      return (
        <span
          key={`math-${index}`}
          className="katex-inline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
}

/**
 * 텍스트에 수식이 포함되어 있는지 빠르게 확인합니다.
 */
export function hasMathContent(text: string): boolean {
  if (!text) return false;
  // $...$ 델리미터 확인
  if (/\$[^$]+\$/.test(text)) return true;
  // plain-text 수식 패턴 확인 (가벼운 체크)
  if (/\^[\d{]/.test(text)) return true;
  if (/\([^)]+\)\s*\/\s*\(/.test(text)) return true;
  if (/\d+\s*\*\s*\d+/.test(text)) return true;
  return false;
}

/**
 * KaTeX 인라인 수식을 렌더링하는 React 컴포넌트.
 * 단독 수식 블록으로 사용할 때 유용합니다.
 */
export const MathBlock = memo(function MathBlock({
  latex,
  display = false,
  className = '',
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      strict: false,
      trust: true,
      output: 'html',
    });

    return (
      <span
        className={`${display ? 'katex-display' : 'katex-inline'} ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <span className={className}>{latex}</span>;
  }
});
