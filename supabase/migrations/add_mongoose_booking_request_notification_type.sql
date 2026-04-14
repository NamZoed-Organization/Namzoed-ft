-- Migration: add 'mongoose_booking_request' to the notifications type CHECK constraint
-- Run this in the Supabase SQL Editor (or via `supabase db push`)

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
      'mongoose_booking_request'
    ));
