-- ================================================================
-- RAG 기반 과거 기억 서랍 (Memory Drawer)
-- pgvector 확장 + report_embeddings 테이블 + 유사도 검색 RPC
-- ================================================================

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. report_embeddings 테이블
CREATE TABLE IF NOT EXISTS report_embeddings (
  id BIGSERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- 임베딩 대상 원본 텍스트 (디버깅/감사용)
  source_text TEXT NOT NULL,
  -- 텍스트 출처 유형
  source_type TEXT NOT NULL CHECK (source_type IN ('summary', 'weakness', 'strength', 'errorPattern', 'prescription', 'combined')),
  -- Gemini Embedding outputDimensionality = 768
  embedding vector(768) NOT NULL,
  -- 메타데이터 (필터링/정렬용)
  report_type TEXT,
  test_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HNSW 인덱스 (cosine 유사도 기반 고속 검색)
CREATE INDEX IF NOT EXISTS idx_report_embeddings_hnsw
ON report_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. 학생 필터링용 인덱스
CREATE INDEX IF NOT EXISTS idx_report_embeddings_student
ON report_embeddings(student_id, report_type);

CREATE INDEX IF NOT EXISTS idx_report_embeddings_report
ON report_embeddings(report_id);

-- 5. 유사도 검색 RPC 함수
CREATE OR REPLACE FUNCTION match_report_memories(
  query_embedding vector(768),
  target_student_id INT,
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 5,
  exclude_report_id INT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  report_id INT,
  source_text TEXT,
  source_type TEXT,
  report_type TEXT,
  test_date DATE,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    re.id,
    re.report_id,
    re.source_text,
    re.source_type,
    re.report_type,
    re.test_date,
    1 - (re.embedding <=> query_embedding) AS similarity
  FROM report_embeddings re
  WHERE
    re.student_id = target_student_id
    AND (exclude_report_id IS NULL OR re.report_id != exclude_report_id)
    AND 1 - (re.embedding <=> query_embedding) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON TABLE report_embeddings IS '리포트 분석 텍스트의 벡터 임베딩 (RAG 기억 서랍)';
COMMENT ON FUNCTION match_report_memories IS 'cosine 유사도 기반 과거 리포트 기억 검색';
