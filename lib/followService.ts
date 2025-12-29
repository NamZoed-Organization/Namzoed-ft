import { supabase } from './supabase';

// Follow a user
export const followUser = async (
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Insert into follows table (counts update automatically via Supabase triggers)
    const { error: insertError } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Follow error:', insertError);
      throw insertError;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error following user:', error);
    return { success: false, error: error.message || 'Failed to follow user' };
  }
};

// Unfollow a user
export const unfollowUser = async (
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Delete from follows table (counts update automatically via Supabase triggers)
    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error: any) {
    console.error('Error unfollowing user:', error);
    return { success: false, error: error.message };
  }
};

// Get list of user IDs that the current user is following
export const getFollowingIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) throw error;

    return (data || []).map(row => row.following_id);
  } catch (error) {
    console.error('Error fetching following list:', error);
    return [];
  }
};

// Check if user A is following user B
export const isFollowing = async (
  followerId: string,
  followingId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

// User interface for follow lists
export interface FollowUser {
  id: string;
  name: string;
  phone?: string;
  avatar_url?: string | null;
  created_at?: string;
  isFollowingBack?: boolean;
  isUnfollowed?: boolean;
}

// Fetch list of users that the current user is following
export const fetchFollowing = async (userId: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<FollowUser[]> => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        created_at,
        profiles!follows_following_id_fkey (
          id,
          name,
          phone,
          avatar_url
        )
      `)
      .eq('follower_id', userId)
      .order('created_at', { ascending: sortOrder === 'asc' });

    if (error) throw error;

    // Map to user objects
    return (data || [])
      .filter((item: any) => item.profiles)
      .map((item: any) => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return {
          id: profile.id,
          name: profile.name || 'Unknown',
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          created_at: item.created_at,
          isFollowingBack: true
        };
      });
  } catch (error) {
    console.error('Error fetching following users:', error);
    return [];
  }
};

// Fetch list of users that are following the current user
export const fetchFollowers = async (userId: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<FollowUser[]> => {
  try {
    // First get all followers
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower_id,
        created_at,
        profiles!follows_follower_id_fkey (
          id,
          name,
          phone,
          avatar_url
        )
      `)
      .eq('following_id', userId)
      .order('created_at', { ascending: sortOrder === 'asc' });

    if (error) throw error;

    // Get list of users that current user is following
    const followingIds = await getFollowingIds(userId);

    // Map to user objects and check if following back
    return (data || [])
      .filter((item: any) => item.profiles)
      .map((item: any) => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return {
          id: profile.id,
          name: profile.name || 'Unknown',
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          created_at: item.created_at,
          isFollowingBack: followingIds.includes(profile.id)
        };
      });
  } catch (error) {
    console.error('Error fetching followers:', error);
    return [];
  }
};
