-- GSC 일별 요약 테이블
-- Supabase 대시보드 SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS gsc_daily_summary (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL UNIQUE,
  total_clicks      integer NOT NULL DEFAULT 0,
  total_impressions integer NOT NULL DEFAULT 0,
  avg_ctr     float   NOT NULL DEFAULT 0,
  avg_position float  NOT NULL DEFAULT 0,
  top_queries jsonb   NOT NULL DEFAULT '[]',
  top_pages   jsonb   NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsc_daily_summary_date ON gsc_daily_summary(date DESC);

-- RLS: 서비스 롤만 접근
ALTER TABLE gsc_daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON gsc_daily_summary
  USING (auth.role() = 'service_role');
