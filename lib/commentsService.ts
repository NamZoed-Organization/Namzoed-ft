import { notifyPostCommented } from '@/services/notificationService';
import { supabase } from './supabase';

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  like_count: number;
  is_liked_by_me: boolean;
  creator_liked: boolean;
  reply_count: number;
  user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

export interface CommentReply {
  id: string;
  comment_id: string;
  user_id: string;
  text: string;
  created_at: string;
  like_count: number;
  is_liked_by_me: boolean;
  creator_liked: boolean;
  user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

// Get comments for a post, enriched with like counts + reply counts
export const getPostComments = async (
  postId: string,
  currentUserId: string,
  postOwnerId: string,
  limit = 50,
  offset = 0,
): Promise<PostComment[]> => {
  if (!postId) return [];
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select('id, post_id, user_id, text, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error || !data || data.length === 0) return [];

    const commentIds = data.map((c: any) => c.id);
    const userIds = [...new Set(data.map((c: any) => c.user_id))];

    // Parallel: profiles, comment_likes, reply counts
    const [profilesRes, likesRes, replyCountsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', userIds),
      supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds),
      supabase
        .from('comment_replies')
        .select('comment_id')
        .in('comment_id', commentIds),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

    // Build per-comment like info
    const likeMap = new Map<string, { count: number; liked: boolean; creatorLiked: boolean }>();
    for (const id of commentIds) likeMap.set(id, { count: 0, liked: false, creatorLiked: false });
    for (const row of (likesRes.data ?? []) as any[]) {
      const entry = likeMap.get(row.comment_id)!;
      entry.count += 1;
      if (row.user_id === currentUserId) entry.liked = true;
      if (row.user_id === postOwnerId) entry.creatorLiked = true;
    }

    // Build per-comment reply counts
    const replyCountMap = new Map<string, number>();
    for (const row of (replyCountsRes.data ?? []) as any[]) {
      replyCountMap.set(row.comment_id, (replyCountMap.get(row.comment_id) ?? 0) + 1);
    }

    return data.map((c: any) => {
      const profile = profileMap.get(c.user_id);
      const likeInfo = likeMap.get(c.id) ?? { count: 0, liked: false, creatorLiked: false };
      return {
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        text: c.text,
        created_at: c.created_at,
        like_count: likeInfo.count,
        is_liked_by_me: likeInfo.liked,
        creator_liked: likeInfo.creatorLiked,
        reply_count: replyCountMap.get(c.id) ?? 0,
        user: profile
          ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url }
          : undefined,
      };
    });
  } catch (e) {
    console.error('Error in getPostComments:', e);
    return [];
  }
};

// Get comment count for a post
export const getPostCommentCount = async (postId: string): Promise<number> => {
  if (!postId) return 0;
  try {
    const { count, error } = await supabase
      .from('post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) {
      console.error('Error getting comment count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getPostCommentCount:', error);
    return 0;
  }
};

// Add a comment to a post
export const addPostComment = async (
  postId: string,
  userId: string,
  text: string
): Promise<PostComment | null> => {
  if (!postId || !userId || !text.trim()) return null;
  try {
    // Step 1: Insert the comment
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        text: text.trim(),
      })
      .select('id, post_id, user_id, text, created_at')
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return null;
    }

    // Step 2: Fetch the post owner and fire notification (non-blocking)
    supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .maybeSingle()
      .then(({ data: post }) => {
        if (post?.user_id) {
          notifyPostCommented(post.user_id, userId, postId, text.trim()).catch(
            (e) => console.warn('[CommentsService] comment notification failed:', e),
          );
        }
      });

    // Step 3: Fetch the commenter's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single();

    return {
      id: data.id,
      post_id: data.post_id,
      user_id: data.user_id,
      text: data.text,
      created_at: data.created_at,
      like_count: 0,
      is_liked_by_me: false,
      creator_liked: false,
      reply_count: 0,
      user: profile
        ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url }
        : undefined,
    };
  } catch (error) {
    console.error('Error in addPostComment:', error);
    return null;
  }
};

// Delete a comment (must be the comment owner)
export const deletePostComment = async (commentId: string, userId: string): Promise<boolean> => {
  if (!commentId || !userId) return false;
  try {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting comment:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deletePostComment:', error);
    return false;
  }
};

// ── Comment likes ────────────────────────────────────────────────────

export const toggleCommentLike = async (
  commentId: string,
  userId: string,
  postOwnerId: string,
): Promise<{ liked: boolean; count: number; creatorLiked: boolean }> => {
  // Check if already liked
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
  }

  // Re-count
  const { data: allLikes } = await supabase
    .from('comment_likes')
    .select('user_id')
    .eq('comment_id', commentId);

  const rows = (allLikes ?? []) as { user_id: string }[];
  return {
    liked: !existing,
    count: rows.length,
    creatorLiked: rows.some((r) => r.user_id === postOwnerId),
  };
};

// ── Replies ──────────────────────────────────────────────────────────

export const getRepliesForComment = async (
  commentId: string,
  currentUserId: string,
  postOwnerId: string,
): Promise<CommentReply[]> => {
  const { data, error } = await supabase
    .from('comment_replies')
    .select('id, comment_id, user_id, text, created_at')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const replyIds = data.map((r: any) => r.id);
  const userIds = [...new Set(data.map((r: any) => r.user_id))];

  const [profilesRes, likesRes] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url').in('id', userIds),
    supabase.from('reply_likes').select('reply_id, user_id').in('reply_id', replyIds),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const likeMap = new Map<string, { count: number; liked: boolean; creatorLiked: boolean }>();
  for (const id of replyIds) likeMap.set(id, { count: 0, liked: false, creatorLiked: false });
  for (const row of (likesRes.data ?? []) as any[]) {
    const entry = likeMap.get(row.reply_id)!;
    entry.count += 1;
    if (row.user_id === currentUserId) entry.liked = true;
    if (row.user_id === postOwnerId) entry.creatorLiked = true;
  }

  return data.map((r: any) => {
    const profile = profileMap.get(r.user_id);
    const likeInfo = likeMap.get(r.id) ?? { count: 0, liked: false, creatorLiked: false };
    return {
      id: r.id,
      comment_id: r.comment_id,
      user_id: r.user_id,
      text: r.text,
      created_at: r.created_at,
      like_count: likeInfo.count,
      is_liked_by_me: likeInfo.liked,
      creator_liked: likeInfo.creatorLiked,
      user: profile
        ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url }
        : undefined,
    };
  });
};

export const addReply = async (
  commentId: string,
  userId: string,
  text: string,
  postOwnerId: string,
  commentOwnerId: string,
  postId: string,
): Promise<CommentReply | null> => {
  if (!commentId || !userId || !text.trim()) return null;
  try {
    const { data, error } = await supabase
      .from('comment_replies')
      .insert({ comment_id: commentId, user_id: userId, text: text.trim() })
      .select('id, comment_id, user_id, text, created_at')
      .single();

    if (error) { console.error('Error adding reply:', error); return null; }

    // Notify the comment owner if not self
    if (commentOwnerId && commentOwnerId !== userId) {
      notifyPostCommented(commentOwnerId, userId, postId, text.trim(), true).catch(() => {});
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single();

    return {
      id: data.id,
      comment_id: data.comment_id,
      user_id: data.user_id,
      text: data.text,
      created_at: data.created_at,
      like_count: 0,
      is_liked_by_me: false,
      creator_liked: false,
      user: profile ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url } : undefined,
    };
  } catch (e) {
    console.error('Error in addReply:', e);
    return null;
  }
};

export const deleteReply = async (replyId: string, userId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('comment_replies')
    .delete()
    .eq('id', replyId)
    .eq('user_id', userId);
  return !error;
};

export const toggleReplyLike = async (
  replyId: string,
  userId: string,
  postOwnerId: string,
): Promise<{ liked: boolean; count: number; creatorLiked: boolean }> => {
  const { data: existing } = await supabase
    .from('reply_likes')
    .select('id')
    .eq('reply_id', replyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('reply_likes').delete().eq('reply_id', replyId).eq('user_id', userId);
  } else {
    await supabase.from('reply_likes').insert({ reply_id: replyId, user_id: userId });
  }

  const { data: allLikes } = await supabase
    .from('reply_likes')
    .select('user_id')
    .eq('reply_id', replyId);

  const rows = (allLikes ?? []) as { user_id: string }[];
  return {
    liked: !existing,
    count: rows.length,
    creatorLiked: rows.some((r) => r.user_id === postOwnerId),
  };
};
