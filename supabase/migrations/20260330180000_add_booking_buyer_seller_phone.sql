-- Buyer and seller contact phones for mongoose (pickup vs delivery parties)

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
  ADD COLUMN IF NOT EXISTS seller_phone TEXT;

COMMENT ON COLUMN booking_requests.buyer_phone IS 'Delivery party contact (buyer)';
COMMENT ON COLUMN booking_requests.seller_phone IS 'Pickup party contact (seller)';
