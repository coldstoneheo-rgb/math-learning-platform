-- Phase 5 Fix: report_comments, parent_checklists, notifications 테이블의
-- 외래키를 auth.users → public.users로 변경
-- 이유: PostgREST(Supabase 클라이언트)는 public 스키마 내의 FK만 자동 JOIN 가능
--       auth.users를 참조하는 FK는 클라이언트에서 users:author_id(...) 형태로
--       JOIN할 때 PGRST200 에러 발생

-- ======================================================
-- 1. report_comments.author_id FK 교체
--    auth.users(id) → public.users(id)
-- ======================================================
ALTER TABLE public.report_comments
  DROP CONSTRAINT IF EXISTS report_comments_author_id_fkey;

ALTER TABLE public.report_comments
  ADD CONSTRAINT report_comments_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;

-- ======================================================
-- 2. parent_checklists.parent_id FK 교체
--    auth.users(id) → public.users(id)
-- ======================================================
ALTER TABLE public.parent_checklists
  DROP CONSTRAINT IF EXISTS parent_checklists_parent_id_fkey;

ALTER TABLE public.parent_checklists
  ADD CONSTRAINT parent_checklists_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;

-- ======================================================
-- 3. notifications.user_id FK 교체
--    auth.users(id) → public.users(id)
-- ======================================================
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;
