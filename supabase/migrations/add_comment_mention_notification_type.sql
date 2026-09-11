-- Mentions in comments: "@Karma" in a comment notifies Karma.
--
-- The constraint is rewritten in full because it enumerates every type, and
-- the last migration to touch it did not know about this one. This is the
-- complete set as of types/notification.ts.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_follower',
      'post_liked',
      'post_commented',
      'user_went_live',
      'new_post',
      'mongoose_booking_request',
      'follower_milestone',
      'post_traction',
      'weekly_engagement',
      'new_story',
      'product_reviewed',
      'qr_connect_request',
      'qr_connect_accepted',
      'setlog_prompt',
      -- Somebody wrote your name into a comment or a reply.
      'comment_mention'
    ));
