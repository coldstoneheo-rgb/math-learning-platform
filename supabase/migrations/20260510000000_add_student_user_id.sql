-- 1. students 테이블에 user_id 컬럼 추가 (학생 계정 연결용)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. index 추가
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- 3. students 테이블에 대한 RLS 정책 업데이트
-- 학생은 자신의 user_id와 일치하는 학생 레코드만 조회 가능
CREATE POLICY "Students can view own profile"
ON public.students
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- (교사와 관리자는 모든 학생 또는 본인 테넌트의 학생을 볼 수 있는 기존 정책이 있다고 가정)
