-- ============================================
-- Migration: 성취 배지 시스템
-- Created: 2025-01-01
-- Description: 학생 성취 배지 및 획득 기록
-- ============================================

-- ============================================
-- 1. achievements 테이블 (배지 정의)
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,

    -- 배지 기본 정보
    code VARCHAR(50) NOT NULL UNIQUE,           -- 배지 코드 (예: FIRST_REPORT, STREAK_7)
    name VARCHAR(100) NOT NULL,                 -- 배지 이름
    description TEXT NOT NULL,                  -- 배지 설명
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'milestone',      -- 마일스톤 (첫 리포트 등)
        'streak',         -- 연속 달성
        'performance',    -- 성적 관련
        'improvement',    -- 성장/개선
        'consistency',    -- 꾸준함
        'mastery',        -- 마스터리
        'special'         -- 특별
    )),

    -- 아이콘 및 표시
    icon VARCHAR(10) NOT NULL DEFAULT '🏆',      -- 이모지 아이콘
    color VARCHAR(20) NOT NULL DEFAULT 'gold',  -- 색상 (gold, silver, bronze, purple, blue)
    tier INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 5),  -- 등급 (1-5)

    -- 획득 조건
    condition_type VARCHAR(30) NOT NULL CHECK (condition_type IN (
        'count',          -- 횟수 기반 (리포트 N개)
        'streak',         -- 연속 기반 (N일 연속)
        'score',          -- 점수 기반 (N점 이상)
        'improvement',    -- 개선 기반 (N점 향상)
        'completion',     -- 완료 기반 (학습 계획 완료 등)
        'custom'          -- 커스텀 조건
    )),
    condition_value INTEGER,                    -- 조건 값
    condition_target VARCHAR(50),               -- 조건 대상 (report_type, task_category 등)

    -- 포인트/보상
    points INTEGER NOT NULL DEFAULT 10,         -- 획득 시 포인트

    -- 상태
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_secret BOOLEAN NOT NULL DEFAULT false,   -- 히든 배지 여부

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_code ON achievements(code);

-- ============================================
-- 2. student_achievements 테이블 (학생 배지 획득 기록)
-- ============================================
CREATE TABLE IF NOT EXISTS student_achievements (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,

    -- 획득 정보
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    earned_reason TEXT,                          -- 획득 사유
    reference_id INTEGER,                        -- 관련 ID (report_id, plan_id 등)
    reference_type VARCHAR(30),                  -- 참조 타입

    -- 알림 상태
    is_notified BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMPTZ,

    -- 유일성 (학생당 배지 1개씩만)
    CONSTRAINT unique_student_achievement UNIQUE (student_id, achievement_id)
);

-- 인덱스
CREATE INDEX idx_student_achievements_student ON student_achievements(student_id);
CREATE INDEX idx_student_achievements_achievement ON student_achievements(achievement_id);
CREATE INDEX idx_student_achievements_earned ON student_achievements(earned_at);

-- ============================================
-- 3. 트리거: updated_at 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_achievements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_achievements_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_achievements_updated_at();

-- ============================================
-- 4. Row Level Security (RLS)
-- ============================================

-- RLS 활성화
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

-- 정책: 배지 정의는 모든 인증 사용자가 조회 가능
CREATE POLICY "All authenticated users can view achievements"
    ON achievements
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- 정책: 교사만 배지 정의 관리 가능
CREATE POLICY "Teachers can manage achievements"
    ON achievements
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'teacher'
        )
    );

-- 정책: 교사는 모든 학생 배지 조회/관리 가능
CREATE POLICY "Teachers can manage student_achievements"
    ON student_achievements
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'teacher'
        )
    );

-- 정책: 학부모는 자녀 배지 조회 가능
CREATE POLICY "Parents can view children's achievements"
    ON student_achievements
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN users u ON s.parent_id = u.id
            WHERE s.id = student_achievements.student_id
            AND u.id = auth.uid()
            AND u.role = 'parent'
        )
    );

-- 정책: 학생은 본인 배지 조회 가능
CREATE POLICY "Students can view own achievements"
    ON student_achievements
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = student_achievements.student_id
            AND u.id = auth.uid()
            AND u.role = 'student'
        )
    );

-- ============================================
-- 5. 기본 배지 데이터 삽입
-- ============================================
INSERT INTO achievements (code, name, description, category, icon, color, tier, condition_type, condition_value, points)
VALUES
    -- 마일스톤 배지
    ('FIRST_REPORT', '첫 발걸음', '첫 번째 리포트를 받았습니다!', 'milestone', '🎉', 'gold', 1, 'count', 1, 10),
    ('FIFTH_REPORT', '성장의 씨앗', '5개의 리포트를 받았습니다!', 'milestone', '🌱', 'silver', 2, 'count', 5, 25),
    ('TENTH_REPORT', '수학 탐험가', '10개의 리포트를 받았습니다!', 'milestone', '🧭', 'gold', 3, 'count', 10, 50),
    ('TWENTY_REPORT', '수학 마스터', '20개의 리포트를 받았습니다!', 'milestone', '🏆', 'purple', 4, 'count', 20, 100),

    -- 연속 달성 배지
    ('STREAK_3', '3일 연속', '3일 연속으로 학습 목표를 달성했습니다!', 'streak', '🔥', 'bronze', 1, 'streak', 3, 15),
    ('STREAK_7', '일주일 도전', '7일 연속으로 학습 목표를 달성했습니다!', 'streak', '⚡', 'silver', 2, 'streak', 7, 35),
    ('STREAK_30', '한 달 챔피언', '30일 연속으로 학습 목표를 달성했습니다!', 'streak', '💪', 'gold', 4, 'streak', 30, 150),

    -- 성적 관련 배지
    ('SCORE_90', '우수 학생', '시험에서 90점 이상을 받았습니다!', 'performance', '⭐', 'gold', 2, 'score', 90, 30),
    ('SCORE_100', '완벽한 점수', '시험에서 100점을 받았습니다!', 'performance', '💯', 'purple', 5, 'score', 100, 100),
    ('TOP_10', '상위 10%', '시험에서 상위 10%에 들었습니다!', 'performance', '🥇', 'gold', 3, 'custom', NULL, 50),

    -- 개선 배지
    ('IMPROVE_10', '성장 중!', '이전 시험 대비 10점 이상 향상했습니다!', 'improvement', '📈', 'silver', 2, 'improvement', 10, 40),
    ('IMPROVE_20', '대도약', '이전 시험 대비 20점 이상 향상했습니다!', 'improvement', '🚀', 'gold', 3, 'improvement', 20, 80),

    -- 꾸준함 배지
    ('PLAN_COMPLETE', '계획 달성', '학습 계획을 100% 완료했습니다!', 'consistency', '✅', 'green', 2, 'completion', 100, 30),
    ('PLAN_COMPLETE_3', '계획의 달인', '3개의 학습 계획을 완료했습니다!', 'consistency', '📋', 'silver', 3, 'count', 3, 60),

    -- 특별 배지
    ('LEVEL_TEST_COMPLETE', '출발선', '레벨 테스트를 완료하고 시작했습니다!', 'special', '🎯', 'purple', 1, 'custom', NULL, 20),
    ('ANNUAL_REVIEW', '1년의 여정', '연간 리포트를 받았습니다!', 'special', '🎊', 'gold', 4, 'custom', NULL, 100)

ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 6. 코멘트
-- ============================================
COMMENT ON TABLE achievements IS '성취 배지 정의';
COMMENT ON TABLE student_achievements IS '학생별 배지 획득 기록';

COMMENT ON COLUMN achievements.category IS '배지 카테고리: milestone, streak, performance, improvement, consistency, mastery, special';
COMMENT ON COLUMN achievements.condition_type IS '획득 조건 유형: count, streak, score, improvement, completion, custom';
COMMENT ON COLUMN achievements.tier IS '배지 등급: 1(일반) ~ 5(전설)';
COMMENT ON COLUMN student_achievements.is_notified IS '획득 알림 발송 여부';
