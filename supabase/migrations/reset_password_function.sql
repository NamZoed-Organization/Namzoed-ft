-- Create a secure function to reset user password
-- This function should be run in your Supabase SQL Editor

-- First, create the function
CREATE OR REPLACE FUNCTION reset_user_password(user_email TEXT, new_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
AS $$
DECLARE
  user_id UUID;
  result JSON;
BEGIN
  -- Get the user ID from auth.users based on email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  -- Check if user exists
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  -- Update the user's password in auth.users
  -- This uses Supabase's internal password hashing
  UPDATE auth.users
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = user_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Password updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_user_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_password(TEXT, TEXT) TO anon;
