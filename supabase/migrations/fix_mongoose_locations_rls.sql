-- Fix RLS policy for mongoose_locations table
-- Run this in your Supabase SQL Editor to fix the permission issue

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Mongoose can update locations for accepted bookings" ON mongoose_locations;

-- Create a new, more permissive policy
-- This allows anyone to insert/update locations for accepted bookings
CREATE POLICY "Mongoose can update locations for accepted bookings"
  ON mongoose_locations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM booking_requests 
      WHERE booking_requests.id = mongoose_locations.booking_id
      AND booking_requests.status = 'accepted'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_requests 
      WHERE booking_requests.id = mongoose_locations.booking_id
      AND booking_requests.status = 'accepted'
    )
  );

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'mongoose_locations';
