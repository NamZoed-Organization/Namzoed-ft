-- ─── Trending topics ────────────────────────────────────────────────────
-- What "Trending" showed before this: for each of the eight hardcoded
-- top-level categories, the subcategory with the most product listings ever,
-- computed by downloading the whole products table to the device on every
-- screen focus. Real numbers, but no time dimension and no demand signal —
-- it measured how many things sellers had tagged, not what anyone was
-- looking for, and it would show the same eight words for months.
--
-- This replaces it with actual demand: every search a user runs, every
-- hashtag they tap, and every hashtag they publish in a post, scored over a
-- rolling window with recency decay.

CREATE TABLE IF NOT EXISTS public.search_signals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Already normalised by the client (lower-cased, trimmed, no leading '#').
  term TEXT NOT NULL CHECK (char_length(term) BETWEEN 2 AND 50),
  source TEXT NOT NULL CHECK (source IN ('search', 'hashtag_tap', 'hashtag_post')),
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The ranking query only ever scans a recent window, grouped by term.
CREATE INDEX IF NOT EXISTS idx_search_signals_created_at
  ON public.search_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_signals_term_created_at
  ON public.search_signals (term, created_at DESC);

ALTER TABLE public.search_signals ENABLE ROW LEVEL SECURITY;

-- Write-only from the client: a signed-in user records what they did, and
-- reads happen exclusively through trending_terms() below, so nobody can
-- pull the raw log of who searched for what.
DROP POLICY IF EXISTS "Users can record their own search signals" ON public.search_signals;
CREATE POLICY "Users can record their own search signals"
  ON public.search_signals FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ─── Ranking ────────────────────────────────────────────────────────────
-- Score is a sum of weighted signals with exponential recency decay, so a
-- term genuinely has to be busy *lately* to surface — which is the whole
-- point of the word "trending".
--
--   weight: publishing a hashtag counts double a search or a tap. Writing a
--           post about something is a stronger statement that the topic is
--           alive than looking it up once.
--   decay:  three-day half-life. A signal from today counts ~1.0, from three
--           days ago ~0.5, from a week ago ~0.2.
--
-- Signals are first deduplicated to one per user, per term, per source, per
-- day, so a single person repeatedly searching the same word can't manu-
-- facture a trend.
CREATE OR REPLACE FUNCTION public.trending_terms(
  days INT DEFAULT 7,
  max_results INT DEFAULT 12
)
RETURNS TABLE (term TEXT, score NUMERIC, signal_count BIGINT, user_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH windowed AS (
    SELECT
      s.term,
      s.source,
      s.user_id,
      date_trunc('day', s.created_at) AS day,
      min(s.created_at) AS first_at
    FROM public.search_signals s
    WHERE s.created_at >= now() - make_interval(days => GREATEST(days, 1))
    GROUP BY s.term, s.source, s.user_id, date_trunc('day', s.created_at)
  )
  SELECT
    w.term,
    round(
      sum(
        (CASE w.source WHEN 'hashtag_post' THEN 2.0 ELSE 1.0 END)
        * exp(-extract(epoch FROM (now() - w.first_at)) / (3 * 86400))
      )::numeric,
      4
    ) AS score,
    count(*)::bigint AS signal_count,
    count(DISTINCT w.user_id)::bigint AS user_count
  FROM windowed w
  GROUP BY w.term
  ORDER BY score DESC, w.term ASC
  LIMIT GREATEST(max_results, 1);
$$;

GRANT EXECUTE ON FUNCTION public.trending_terms(INT, INT) TO anon, authenticated;

-- ─── Cold start ─────────────────────────────────────────────────────────
-- Without this the feature shows nothing until enough people search, which
-- reads as broken on the day it ships. Seed the log from hashtags already
-- published in the last 30 days, dated to the post that carried them so the
-- decay above treats them exactly like live signals.
INSERT INTO public.search_signals (term, source, user_id, created_at)
SELECT DISTINCT
  lower(matches[1]),
  'hashtag_post',
  p.user_id,
  p.created_at
FROM public.posts p,
     LATERAL regexp_matches(p.content, '#([A-Za-z0-9_]{2,50})', 'g') AS matches
WHERE p.content IS NOT NULL
  AND p.created_at >= now() - INTERVAL '30 days'
ON CONFLICT DO NOTHING;
