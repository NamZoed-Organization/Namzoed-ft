import { getFollowerIdsOf } from '@/lib/followService';
import { notifyNewPost } from '@/services/notificationService';
import { supabase } from './supabase';
import { uploadFileToSupabase } from './uploadFile';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  tagged_products?: Array<{ id: string; name: string; price: number; image?: string; current_price?: number; is_currently_active?: boolean; discount_percent?: number }>;
  tagged_accounts?: Array<{ id: string; name: string; avatar_url?: string | null }>;
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
  tagged_products?: Array<{ id: string; name: string; price: number; image?: string; current_price?: number; is_currently_active?: boolean; discount_percent?: number }>;
  tagged_accounts?: Array<{ id: string; name: string; avatar_url?: string | null }>;
}) => {
  const insertPayload: Record<string, unknown> = {
    user_id: postData.userId,
    content: postData.content,
    images: postData.images,
  };

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

  // Fire-and-forget: notify all followers about the new post
  if (data?.id) {
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

// Upload image to Supabase storage
export const uploadImage = async (imageUri: string): Promise<string> => {
  try {
    // Generate a unique filename
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = fileName;

    await uploadFileToSupabase(imageUri, 'post-images', filePath, 'image/jpeg');

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
export const uploadImages = async (imageUris: string[]): Promise<string[]> => {
  const uploadPromises = imageUris.map(uri => uploadImage(uri));
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
