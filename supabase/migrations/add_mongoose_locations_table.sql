-- Create mongoose_locations table for real-time location tracking
-- This table stores the mongoose's GPS location during active deliveries

CREATE TABLE IF NOT EXISTS mongoose_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by booking_id
CREATE INDEX IF NOT EXISTS idx_mongoose_locations_booking_id ON mongoose_locations(booking_id);

-- Create index for updated_at to get latest location quickly
CREATE INDEX IF NOT EXISTS idx_mongoose_locations_updated_at ON mongoose_locations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE mongoose_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view locations for their own bookings
CREATE POLICY "Users can view mongoose locations for their bookings"
  ON mongoose_locations
  FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM booking_requests 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Mongoose can insert/update locations for accepted bookings
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

-- Enable real-time for this table
ALTER PUBLICATION supabase_realtime ADD TABLE mongoose_locations;

COMMENT ON TABLE mongoose_locations IS 'Stores real-time GPS locations of mongoose during active deliveries';
COMMENT ON COLUMN mongoose_locations.booking_id IS 'References the active booking request';
COMMENT ON COLUMN mongoose_locations.latitude IS 'Current latitude of mongoose location';
COMMENT ON COLUMN mongoose_locations.longitude IS 'Current longitude of mongoose location';
COMMENT ON COLUMN mongoose_locations.updated_at IS 'Last time location was updated';
