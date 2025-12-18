import { supabase } from './supabase';

export interface Profile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  followers?: number;
  following?: number;
  // Add other fields that exist in your public.profiles table
}

// Fetch a specific user's profile
export const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }

  return data as Profile;
};

// Update the current user's profile
export const updateUserProfile = async (userId: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }

  return data as Profile;
};

// Upload avatar image to Supabase storage ('profile' bucket)
export const uploadAvatar = async (imageUri: string, userId: string): Promise<string> => {
  try {
    // Generate a unique filename
    // IMPORTANT: The policy we set up requires the folder to be the USER_ID.
    // Path format: profile/USER_ID/filename.ext
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // For React Native/Expo, create a blob/buffer from the URI
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('profile') // Matches the bucket name in your SQL
      .upload(fileName, fileData, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: true // Overwrite if same name, though random name prevents this mostly
      });

    if (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadAvatar:', error);
    throw error;
  }
};