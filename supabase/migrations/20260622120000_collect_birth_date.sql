-- Collect date of birth at signup and persist it for age-related content gating.
-- Safe to run multiple times.

-- 1. Ensure the age columns exist on profiles (also added by add_moderation_to_posts.sql).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_verification_date timestamp with time zone;

-- 2. Update the new-user trigger to persist birth_date from signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_birth_date date := NULL;
BEGIN
  -- raw_user_meta_data->>'birth_date' is a 'YYYY-MM-DD' string (or null/absent).
  IF NULLIF(NEW.raw_user_meta_data->>'birth_date', '') IS NOT NULL THEN
    v_birth_date := (NEW.raw_user_meta_data->>'birth_date')::date;
  END IF;

  INSERT INTO public.profiles (
    id, name, phone, dzongkhag, email, birth_date, age_verified,
    age_verification_date, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'dzongkhag',
    NEW.email,
    v_birth_date,
    v_birth_date IS NOT NULL,
    CASE WHEN v_birth_date IS NOT NULL THEN NOW() ELSE NULL END,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
