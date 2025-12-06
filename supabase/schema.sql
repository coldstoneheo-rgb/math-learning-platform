-- 수학 학습 분석 플랫폼 - 데이터베이스 스키마

-- 1. users 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'parent', 'student')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. students 테이블
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  school TEXT,
  start_date DATE,
  parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  learning_style TEXT CHECK (learning_style IN ('visual', 'verbal', 'logical')),
  personality_traits TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_students_parent ON students(parent_id);

-- 3. reports 테이블
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('test', 'weekly', 'monthly', 'consolidated')),
  test_name TEXT,
  test_date DATE,
  total_score INTEGER,
  max_score INTEGER,
  rank INTEGER,
  total_students INTEGER,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, test_name, test_date)
);

CREATE INDEX IF NOT EXISTS idx_reports_student ON reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);

-- 4. RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- users 정책
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_select_teacher" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "users_insert_teacher" ON users FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));

-- students 정책
CREATE POLICY "students_all_teacher" ON students FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "students_select_parent" ON students FOR SELECT USING (parent_id = auth.uid());

-- reports 정책
CREATE POLICY "reports_all_teacher" ON reports FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "reports_select_parent" ON reports FOR SELECT USING (EXISTS (SELECT 1 FROM students WHERE students.id = reports.student_id AND students.parent_id = auth.uid()));

-- 5. 자동 사용자 생성 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
