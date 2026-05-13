-- Phase 5 Fix: notifications 테이블 INSERT RLS 정책 추가
-- 문제: RLS가 enabled 상태에서 INSERT 정책이 없어 교사의 알림 생성이 전부 차단됨
-- 원인: 교사가 학부모를 위한 알림을 INSERT하려 하지만 RLS가 차단

-- 교사가 모든 사용자에게 알림을 생성(INSERT)할 수 있도록 정책 추가
CREATE POLICY "teachers_can_insert_notifications" ON notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- API Routes(service_role)도 알림을 생성할 수 있도록 허용
-- (service_role은 RLS bypass하므로 별도 정책 불필요, 하지만 명시적으로 teacher 계정이
--  클라이언트 side에서 fetch 호출 시 anon key 사용 → 위 정책으로 처리됨)

-- 추가: 학부모 자신도 in_app 알림을 읽음 처리할 수 있도록 UPDATE 범위 확인
-- (이미 "users_can_update_own_notifications" 정책 존재하므로 추가 불필요)
