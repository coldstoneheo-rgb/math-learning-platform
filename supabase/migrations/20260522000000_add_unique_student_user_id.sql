-- 1. 중복된 user_id를 가진 레코드 정리 (가장 최신(ID가 큰) 행만 남기고 나머지는 user_id를 NULL 처리)
UPDATE public.students
SET user_id = NULL
WHERE id NOT IN (
  SELECT max(id)
  FROM public.students
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) AND user_id IS NOT NULL;

-- 2. students 테이블의 user_id 컬럼에 UNIQUE 제약 조건 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.conname = 'students_user_id_unique'
          AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.students ADD CONSTRAINT students_user_id_unique UNIQUE (user_id);
    END IF;
END $$;
