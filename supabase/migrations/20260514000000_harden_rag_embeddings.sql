-- ================================================================
-- RAG 기억 서랍 보안/운영 보강
-- - report_embeddings RLS 활성화 및 교사 전용 접근 정책
-- - embedding_index_status 테이블로 인덱싱 성공/실패 상태 추적
-- ================================================================

ALTER TABLE IF EXISTS report_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_embeddings_teacher_all" ON report_embeddings;
CREATE POLICY "report_embeddings_teacher_all"
ON report_embeddings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'teacher'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'teacher'
  )
);

CREATE TABLE IF NOT EXISTS embedding_index_status (
  report_id INT PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'indexed', 'skipped', 'failed')),
  indexed_chunks INT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embedding_index_status_student
ON embedding_index_status(student_id, status, updated_at DESC);

ALTER TABLE embedding_index_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embedding_index_status_teacher_all" ON embedding_index_status;
CREATE POLICY "embedding_index_status_teacher_all"
ON embedding_index_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'teacher'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'teacher'
  )
);

COMMENT ON TABLE embedding_index_status IS 'RAG 기억 서랍 리포트별 임베딩 인덱싱 상태/실패 로그';
COMMENT ON COLUMN embedding_index_status.status IS 'pending/indexed/skipped/failed';
COMMENT ON COLUMN embedding_index_status.last_error IS '마지막 인덱싱 실패 또는 스킵 사유';
