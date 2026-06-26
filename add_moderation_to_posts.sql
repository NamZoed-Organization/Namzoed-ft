-- Add content moderation fields to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_rating text DEFAULT 'general' CHECK (content_rating IN ('general', 'sensitive', '18_plus', 'review_required'));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'pending_review', 'rejected'));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_notes text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_reviewed_at timestamp with time zone;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_flagged_for_review boolean DEFAULT false;

-- Create index for faster moderation queue queries
CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON public.posts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_posts_content_rating ON public.posts(content_rating);
CREATE INDEX IF NOT EXISTS idx_posts_is_flagged ON public.posts(is_flagged_for_review);

-- Add user age verification tracking (optional but recommended)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_verification_date timestamp with time zone;

-- Create view for moderation dashboard
CREATE OR REPLACE VIEW moderation_queue AS
SELECT 
  id,
  user_id,
  content,
  images,
  content_rating,
  moderation_status,
  is_flagged_for_review,
  created_at,
  moderation_reviewed_at,
  moderation_notes
FROM public.posts
WHERE moderation_status = 'pending_review' OR is_flagged_for_review = true
ORDER BY created_at DESC;
