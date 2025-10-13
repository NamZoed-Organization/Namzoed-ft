import { supabase } from './supabase';

export interface Post {
  id: string;
  user_id: string;
  username: string;
  profile_pic?: string;
  content: string;
  images: string[];
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
}

// Fetch posts with pagination
export const fetchPosts = async (page: number = 0, pageSize: number = 10) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }

  return { posts: data || [], totalCount: count || 0 };
};

// Create a new post
export const createPost = async (postData: {
  content: string;
  images: string[];
  userId: string;
  username: string;
  profilePic?: string;
}) => {
  const { data, error } = await supabase
    .from('posts')
    .insert([{
      user_id: postData.userId,
      username: postData.username,
      profile_pic: postData.profilePic,
      content: postData.content,
      images: postData.images,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    throw error;
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

    // For React Native, we need to create a file object from URI
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    // Get public URL
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
