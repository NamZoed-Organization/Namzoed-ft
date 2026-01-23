-- Create booking_requests table for Mongoose Dashboard

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

-- Add RLS policies
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own booking requests
CREATE POLICY "Users can create their own booking requests"
ON booking_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own booking requests
CREATE POLICY "Users can view their own booking requests"
ON booking_requests FOR SELECT
USING (auth.uid() = user_id);

-- Mongoose can view all booking requests
CREATE POLICY "Mongoose can view all booking requests"
ON booking_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'mongoose@gmail.com'
  )
);

-- Mongoose can update all booking requests
CREATE POLICY "Mongoose can update booking requests"
ON booking_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'mongoose@gmail.com'
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_booking_requests_mongoose_email 
ON booking_requests(mongoose_email);

CREATE INDEX IF NOT EXISTS idx_booking_requests_user_id 
ON booking_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status 
ON booking_requests(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_booking_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_requests_updated_at
BEFORE UPDATE ON booking_requests
FOR EACH ROW
EXECUTE FUNCTION update_booking_requests_updated_at();
