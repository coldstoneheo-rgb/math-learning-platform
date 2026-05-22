-- 1. users 테이블의 role 제약 조건 수정
-- 기존 제약 조건 'users_role_check'가 존재하는 경우 삭제하고, 'super_admin'이 포함된 새 제약 조건을 추가합니다.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'teacher', 'parent', 'student'));

-- 2. students 테이블에 connection_code 컬럼 추가 (학생용 고유 연결 코드)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS connection_code TEXT UNIQUE;

-- 3. 기존 학생 데이터가 있을 경우를 대비하여 고유한 연결 코드를 생성하여 채워넣음
-- 6자리 대문자/숫자 난수 조합 (STU-XXXXXX)
-- 간단한 SQL 갱신을 통해 중복이 최소화되도록 함
UPDATE public.students
SET connection_code = 'STU-' || upper(substring(md5(random()::text || id::text) from 1 for 6))
WHERE connection_code IS NULL;

-- 4. RLS 정책 추가 (super_admin 역할이 모든 데이터에 접근할 수 있도록 허용)
-- users 테이블에 대한 super_admin 전체 접근 허용 정책
DROP POLICY IF EXISTS "users_all_super_admin" ON public.users;
CREATE POLICY "users_all_super_admin" ON public.users
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

-- students 테이블에 대한 super_admin 전체 접근 허용 정책
DROP POLICY IF EXISTS "students_all_super_admin" ON public.students;
CREATE POLICY "students_all_super_admin" ON public.students
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

-- reports 테이블에 대한 super_admin 전체 접근 허용 정책
DROP POLICY IF EXISTS "reports_all_super_admin" ON public.reports;
CREATE POLICY "reports_all_super_admin" ON public.reports
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));
