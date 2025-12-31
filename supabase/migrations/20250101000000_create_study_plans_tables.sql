-- ============================================
-- Migration: 학습 계획 체크리스트 시스템
-- Created: 2025-01-01
-- Description: Phase 3.1 - 학습 계획(study_plans) 및 학습 항목(study_tasks) 테이블 생성
-- ============================================

-- ============================================
-- 1. study_plans 테이블 (학습 계획)
-- ============================================
CREATE TABLE IF NOT EXISTS study_plans (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- 계획 기본 정보
    title VARCHAR(200) NOT NULL,
    description TEXT,
    period_type VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('weekly', 'monthly', 'custom')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

    -- 연관 정보
    report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
    created_by VARCHAR(20) NOT NULL DEFAULT 'teacher' CHECK (created_by IN ('teacher', 'ai')),

    -- 진행률 (트리거로 자동 업데이트)
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    progress_percentage INTEGER NOT NULL DEFAULT 0,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- 제약조건
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- 인덱스
CREATE INDEX idx_study_plans_student_id ON study_plans(student_id);
CREATE INDEX idx_study_plans_status ON study_plans(status);
CREATE INDEX idx_study_plans_period ON study_plans(start_date, end_date);

-- ============================================
-- 2. study_tasks 테이블 (학습 항목/체크리스트 아이템)
-- ============================================
CREATE TABLE IF NOT EXISTS study_tasks (
    id SERIAL PRIMARY KEY,
    study_plan_id INTEGER NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- 항목 정보
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(30) NOT NULL DEFAULT 'custom' CHECK (category IN (
        'concept_review',    -- 개념 복습
        'problem_solving',   -- 문제 풀이
        'workbook',          -- 교재 진도
        'test_prep',         -- 시험 대비
        'weakness_practice', -- 취약점 연습
        'enrichment',        -- 심화 학습
        'custom'             -- 기타
    )),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

    -- 학습 자료 정보
    source VARCHAR(200),          -- 교재명
    page_range VARCHAR(50),       -- 페이지 범위
    problem_numbers VARCHAR(100), -- 문제 번호
    estimated_minutes INTEGER,    -- 예상 소요 시간 (분)

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    order_index INTEGER NOT NULL DEFAULT 0,

    -- 완료 정보
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(20) CHECK (completed_by IN ('student', 'parent', 'teacher')),
    completion_note TEXT,
    actual_minutes INTEGER,       -- 실제 소요 시간
    difficulty_feedback VARCHAR(20) CHECK (difficulty_feedback IN ('easy', 'appropriate', 'hard')),

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_study_tasks_plan_id ON study_tasks(study_plan_id);
CREATE INDEX idx_study_tasks_student_id ON study_tasks(student_id);
CREATE INDEX idx_study_tasks_status ON study_tasks(status);
CREATE INDEX idx_study_tasks_order ON study_tasks(study_plan_id, order_index);

-- ============================================
-- 3. 트리거: updated_at 자동 업데이트
-- ============================================

-- study_plans updated_at 트리거
CREATE OR REPLACE FUNCTION update_study_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_study_plans_updated_at
    BEFORE UPDATE ON study_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_study_plans_updated_at();

-- study_tasks updated_at 트리거
CREATE OR REPLACE FUNCTION update_study_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_study_tasks_updated_at
    BEFORE UPDATE ON study_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_study_tasks_updated_at();

-- ============================================
-- 4. 트리거: 학습 계획 진행률 자동 계산
-- ============================================
CREATE OR REPLACE FUNCTION update_study_plan_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_percentage INTEGER;
    v_plan_id INTEGER;
BEGIN
    -- 계획 ID 결정 (INSERT/UPDATE는 NEW, DELETE는 OLD)
    IF TG_OP = 'DELETE' THEN
        v_plan_id := OLD.study_plan_id;
    ELSE
        v_plan_id := NEW.study_plan_id;
    END IF;

    -- 해당 계획의 항목 수 집계
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_completed
    FROM study_tasks
    WHERE study_plan_id = v_plan_id;

    -- 진행률 계산
    IF v_total > 0 THEN
        v_percentage := ROUND((v_completed::DECIMAL / v_total) * 100);
    ELSE
        v_percentage := 0;
    END IF;

    -- 계획 업데이트
    UPDATE study_plans
    SET
        total_tasks = v_total,
        completed_tasks = v_completed,
        progress_percentage = v_percentage,
        -- 모든 항목 완료 시 계획도 완료 처리
        status = CASE
            WHEN v_completed = v_total AND v_total > 0 THEN 'completed'
            ELSE status
        END,
        completed_at = CASE
            WHEN v_completed = v_total AND v_total > 0 AND completed_at IS NULL THEN NOW()
            ELSE completed_at
        END
    WHERE id = v_plan_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 트리거 등록 (INSERT, UPDATE, DELETE 시 진행률 업데이트)
CREATE TRIGGER trigger_update_plan_progress_insert
    AFTER INSERT ON study_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_study_plan_progress();

CREATE TRIGGER trigger_update_plan_progress_update
    AFTER UPDATE OF status ON study_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_study_plan_progress();

CREATE TRIGGER trigger_update_plan_progress_delete
    AFTER DELETE ON study_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_study_plan_progress();

-- ============================================
-- 5. Row Level Security (RLS)
-- ============================================

-- RLS 활성화
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;

-- 정책: 교사는 모든 데이터 접근 가능
CREATE POLICY "Teachers can access all study_plans"
    ON study_plans
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'teacher'
        )
    );

CREATE POLICY "Teachers can access all study_tasks"
    ON study_tasks
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.role = 'teacher'
        )
    );

-- 정책: 학부모는 자녀의 학습 계획만 조회 가능
CREATE POLICY "Parents can view their children's study_plans"
    ON study_plans
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN users u ON s.parent_id = u.id
            WHERE s.id = study_plans.student_id
            AND u.id = auth.uid()
            AND u.role = 'parent'
        )
    );

CREATE POLICY "Parents can view their children's study_tasks"
    ON study_tasks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN users u ON s.parent_id = u.id
            WHERE s.id = study_tasks.student_id
            AND u.id = auth.uid()
            AND u.role = 'parent'
        )
    );

-- 정책: 학부모는 자녀의 학습 항목 상태 업데이트 가능
CREATE POLICY "Parents can update their children's study_tasks"
    ON study_tasks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN users u ON s.parent_id = u.id
            WHERE s.id = study_tasks.student_id
            AND u.id = auth.uid()
            AND u.role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM students s
            JOIN users u ON s.parent_id = u.id
            WHERE s.id = study_tasks.student_id
            AND u.id = auth.uid()
            AND u.role = 'parent'
        )
    );

-- ============================================
-- 6. 코멘트 추가
-- ============================================
COMMENT ON TABLE study_plans IS '학습 계획 - 주간/월간 학습 목표 관리';
COMMENT ON TABLE study_tasks IS '학습 항목 - 체크리스트 아이템';

COMMENT ON COLUMN study_plans.period_type IS '계획 기간 유형: weekly(주간), monthly(월간), custom(사용자정의)';
COMMENT ON COLUMN study_plans.status IS '계획 상태: draft(작성중), active(진행중), completed(완료), cancelled(취소)';
COMMENT ON COLUMN study_plans.created_by IS '생성자: teacher(교사), ai(AI 자동생성)';

COMMENT ON COLUMN study_tasks.category IS '학습 카테고리: concept_review, problem_solving, workbook, test_prep, weakness_practice, enrichment, custom';
COMMENT ON COLUMN study_tasks.priority IS '우선순위: high(높음), medium(보통), low(낮음)';
COMMENT ON COLUMN study_tasks.status IS '항목 상태: pending(대기), in_progress(진행중), completed(완료), skipped(건너뜀)';
COMMENT ON COLUMN study_tasks.difficulty_feedback IS '난이도 피드백: easy(쉬움), appropriate(적절), hard(어려움)';
