-- Count dashboard reports that need teacher attention without transferring full analysis_data JSONB to the client.
CREATE OR REPLACE FUNCTION public.count_reports_needing_attention_since(since_at timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.reports AS reports
  WHERE reports.created_at >= since_at
    AND (
      reports.analysis_data->'teacherVerified'->>'derivedGuidanceStatus' = 'excluded_after_teacher_adjustment'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(coalesce(reports.analysis_data->'processingTrace'->'downstream', '{}'::jsonb)) AS step(key, value)
        WHERE value->>'status' IN ('failed', 'skipped')
      )
    );
$$;

CREATE INDEX IF NOT EXISTS idx_class_sessions_student_session_date_desc
  ON public.class_sessions (student_id, session_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_reports_student_created_at_desc
  ON public.reports (student_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.get_latest_class_sessions_for_students(student_ids integer[])
RETURNS TABLE (
  id integer,
  student_id integer,
  session_date date,
  learning_keywords text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (class_sessions.student_id)
    class_sessions.id,
    class_sessions.student_id,
    class_sessions.session_date,
    class_sessions.learning_keywords
  FROM public.class_sessions AS class_sessions
  WHERE class_sessions.student_id = ANY(student_ids)
  ORDER BY class_sessions.student_id, class_sessions.session_date DESC, class_sessions.id DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_reports_for_students(student_ids integer[])
RETURNS TABLE (
  id integer,
  student_id integer,
  report_type text,
  analysis_data jsonb,
  total_score integer,
  max_score integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (reports.student_id)
    reports.id,
    reports.student_id,
    reports.report_type,
    reports.analysis_data,
    reports.total_score,
    reports.max_score,
    reports.created_at
  FROM public.reports AS reports
  WHERE reports.student_id = ANY(student_ids)
  ORDER BY reports.student_id, reports.created_at DESC, reports.id DESC;
$$;
