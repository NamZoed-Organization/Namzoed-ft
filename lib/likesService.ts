import { notifyPostLiked } from '@/services/notificationService';
import { supabase } from './supabase';

// Check if a user has liked a post
export const hasUserLikedPost = async (postId: string, userId: string): Promise<boolean> => {
  if (!postId || !userId) return false;
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking if user liked post:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasUserLikedPost:', error);
    return false;
  }
};

// Get the number of likes for a post
export const getPostLikeCount = async (postId: string): Promise<number> => {
  if (!postId) return 0;
  try {
    const { count, error } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) {
      console.error('Error getting post like count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getPostLikeCount:', error);
    return 0;
  }
};

// Like a post
export const likePost = async (postId: string, userId: string): Promise<boolean> => {
  if (!postId || !userId) return false;
  try {
    const { error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: userId,
      });

    if (error) {
      // If error is due to duplicate, it's already liked - treat as success
      if (error.code === '23505') {
        return true;
      }
      console.error('Error liking post:', error);
      return false;
    }

    // Fire-and-forget: look up post owner and send notification
    (async () => {
      try {
        const { data: post } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .maybeSingle();
        if (post?.user_id && post.user_id !== userId) {
          await notifyPostLiked(post.user_id, userId, postId);
        }
      } catch (e) {
        console.warn('[likesService] notifyPostLiked failed:', e);
      }
    })();

    return true;
  } catch (error) {
    console.error('Error in likePost:', error);
    return false;
  }
};

// Unlike a post
export const unlikePost = async (postId: string, userId: string): Promise<boolean> => {
  if (!postId || !userId) return false;
  try {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error unliking post:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in unlikePost:', error);
    return false;
  }
};

// Toggle like status (like if not liked, unlike if liked)
export const togglePostLike = async (
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<{ success: boolean; isLiked: boolean; likeCount: number }> => {
  try {
    let success: boolean;

    if (currentlyLiked) {
      success = await unlikePost(postId, userId);
    } else {
      success = await likePost(postId, userId);
    }

    if (!success) {
      return {
        success: false,
        isLiked: currentlyLiked,
        likeCount: await getPostLikeCount(postId),
      };
    }

    const newLikeCount = await getPostLikeCount(postId);

    return {
      success: true,
      isLiked: !currentlyLiked,
      likeCount: newLikeCount,
    };
  } catch (error) {
    console.error('Error in togglePostLike:', error);
    const likeCount = await getPostLikeCount(postId);
    return {
      success: false,
      isLiked: currentlyLiked,
      likeCount,
    };
  }
};

// Get all users who liked a post (useful for showing who liked)
export const getPostLikes = async (postId: string) => {
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select(`
        id,
        user_id,
        created_at,
        profiles:user_id (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting post likes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPostLikes:', error);
    return [];
  }
};

// Get users who liked a post that the current user follows (for mini avatars)
export const getFollowedLikers = async (
  postId: string,
  currentUserId: string,
  limit: number = 3
): Promise<Array<{ id: string; name: string; avatar_url?: string | null }>> => {
  if (!postId || !currentUserId) return [];
  try {
    // Get IDs of people the current user follows
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    const followingIds = (followingData || []).map((f: any) => f.following_id);
    if (followingIds.length === 0) return [];

    // Get likers who are in the following list
    const { data, error } = await supabase
      .from('post_likes')
      .select(`
        user_id,
        profiles:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .in('user_id', followingIds)
      .limit(limit);

    if (error) {
      console.error('Error getting followed likers:', error);
      return [];
    }

    return (data || []).map((d: any) => ({
      id: d.profiles?.id || d.user_id,
      name: d.profiles?.name || 'User',
      avatar_url: d.profiles?.avatar_url || null,
    }));
  } catch (error) {
    console.error('Error in getFollowedLikers:', error);
    return [];
  }
};
