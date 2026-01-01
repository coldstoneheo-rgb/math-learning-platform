-- ============================================
-- Migration: 알림 로그 테이블
-- Created: 2025-01-01
-- Description: 이메일/SMS 알림 발송 이력 추적
-- ============================================

-- ============================================
-- 1. notification_logs 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,

    -- 알림 정보
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN (
        'report',           -- 리포트 생성 알림
        'study_plan',       -- 학습 계획 알림
        'weekly_reminder',  -- 주간 진도 리마인더
        'assignment',       -- 숙제 알림
        'achievement',      -- 성취 배지 알림
        'custom'            -- 기타
    )),
    reference_id INTEGER,              -- 참조 ID (report_id, plan_id 등)

    -- 발송 정보
    channel VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push')),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',    -- 대기
        'sent',       -- 발송 완료
        'failed',     -- 발송 실패
        'bounced',    -- 반송됨
        'opened'      -- 열람 (이메일)
    )),

    -- 외부 서비스 정보
    message_id VARCHAR(100),           -- Resend/SMS 서비스 메시지 ID
    error_message TEXT,                -- 실패 시 오류 메시지

    -- 메타데이터
    metadata JSONB,                    -- 추가 정보 (제목, 요약 등)

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_student_id ON notification_logs(student_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- ============================================
-- 2. notification_preferences 테이블 (알림 설정)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 이메일 알림 설정
    email_report BOOLEAN NOT NULL DEFAULT true,
    email_study_plan BOOLEAN NOT NULL DEFAULT true,
    email_weekly_reminder BOOLEAN NOT NULL DEFAULT true,
    email_assignment BOOLEAN NOT NULL DEFAULT false,
    email_achievement BOOLEAN NOT NULL DEFAULT true,

    -- 알림 빈도 설정
    weekly_reminder_day INTEGER DEFAULT 1 CHECK (weekly_reminder_day >= 0 AND weekly_reminder_day <= 6),  -- 0=일요일
    weekly_reminder_time TIME DEFAULT '09:00',

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 유일성 제약
    CONSTRAINT unique_user_notification_preferences UNIQUE (user_id)
);

-- 인덱스
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ============================================
-- 3. Row Level Security (RLS)
-- ============================================

-- RLS 활성화
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- 정책: 교사는 모든 로그 조회 가능
CREATE POLICY "Teachers can view all notification_logs"
    ON notification_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'teacher'
        )
    );

-- 정책: 교사는 알림 발송 가능 (INSERT)
CREATE POLICY "Teachers can insert notification_logs"
    ON notification_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'teacher'
        )
    );

-- 정책: 사용자는 자신의 알림 설정 관리 가능
CREATE POLICY "Users can manage own notification_preferences"
    ON notification_preferences
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. 코멘트
-- ============================================
COMMENT ON TABLE notification_logs IS '알림 발송 로그 - 이메일/SMS 발송 이력';
COMMENT ON TABLE notification_preferences IS '알림 설정 - 사용자별 알림 수신 설정';

COMMENT ON COLUMN notification_logs.notification_type IS '알림 유형: report, study_plan, weekly_reminder, assignment, achievement, custom';
COMMENT ON COLUMN notification_logs.channel IS '발송 채널: email, sms, push';
COMMENT ON COLUMN notification_logs.status IS '발송 상태: pending, sent, failed, bounced, opened';
