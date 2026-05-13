/**
 * Gemini 임베딩 서비스
 *
 * text-embedding-004 모델을 사용해 텍스트를 768차원 벡터로 변환합니다.
 * 이미 설치된 @google/genai SDK를 재사용합니다.
 */

import { GoogleGenAI } from '@google/genai';

const EMBEDDING_MODEL = 'text-embedding-004';

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

/**
 * 단일 텍스트 → 768차원 벡터
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const normalizedText = normalizeText(text);

  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: normalizedText,
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('임베딩 생성 실패: 빈 응답');
  }
  return values;
}

/**
 * 복수 텍스트 배치 임베딩 (순차 처리, rate limit 고려)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  delayMs = 50
): Promise<number[][]> {
  const results: number[][] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    results.push(embedding);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

/**
 * 긴 텍스트를 의미 단위로 분할 (최대 500자)
 * 문장 경계를 존중하는 청킹
 */
export function chunkText(text: string, maxLen = 500): string[] {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  const sentences = normalized.split(/(?<=[.!?。])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [normalized.slice(0, maxLen)];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 2000);
}
