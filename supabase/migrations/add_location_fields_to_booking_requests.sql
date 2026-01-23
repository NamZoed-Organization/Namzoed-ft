-- Add location fields to booking_requests table for pickup and delivery locations

-- Add pickup location fields (seller location - green pin)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS pickup_address TEXT;

-- Add delivery location fields (buyer location - blue pin)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN booking_requests.pickup_latitude IS 'Latitude of the pickup location (seller location) marked with green pin';
COMMENT ON COLUMN booking_requests.pickup_longitude IS 'Longitude of the pickup location (seller location) marked with green pin';
COMMENT ON COLUMN booking_requests.pickup_address IS 'Formatted address of the pickup location';
COMMENT ON COLUMN booking_requests.delivery_latitude IS 'Latitude of the delivery location (buyer location) marked with blue pin';
COMMENT ON COLUMN booking_requests.delivery_longitude IS 'Longitude of the delivery location (buyer location) marked with blue pin';
COMMENT ON COLUMN booking_requests.delivery_address IS 'Formatted address of the delivery location';
