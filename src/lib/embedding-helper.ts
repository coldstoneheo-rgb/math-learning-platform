/**
 * 임베딩 인덱싱 헬퍼
 *
 * 리포트 저장 후 fire-and-forget으로 임베딩을 인덱싱합니다.
 * 에러가 발생해도 리포트 저장 흐름에 영향을 주지 않습니다.
 */

interface IndexResult {
  success: boolean;
  skipped?: boolean;
  indexedChunks?: number;
}

/**
 * 리포트를 비동기로 임베딩 인덱싱
 *
 * @example
 * // 리포트 저장 후 Anchor Loop 직후 호출
 * indexReportEmbeddings(insertedReport.id, selectedStudentId);
 * // await 없이 fire-and-forget
 */
export async function indexReportEmbeddings(
  reportId: number,
  studentId: number
): Promise<IndexResult> {
  try {
    const response = await fetch('/api/embeddings/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, studentId }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn('[Embedding] 인덱싱 실패:', result.error);
      return { success: false };
    }

    if (result.skipped) {
      return { success: true, skipped: true };
    }

    console.log(`[Embedding] 인덱싱 완료: report ${reportId}, ${result.indexedChunks}개 청크`);
    return { success: true, indexedChunks: result.indexedChunks };
  } catch (err) {
    console.warn('[Embedding] 인덱싱 API 호출 실패:', err);
    return { success: false };
  }
}
