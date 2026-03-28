-- Create ground_bookings table (Phase 1: Ground Bookings)

CREATE TABLE IF NOT EXISTS public.ground_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.service_providers(user_id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL,
  subcategory_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  images TEXT[],
  opening_time TIME,
  closing_time TIME,
  slot_interval INT,
  price_per_slot NUMERIC NOT NULL,
  advance_booking_days INT,
  days_open INT[],
  excluded_dates JSONB DEFAULT '[]'::jsonb,
  location JSONB,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.ground_bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can read active listings
CREATE POLICY "Public can view active booking services"
ON public.ground_bookings FOR SELECT
USING (is_active = true);

-- Providers can view all their own listings (including inactive)
CREATE POLICY "Providers can view own booking services"
ON public.ground_bookings FOR SELECT
USING (auth.uid() = provider_id);

-- Providers can create their own listings
CREATE POLICY "Providers can create booking services"
ON public.ground_bookings FOR INSERT
WITH CHECK (auth.uid() = provider_id);

-- Providers can update their own listings
CREATE POLICY "Providers can update own booking services"
ON public.ground_bookings FOR UPDATE
USING (auth.uid() = provider_id);

-- Providers can delete their own listings
CREATE POLICY "Providers can delete own booking services"
ON public.ground_bookings FOR DELETE
USING (auth.uid() = provider_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ground_bookings_provider_id ON public.ground_bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_ground_bookings_category_slug ON public.ground_bookings(category_slug);
CREATE INDEX IF NOT EXISTS idx_ground_bookings_subcategory_slug ON public.ground_bookings(subcategory_slug);
CREATE INDEX IF NOT EXISTS idx_ground_bookings_is_active ON public.ground_bookings(is_active);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_ground_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ground_bookings_updated_at
BEFORE UPDATE ON public.ground_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_ground_bookings_updated_at();
