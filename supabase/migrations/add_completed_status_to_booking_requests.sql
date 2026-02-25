-- Migration: allow 'completed' as a valid booking status
-- Run this in your Supabase SQL editor (or via supabase db push)

ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_status_check;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'completed'));
