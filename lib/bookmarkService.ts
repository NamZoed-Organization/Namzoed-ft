import { supabase } from './supabase';

// Check if a user has bookmarked a post
export const hasUserBookmarkedPost = async (postId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking if user bookmarked post:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasUserBookmarkedPost:', error);
    return false;
  }
};

// Bookmark a post
export const bookmarkPost = async (postId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .insert({
        post_id: postId,
        user_id: userId,
      });

    if (error) {
      // If error is due to duplicate, it's already bookmarked - treat as success
      if (error.code === '23505') {
        console.log('Post already bookmarked');
        return true;
      }
      console.error('Error bookmarking post:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in bookmarkPost:', error);
    return false;
  }
};

// Remove bookmark from a post
export const unbookmarkPost = async (postId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing bookmark:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in unbookmarkPost:', error);
    return false;
  }
};

// Toggle bookmark status (bookmark if not bookmarked, remove if bookmarked)
export const togglePostBookmark = async (
  postId: string,
  userId: string,
  currentlyBookmarked: boolean
): Promise<{ success: boolean; isBookmarked: boolean }> => {
  try {
    let success: boolean;

    if (currentlyBookmarked) {
      success = await unbookmarkPost(postId, userId);
    } else {
      success = await bookmarkPost(postId, userId);
    }

    if (!success) {
      return {
        success: false,
        isBookmarked: currentlyBookmarked,
      };
    }

    return {
      success: true,
      isBookmarked: !currentlyBookmarked,
    };
  } catch (error) {
    console.error('Error in togglePostBookmark:', error);
    return {
      success: false,
      isBookmarked: currentlyBookmarked,
    };
  }
};

// Get all bookmarked posts for a user
export const getUserBookmarks = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .select(`
        id,
        created_at,
        post_id,
        posts (
          id,
          user_id,
          content,
          images,
          created_at,
          likes,
          comments,
          shares
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user bookmarks:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserBookmarks:', error);
    return [];
  }
};
