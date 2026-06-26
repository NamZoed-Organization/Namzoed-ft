import { getFollowerIdsOf } from '@/lib/followService';
import type { PostMediaDisplay } from '@/lib/postMediaDisplay';
import { notifyNewPost } from '@/services/notificationService';
import type { ContentRating, ModerationStatus } from '@/types/post';
import { canViewContent, classifyPostContent } from './contentClassifier';
import { supabase } from './supabase';
import { uploadFileToSupabase } from './uploadFile';

// Shared video-URL detection (kept in sync with the inline feed player).
export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
export const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    VIDEO_EXTENSIONS.some((ext) => lower.includes(ext)) ||
    lower.includes("post-videos")
  );
};

// A single playable video in the fullscreen reels viewer, carrying the post
// metadata needed for like / comment / bookmark / share actions.
export interface VideoReel {
  id: string; // unique per video: `${postId}::${index}`
  uri: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  media_display?: PostMediaDisplay | null;
  tagged_products?: Array<{ id: string; name: string; price: number; image?: string; current_price?: number; is_currently_active?: boolean; discount_percent?: number }>;
  tagged_accounts?: Array<{ id: string; name: string; avatar_url?: string | null }>;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  content_rating?: ContentRating;
  moderation_status?: ModerationStatus;
  moderation_notes?: string | null;
  is_flagged_for_review?: boolean;
}

// Extended post interface with user profile data
export interface PostWithUser extends Post {
  profiles?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string | null;
  };
}

// Fetch posts with pagination and user profile data
export const fetchPosts = async (page: number = 0, pageSize: number = 10) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      ),
      post_likes (
        id
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }

  // Map posts to include actual like count from post_likes
  const postsWithLikeCounts = (data || []).map((post: any) => ({
    ...post,
    likes: post.post_likes?.length || 0,
  })) as PostWithUser[];

  return { posts: postsWithLikeCounts, totalCount: count || 0 };
};

// Cursor-based fetch for infinite scroll (no count query, O(1) pagination)
export const fetchPostsCursor = async (
  cursor: string | null,
  pageSize: number = 15
): Promise<PostWithUser[]> => {
  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      ),
      post_likes (
        id
      )
    `)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching posts (cursor):', error);
    throw error;
  }

  return (data || []).map((post: any) => ({
    ...post,
    likes: post.post_likes?.length || 0,
  })) as PostWithUser[];
};

// Cursor-based fetch of video reels for the fullscreen "reels" experience.
// Videos live inside posts' `images` arrays, so we page through posts and
// extract video URLs until we have collected a batch (or run out of posts).
export const fetchVideoReels = async (
  cursor: string | null,
  pageSize: number = 8,
): Promise<{ reels: VideoReel[]; nextCursor: string | null; hasMore: boolean }> => {
  const reels: VideoReel[] = [];
  let currentCursor = cursor;
  let hasMore = true;

  // Videos can be sparse among posts, so probe a few internal pages until we
  // gather enough reels for a smooth scroll.
  for (let attempt = 0; attempt < 6 && reels.length < pageSize; attempt++) {
    const posts = await fetchPostsCursor(currentCursor, 15);
    if (posts.length === 0) {
      hasMore = false;
      break;
    }
    currentCursor = posts[posts.length - 1].created_at;

    for (const post of posts) {
      (post.images || []).forEach((uri, index) => {
        if (!isVideoUrl(uri)) return;
        reels.push({
          id: `${post.id}::${index}`,
          uri,
          postId: String(post.id),
          userId: String(post.user_id),
          username: post.profiles?.name || "Unknown",
          avatarUrl: post.profiles?.avatar_url ?? null,
          content: post.content || "",
          createdAt: post.created_at,
        });
      });
    }

    if (posts.length < 15) {
      hasMore = false;
      break;
    }
  }

  return { reels, nextCursor: currentCursor, hasMore };
};

// Fetch a single post by ID with profile data
export const fetchPostById = async (postId: string): Promise<PostWithUser | null> => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      ),
      post_likes (
        id
      )
    `)
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching post by id:', error);
    return null;
  }
  if (!data) return null;

  return {
    ...data,
    likes: (data as any).post_likes?.length ?? 0,
  } as PostWithUser;
};

// Fetch posts by user ID
export const fetchUserPosts = async (userId: string) => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      post_likes (
        id
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user posts:', error);
    throw error;
  }

  // Map posts to include actual like count from post_likes
  const postsWithLikeCounts = (data || []).map((post: any) => ({
    ...post,
    likes: post.post_likes?.length || 0,
  }));

  return postsWithLikeCounts;
};

// Create a new post
export const createPost = async (postData: {
  content: string;
  images: string[];
  userId: string;
  mediaDisplay?: PostMediaDisplay;
  tagged_products?: Array<{ id: string; name: string; price: number; image?: string; current_price?: number; is_currently_active?: boolean; discount_percent?: number }>;
  tagged_accounts?: Array<{ id: string; name: string; avatar_url?: string | null }>;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  contentRating?: ContentRating;
}) => {
  const insertPayload: Record<string, unknown> = {
    user_id: postData.userId,
    content: postData.content,
    images: postData.images,
  };

  // Auto-classify content if not explicitly provided
  // User can override this in the UI before posting
  const contentRating = postData.contentRating || classifyPostContent(
    postData.content,
    postData.tagged_products?.map(p => p.name)
  );
  
  insertPayload.content_rating = contentRating;
  
  // All legal content is auto-approved immediately with tags
  // Only content flagged as 'review_required' goes to moderation queue (policy violations)
  insertPayload.moderation_status = contentRating === 'review_required'
    ? 'pending_review'
    : 'approved';

  const loc = postData.locationName?.trim();
  if (loc) {
    insertPayload.location_name = loc;
    if (
      postData.locationLat != null &&
      postData.locationLng != null &&
      Number.isFinite(postData.locationLat) &&
      Number.isFinite(postData.locationLng)
    ) {
      insertPayload.location_lat = postData.locationLat;
      insertPayload.location_lng = postData.locationLng;
    }
  }

  if (postData.mediaDisplay) {
    insertPayload.media_display = postData.mediaDisplay;
  }

  if (postData.tagged_products && postData.tagged_products.length > 0) {
    insertPayload.tagged_products = postData.tagged_products;
  }
  if (postData.tagged_accounts && postData.tagged_accounts.length > 0) {
    insertPayload.tagged_accounts = postData.tagged_accounts;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    throw error;
  }

  // Fire-and-forget: generate BlurHash placeholders for progressive image
  // loading. The post is usable immediately; hashes appear on next fetch.
  if (data?.id && Array.isArray(postData.images) && postData.images.length > 0) {
    supabase.functions
      .invoke('generate-blurhash', { body: { postId: data.id } })
      .catch((e) => console.warn('[postsService] generate-blurhash failed:', e));
  }

  // Fire-and-forget: notify all followers about the new post
  // but only if post is approved (not pending review)
  if (data?.id && data?.moderation_status === 'approved') {
    (async () => {
      try {
        const followerIds = await getFollowerIdsOf(postData.userId);
        if (followerIds.length > 0) {
          await notifyNewPost(postData.userId, data.id, followerIds);
        }
      } catch (e) {
        console.warn('[postsService] notifyNewPost failed:', e);
      }
    })();
  }

  return data;
};

// Delete a post
export const deletePost = async (postId: string) => {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

// Update likes count
export const updateLikes = async (postId: string, newLikesCount: number) => {
  const { error } = await supabase
    .from('posts')
    .update({ likes: newLikesCount })
    .eq('id', postId);

  if (error) {
    console.error('Error updating likes:', error);
    throw error;
  }
};

// Upload image to Supabase storage.
// Pass skipModeration=true when the caller has already run Google Vision
// moderation (e.g. the post creation flow) to avoid a redundant local scan.
export const uploadImage = async (
  imageUri: string,
  skipModeration: boolean = false,
): Promise<string> => {
  try {
    // Generate a unique filename
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = fileName;

    await uploadFileToSupabase(imageUri, 'post-images', filePath, 'image/jpeg', false, {
      skipImageModeration: skipModeration,
    });

    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadImage:', error);
    throw error;
  }
};

// Upload multiple images
export const uploadImages = async (
  imageUris: string[],
  skipModeration: boolean = false,
): Promise<string[]> => {
  const uploadPromises = imageUris.map(uri => uploadImage(uri, skipModeration));
  return await Promise.all(uploadPromises);
};

// Upload video to Supabase storage
export const uploadVideo = async (videoUri: string): Promise<string> => {
  try {
    // Generate a unique filename
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
    const filePath = fileName;

    await uploadFileToSupabase(videoUri, 'post-videos', filePath, 'video/mp4');

    const { data: { publicUrl } } = supabase.storage
      .from('post-videos')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadVideo:', error);
    throw error;
  }
};

// Upload multiple videos
export const uploadVideos = async (videoUris: string[]): Promise<string[]> => {
  const uploadPromises = videoUris.map(uri => uploadVideo(uri));
  return await Promise.all(uploadPromises);
};

/**
 * Update moderation status and notes for a post
 * Typically called by admin/moderator functions
 */
export const updatePostModerationStatus = async (
  postId: string,
  moderationStatus: ModerationStatus,
  moderationNotes?: string
) => {
  const updatePayload: Record<string, unknown> = {
    moderation_status: moderationStatus,
    moderation_reviewed_at: new Date().toISOString(),
  };

  if (moderationNotes) {
    updatePayload.moderation_notes = moderationNotes;
  }

  const { error } = await supabase
    .from('posts')
    .update(updatePayload)
    .eq('id', postId);

  if (error) {
    console.error('Error updating post moderation status:', error);
    throw error;
  }
};

/**
 * Flag a post for review by moderators
 */
export const flagPostForReview = async (postId: string, reason: string) => {
  const { error } = await supabase
    .from('posts')
    .update({
      is_flagged_for_review: true,
      moderation_notes: reason,
    })
    .eq('id', postId);

  if (error) {
    console.error('Error flagging post for review:', error);
    throw error;
  }
};

/**
 * Fetch posts pending moderation review
 */
export const fetchModerationQueue = async (limit: number = 50) => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        avatar_url
      )
    `)
    .or('moderation_status.eq.pending_review,is_flagged_for_review.eq.true')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching moderation queue:', error);
    throw error;
  }

  return data || [];
};

/**
 * Get user's age from profile if available
 */
export const getUserAge = async (userId: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('birth_date, age_verified')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.birth_date) return null;

  const birthDate = new Date(data.birth_date);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

/**
 * Filter posts for a user based on their age and content rating
 * Removes posts the user shouldn't see
 */
export const filterPostsByUserAge = (
  posts: PostWithUser[],
  userAge?: number | null,
  isAgeVerified?: boolean
): PostWithUser[] => {
  return posts.filter(post => {
    const contentRating = (post as any).content_rating || 'general';
    return canViewContent(contentRating, userAge, isAgeVerified);
  });
};
