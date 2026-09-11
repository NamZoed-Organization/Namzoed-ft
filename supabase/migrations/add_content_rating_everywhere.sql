-- Safe View is not a posts feature.
--
-- `content_rating` existed on `posts` and `stories` and nowhere else, so a
-- reader with Safe View on — or one who is under 18, or simply has not
-- verified an age — was protected in the feed and nowhere else in the app.
-- Products, marketplace listings and services are photographs somebody
-- uploaded, exactly like a post, and there was no column for a moderator or
-- a scan to write a rating into even if one had wanted to.
--
-- The vocabulary is deliberately the same four values `posts` uses, so one
-- rule in the client (`lib/safeContent.ts`) can read any of them and nobody
-- has to remember which table means what.
--
--   general          anyone
--   sensitive        adults who have turned Safe View off
--   18_plus          the same, and never a minor
--   review_required  nobody but a moderator, until it is looked at
--
-- Everything already in these tables becomes 'general', which is what it was
-- implicitly being treated as. That is the honest default: it does not
-- suddenly hide the whole catalogue, and it gives the scan and the report
-- flow somewhere to put a verdict from here on.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'marketplace', 'provider_services']
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS content_rating TEXT NOT NULL DEFAULT ''general''',
      t
    );

    -- Dropped and re-added rather than IF NOT EXISTS: a constraint that
    -- already exists with different values would otherwise be left alone
    -- and quietly disagree with this file.
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_content_rating_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I CHECK (content_rating IN
           (''general'', ''sensitive'', ''18_plus'', ''review_required''))',
      t, t || '_content_rating_check'
    );

    -- Moderation's own verdict, separate from the audience rating: one says
    -- "who may see this", the other "has anybody checked". A post carries
    -- both and these should too.
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT ''approved''',
      t
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_moderation_status_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I CHECK (moderation_status IN
           (''approved'', ''pending_review'', ''rejected''))',
      t, t || '_moderation_status_check'
    );

    -- Every listing query filters on these, so they are worth an index
    -- together rather than a sequential scan per browse.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (content_rating, moderation_status)',
      t || '_rating_idx', t
    );
  END LOOP;
END $$;

COMMENT ON COLUMN public.products.content_rating IS
  'Who may see this listing — same vocabulary as posts.content_rating. '
  'Read through lib/safeContent.ts, never compared by hand at a call site.';
