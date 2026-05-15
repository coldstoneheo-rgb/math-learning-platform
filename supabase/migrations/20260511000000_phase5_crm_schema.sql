-- Phase 5: CRM & Parent-Teacher Interaction Schema
-- 학부모-교사 상호작용, 알림, 체크리스트 테이블 생성

-- ==============================================
-- 1. report_comments: 리포트 단위 코멘트 스레드
-- ==============================================
CREATE TABLE IF NOT EXISTS report_comments (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_comments_report_id ON report_comments(report_id);
CREATE INDEX idx_report_comments_author_id ON report_comments(author_id);

-- RLS: 리포트를 볼 수 있는 사람(교사/학부모)만 코멘트 접근 가능
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;

-- 교사는 모든 코멘트 읽기 가능
CREATE POLICY "teachers_can_read_all_comments" ON report_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- 학부모는 본인 자녀의 리포트 코멘트만 읽기 가능
CREATE POLICY "parents_can_read_their_child_comments" ON report_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN students s ON r.student_id = s.id
      JOIN users u ON u.id = auth.uid()
      WHERE r.id = report_comments.report_id
        AND s.parent_id = auth.uid()
        AND u.role = 'parent'
    )
  );

-- 교사와 학부모(자녀 연결된 경우)는 코멘트 작성 가능
CREATE POLICY "authenticated_can_insert_comments" ON report_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      -- 교사는 모든 리포트에 코멘트 가능
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
      OR
      -- 학부모는 본인 자녀 리포트에만 코멘트 가능
      EXISTS (
        SELECT 1 FROM reports r
        JOIN students s ON r.student_id = s.id
        WHERE r.id = report_id AND s.parent_id = auth.uid()
      )
    )
  );

-- 본인 코멘트만 수정/삭제 가능
CREATE POLICY "authors_can_update_own_comments" ON report_comments
  FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "authors_can_delete_own_comments" ON report_comments
  FOR DELETE
  USING (author_id = auth.uid());

-- ==============================================
-- 2. parent_checklists: 학부모 주간 가이드 체크리스트
-- ==============================================
CREATE TABLE IF NOT EXISTS parent_checklists (
  id BIGSERIAL PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  -- items: [{id, title, description, priority, completed, source_report_id}]
  items JSONB NOT NULL DEFAULT '[]',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_id, student_id, week_start_date)
);

CREATE INDEX idx_parent_checklists_parent_id ON parent_checklists(parent_id);
CREATE INDEX idx_parent_checklists_student_id ON parent_checklists(student_id);
CREATE INDEX idx_parent_checklists_week ON parent_checklists(week_start_date);

ALTER TABLE parent_checklists ENABLE ROW LEVEL SECURITY;

-- 본인의 체크리스트만 접근 가능
CREATE POLICY "parents_own_checklists" ON parent_checklists
  FOR ALL
  USING (parent_id = auth.uid());

-- 교사는 모든 체크리스트 조회 가능 (모니터링 목적)
CREATE POLICY "teachers_can_read_checklists" ON parent_checklists
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- ==============================================
-- 3. notifications: 멀티채널 알림 시스템 (이메일 + 카카오 알림톡 확장 구조)
-- ==============================================

-- 알림 채널 enum (향후 kakao 알림톡 확장 대비)
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'kakao', 'push', 'in_app');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 발송 상태 enum
DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  -- 알림 채널: email(현재), kakao(향후), push, in_app
  channel notification_channel NOT NULL DEFAULT 'email',
  -- 발송 상태 트래킹
  status notification_status NOT NULL DEFAULT 'pending',
  -- 카카오 알림톡 템플릿 ID (향후 확장용)
  template_id TEXT,
  -- 외부 서비스 응답 (Resend ID, 카카오 msgId 등)
  provider_response JSONB,
  -- 인앱 알림 읽음 여부
  read BOOLEAN NOT NULL DEFAULT FALSE,
  -- 관련 리소스 링크 (리포트 ID 등)
  related_resource_type TEXT, -- 'report', 'student' 등
  related_resource_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_read ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인의 알림만 조회 가능
CREATE POLICY "users_own_notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- 교사는 알림 읽음 상태 업데이트 가능 (본인 것)
CREATE POLICY "users_can_update_own_notifications" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- INSERT는 서비스 롤(API 서버)에서만 가능 (클라이언트 직접 생성 차단)
-- service_role key를 사용하는 API Routes만 알림 생성 가능

-- ==============================================
-- updated_at 자동 갱신 트리거
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_report_comments_updated_at ON report_comments;
CREATE TRIGGER update_report_comments_updated_at
  BEFORE UPDATE ON report_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parent_checklists_updated_at ON parent_checklists;
CREATE TRIGGER update_parent_checklists_updated_at
  BEFORE UPDATE ON parent_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
