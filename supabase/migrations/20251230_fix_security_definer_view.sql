-- Migration: Fix Security Definer View
-- Date: 2025-12-30
-- Description: v_student_meta_profile_summary 뷰를 SECURITY INVOKER로 변경하여
--              RLS 정책이 정상적으로 적용되도록 수정

-- 기존 뷰 삭제 후 SECURITY INVOKER 옵션으로 재생성
DROP VIEW IF EXISTS v_student_meta_profile_summary;

CREATE VIEW v_student_meta_profile_summary
WITH (security_invoker = true)
AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.grade,
  s.meta_profile->>'lastUpdated' AS profile_last_updated,
  s.meta_profile->'baseline'->>'assessmentDate' AS baseline_date,
  (s.meta_profile->'absorptionRate'->>'overallScore')::INTEGER AS absorption_rate,
  (s.meta_profile->'solvingStamina'->>'overallScore')::INTEGER AS solving_stamina,
  (s.meta_profile->'metaCognitionLevel'->>'overallScore')::INTEGER AS meta_cognition,
  jsonb_array_length(COALESCE(s.meta_profile->'errorSignature'->'primaryErrorTypes', '[]'::jsonb)) AS error_type_count,
  jsonb_array_length(COALESCE(s.meta_profile->'errorSignature'->'signaturePatterns', '[]'::jsonb)) AS signature_pattern_count
FROM students s
WHERE s.meta_profile IS NOT NULL;

COMMENT ON VIEW v_student_meta_profile_summary IS '학생 메타 프로필 요약 정보 조회용 뷰 (SECURITY INVOKER - RLS 정책 적용)';
