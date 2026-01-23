-- ============================================
-- Mongoose Dashboard - Booking Requests Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Create booking_requests table
CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_phone TEXT,
  mongoose_email TEXT NOT NULL DEFAULT 'mongoose@gmail.com',
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own booking requests" ON booking_requests;
DROP POLICY IF EXISTS "Users can view their own booking requests" ON booking_requests;
DROP POLICY IF EXISTS "Mongoose can view all booking requests" ON booking_requests;
DROP POLICY IF EXISTS "Mongoose can update booking requests" ON booking_requests;

-- Policy: Users can create their own booking requests
CREATE POLICY "Users can create their own booking requests"
ON booking_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own booking requests
CREATE POLICY "Users can view their own booking requests"
ON booking_requests FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Mongoose can view all booking requests
CREATE POLICY "Mongoose can view all booking requests"
ON booking_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'mongoose@gmail.com'
  )
);

-- Policy: Mongoose can update all booking requests
CREATE POLICY "Mongoose can update booking requests"
ON booking_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'mongoose@gmail.com'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_requests_mongoose_email 
ON booking_requests(mongoose_email);

CREATE INDEX IF NOT EXISTS idx_booking_requests_user_id 
ON booking_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status 
ON booking_requests(status);

CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at 
ON booking_requests(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_booking_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_booking_requests_updated_at ON booking_requests;

CREATE TRIGGER update_booking_requests_updated_at
BEFORE UPDATE ON booking_requests
FOR EACH ROW
EXECUTE FUNCTION update_booking_requests_updated_at();

-- Insert sample booking (optional - for testing)
-- Uncomment and modify the user_id if you want test data
/*
INSERT INTO booking_requests (
  user_id,
  user_name,
  user_email,
  user_phone,
  mongoose_email,
  booking_date,
  booking_time,
  status,
  message
) VALUES (
  auth.uid(), -- Replace with actual user UUID
  'Test User',
  'test@example.com',
  '17123456',
  'mongoose@gmail.com',
  'January 15, 2026',
  '2:00 PM - 4:00 PM',
  'pending',
  'Test booking request'
);
*/

-- Verify table creation
SELECT 'booking_requests table created successfully!' as status;
SELECT COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'booking_requests';
