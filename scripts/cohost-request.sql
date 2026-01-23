-- Create cohost_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS cohost_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id UUID,
  username TEXT,
  profile_image TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add stream_type and co_hosts to live_streams if not present
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS stream_type TEXT DEFAULT 'business';
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS co_hosts UUID[] DEFAULT '{}';

-- Enable Row Level Security
ALTER TABLE cohost_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cohost_requests
-- Allow anyone to insert a request (viewers requesting to join)
DROP POLICY IF EXISTS "Anyone can create cohost requests" ON cohost_requests;
CREATE POLICY "Anyone can create cohost requests" ON cohost_requests
  FOR INSERT WITH CHECK (true);

-- Allow anyone to view requests (host needs to see them)
DROP POLICY IF EXISTS "Anyone can view cohost requests" ON cohost_requests;
CREATE POLICY "Anyone can view cohost requests" ON cohost_requests
  FOR SELECT USING (true);

-- Allow updates (for accepting/rejecting)
DROP POLICY IF EXISTS "Anyone can update cohost requests" ON cohost_requests;
CREATE POLICY "Anyone can update cohost requests" ON cohost_requests
  FOR UPDATE USING (true);

-- IMPORTANT: Enable realtime for the table
-- Run this in Supabase SQL Editor to enable realtime subscriptions:
ALTER PUBLICATION supabase_realtime ADD TABLE cohost_requests;
