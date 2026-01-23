import { supabase } from './supabase';

export interface Profile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string | null;
  follower_count?: number;
  following_count?: number;
  dzongkhag?: string | null;
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

// Delete avatar image from Supabase storage ('profile' bucket)
export const deleteAvatar = async (avatarUrl: string): Promise<void> => {
  try {
    // Extract the file path from the public URL
    const urlParts = avatarUrl.split('/profile/');
    const filePath = urlParts[1] || avatarUrl;

    const { error } = await supabase.storage
      .from('profile')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting avatar:', error);
    throw error;
  }
};

// Interface for Featured Seller Profile
export interface FeaturedSellerProfile extends Profile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar_url?: string | null;
  dzongkhag?: string | null;
  follower_count: number;
  following_count: number;
  product_count?: number;
}

// Fetch featured sellers with location-based sorting and pagination
export const fetchFeaturedSellers = async (
  limit: number = 10,
  offset: number = 0,
  searchQuery?: string,
  excludeUserIds: string[] = [],
  currentUserDzongkhag?: string
): Promise<FeaturedSellerProfile[]> => {
  try {
    // First, get all users
    let query = supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        phone,
        avatar_url,
        dzongkhag,
        follower_count,
        following_count
      `);

    // Exclude already-followed users and current user
    if (excludeUserIds.length > 0) {
      query = query.not('id', 'in', `(${excludeUserIds.join(',')})`);
    }

    // If search query provided, filter by name OR phone
    if (searchQuery && searchQuery.trim() !== '') {
      query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get product count for each user
    const usersWithProductCount = await Promise.all(
      (data || []).map(async (user) => {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          follower_count: user.follower_count || 0,
          following_count: user.following_count || 0,
          product_count: count || 0
        };
      })
    );

    // Sort by priority:
    // When searching: prioritize name relevance
    // When not searching: prioritize location, then products
    const sorted = usersWithProductCount.sort((a, b) => {
      // If search query exists, prioritize name match relevance
      if (searchQuery && searchQuery.trim()) {
        // Remove ALL whitespaces for better matching
        const query = searchQuery.toLowerCase().trim().replace(/\s+/g, '');
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aNameNoSpace = aName.replace(/\s+/g, '');
        const bNameNoSpace = bName.replace(/\s+/g, '');

        // Priority 1: Exact match (without spaces) comes first
        const aExact = aNameNoSpace === query ? 0 : 1;
        const bExact = bNameNoSpace === query ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;

        // Priority 2: Starts with query (without spaces)
        const aStarts = aNameNoSpace.startsWith(query) ? 0 : 1;
        const bStarts = bNameNoSpace.startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;

        // Priority 3: Product count (descending)
        if (b.product_count !== a.product_count) {
          return (b.product_count || 0) - (a.product_count || 0);
        }

        // Priority 4: Location as tie-breaker (same dzongkhag slightly boosted)
        const aIsLocal = a.dzongkhag === currentUserDzongkhag ? 0 : 1;
        const bIsLocal = b.dzongkhag === currentUserDzongkhag ? 0 : 1;
        return aIsLocal - bIsLocal;
      }

      // Original sorting when not searching
      // Priority 1: Same location as current user
      const aIsLocal = a.dzongkhag === currentUserDzongkhag ? 0 : 1;
      const bIsLocal = b.dzongkhag === currentUserDzongkhag ? 0 : 1;
      if (aIsLocal !== bIsLocal) return aIsLocal - bIsLocal;

      // Priority 2: Product count (descending)
      if (b.product_count !== a.product_count) {
        return (b.product_count || 0) - (a.product_count || 0);
      }

      // Priority 3: Random
      return Math.random() - 0.5;
    });

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit);

    return paginated as FeaturedSellerProfile[];
  } catch (error) {
    console.error('Error fetching featured sellers:', error);
    return [];
  }
};

// Fetch random users to fill remaining slots
export const fetchRandomSellers = async (
  excludeIds: string[],
  limit: number
): Promise<FeaturedSellerProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        phone,
        avatar_url,
        dzongkhag,
        follower_count,
        following_count
      `)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .order('follower_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Get product count for each user
    const usersWithProductCount = await Promise.all(
      (data || []).map(async (user) => {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          follower_count: user.follower_count || 0,
          following_count: user.following_count || 0,
          product_count: count || 0
        };
      })
    );

    return usersWithProductCount as FeaturedSellerProfile[];
  } catch (error) {
    console.error('Error fetching random sellers:', error);
    return [];
  }
};