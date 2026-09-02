import { notifyPostCommented } from '@/services/notificationService';
import { Post } from './postsService';
import { supabase } from './supabase';

export type CommentMediaType = 'image' | 'video' | 'audio';
/** Only image/video can be attached as a multi-item carousel. */
export type CommentGalleryMediaType = 'image' | 'video';

export interface CommentMediaAttachment {
  url: string;
  type: CommentMediaType;
  /** Seconds — only meaningful for video/audio. */
  duration?: number;
}

/** One image/video in a comment/reply's gallery — see comment_media table. */
export interface CommentMediaItem {
  id: string;
  url: string;
  type: CommentGalleryMediaType;
  duration?: number | null;
  /** UI-only: true while this specific item is still uploading. */
  isOptimistic?: boolean;
}

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
  /** Voice note only — image/video attachments live in `media` below. */
  media_url?: string | null;
  media_type?: CommentMediaType | null;
  media_duration?: number | null;
  /** Image/video carousel, ordered. */
  media?: CommentMediaItem[];
  /** UI-only: true while a media attachment is still uploading. */
  isOptimistic?: boolean;
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
  /** Voice note only — image/video attachments live in `media` below. */
  media_url?: string | null;
  media_type?: CommentMediaType | null;
  media_duration?: number | null;
  /** Image/video carousel, ordered. */
  media?: CommentMediaItem[];
  /** UI-only: true while a media attachment is still uploading. */
  isOptimistic?: boolean;
  user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

const mediaPreviewText = (media?: CommentMediaAttachment): string => {
  switch (media?.type) {
    case 'image': return '📷 Photo';
    case 'video': return '🎥 Video';
    case 'audio': return '🎤 Voice message';
    default: return '';
  }
};

const galleryPreviewText = (media: { type: CommentGalleryMediaType }[]): string => {
  if (media.length === 0) return '';
  const hasVideo = media.some((m) => m.type === 'video');
  const label = hasVideo ? '🎥 Video' : '📷 Photo';
  return media.length > 1 ? `${label} +${media.length - 1} more` : label;
};

/** Batch-fetch comment_media rows for a set of comment/reply ids, grouped and
 * ordered by position. `key` selects which FK column to join on. */
const fetchCommentMediaMap = async (
  ids: string[],
  key: 'comment_id' | 'reply_id',
): Promise<Map<string, CommentMediaItem[]>> => {
  const map = new Map<string, CommentMediaItem[]>();
  if (ids.length === 0) return map;

  const { data } = await supabase
    .from('comment_media')
    .select(`id, ${key}, media_url, media_type, media_duration, position`)
    .in(key, ids)
    .order('position', { ascending: true });

  for (const row of (data ?? []) as any[]) {
    const targetId = row[key];
    const list = map.get(targetId) ?? [];
    list.push({ id: row.id, url: row.media_url, type: row.media_type, duration: row.media_duration });
    map.set(targetId, list);
  }
  return map;
};

/** Insert `media` items for a just-created comment/reply and return them
 * ordered — used by addPostCommentWithGallery/addReplyWithGallery. */
const insertCommentMedia = async (
  targetId: string,
  key: 'comment_id' | 'reply_id',
  media: { url: string; type: CommentGalleryMediaType; duration?: number }[],
): Promise<CommentMediaItem[]> => {
  if (media.length === 0) return [];
  const rows = media.map((m, i) => ({
    [key]: targetId,
    media_url: m.url,
    media_type: m.type,
    media_duration: m.duration ?? null,
    position: i,
  }));
  const { data, error } = await supabase
    .from('comment_media')
    .insert(rows)
    .select('id, media_url, media_type, media_duration, position')
    .order('position', { ascending: true });
  if (error || !data) {
    console.error('Error attaching comment media:', error);
    return [];
  }
  return data.map((row: any) => ({ id: row.id, url: row.media_url, type: row.media_type, duration: row.media_duration }));
};

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
      .select('id, post_id, user_id, text, created_at, media_url, media_type, media_duration')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error || !data || data.length === 0) return [];

    const commentIds = data.map((c: any) => c.id);
    const userIds = [...new Set(data.map((c: any) => c.user_id))];

    // Parallel: profiles, comment_likes, reply counts, gallery media
    const [profilesRes, likesRes, replyCountsRes, mediaMap] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', userIds),
      supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds),
      supabase
        .from('comment_replies')
        .select('comment_id')
        .in('comment_id', commentIds),
      fetchCommentMediaMap(commentIds, 'comment_id'),
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
        media_url: c.media_url,
        media_type: c.media_type,
        media_duration: c.media_duration,
        media: mediaMap.get(c.id) ?? [],
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

// Add a comment to a post. `media` allows an image/video/voice attachment;
// text is optional as long as media is present (or vice versa).
export const addPostComment = async (
  postId: string,
  userId: string,
  text: string,
  media?: CommentMediaAttachment,
): Promise<PostComment | null> => {
  if (!postId || !userId || (!text.trim() && !media)) return null;
  try {
    // Step 1: Insert the comment
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        text: text.trim(),
        media_url: media?.url ?? null,
        media_type: media?.type ?? null,
        media_duration: media?.duration ?? null,
      })
      .select('id, post_id, user_id, text, created_at, media_url, media_type, media_duration')
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
          notifyPostCommented(
            post.user_id,
            userId,
            postId,
            text.trim() || mediaPreviewText(media),
          ).catch((e) => console.warn('[CommentsService] comment notification failed:', e));
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
      media_url: data.media_url,
      media_type: data.media_type,
      media_duration: data.media_duration,
      user: profile
        ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url }
        : undefined,
    };
  } catch (error) {
    console.error('Error in addPostComment:', error);
    return null;
  }
};

// Add a comment with an image/video carousel (1+ items) plus an optional
// shared caption — used by the comment media picker's staging drawer.
export const addPostCommentWithGallery = async (
  postId: string,
  userId: string,
  text: string,
  media: { url: string; type: CommentGalleryMediaType; duration?: number }[],
): Promise<PostComment | null> => {
  if (!postId || !userId || (!text.trim() && media.length === 0)) return null;
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: userId, text: text.trim() })
      .select('id, post_id, user_id, text, created_at')
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return null;
    }

    const mediaItems = await insertCommentMedia(data.id, 'comment_id', media);

    supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .maybeSingle()
      .then(({ data: post }) => {
        if (post?.user_id) {
          notifyPostCommented(
            post.user_id,
            userId,
            postId,
            text.trim() || galleryPreviewText(mediaItems),
          ).catch((e) => console.warn('[CommentsService] comment notification failed:', e));
        }
      });

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
      media: mediaItems,
      user: profile
        ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url }
        : undefined,
    };
  } catch (error) {
    console.error('Error in addPostCommentWithGallery:', error);
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
    .select('id, comment_id, user_id, text, created_at, media_url, media_type, media_duration')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const replyIds = data.map((r: any) => r.id);
  const userIds = [...new Set(data.map((r: any) => r.user_id))];

  const [profilesRes, likesRes, mediaMap] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url').in('id', userIds),
    supabase.from('reply_likes').select('reply_id, user_id').in('reply_id', replyIds),
    fetchCommentMediaMap(replyIds, 'reply_id'),
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
      media_url: r.media_url,
      media_type: r.media_type,
      media_duration: r.media_duration,
      media: mediaMap.get(r.id) ?? [],
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
  media?: CommentMediaAttachment,
): Promise<CommentReply | null> => {
  if (!commentId || !userId || (!text.trim() && !media)) return null;
  try {
    const { data, error } = await supabase
      .from('comment_replies')
      .insert({
        comment_id: commentId,
        user_id: userId,
        text: text.trim(),
        media_url: media?.url ?? null,
        media_type: media?.type ?? null,
        media_duration: media?.duration ?? null,
      })
      .select('id, comment_id, user_id, text, created_at, media_url, media_type, media_duration')
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
      media_url: data.media_url,
      media_type: data.media_type,
      media_duration: data.media_duration,
      user: profile ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url } : undefined,
    };
  } catch (e) {
    console.error('Error in addReply:', e);
    return null;
  }
};

// Add a reply with an image/video carousel (1+ items) plus an optional
// shared caption — used by the comment media picker's staging drawer.
export const addReplyWithGallery = async (
  commentId: string,
  userId: string,
  text: string,
  postOwnerId: string,
  commentOwnerId: string,
  postId: string,
  media: { url: string; type: CommentGalleryMediaType; duration?: number }[],
): Promise<CommentReply | null> => {
  if (!commentId || !userId || (!text.trim() && media.length === 0)) return null;
  try {
    const { data, error } = await supabase
      .from('comment_replies')
      .insert({ comment_id: commentId, user_id: userId, text: text.trim() })
      .select('id, comment_id, user_id, text, created_at')
      .single();

    if (error) { console.error('Error adding reply:', error); return null; }

    const mediaItems = await insertCommentMedia(data.id, 'reply_id', media);

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
      media: mediaItems,
      user: profile ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url } : undefined,
    };
  } catch (e) {
    console.error('Error in addReplyWithGallery:', e);
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

// Get all posts a user has commented on, most recently commented first (one
// entry per post, deduped) — feeds the "Comments" tab on their own profile.
export const getUserCommentedPosts = async (userId: string): Promise<Post[]> => {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return [];

    const orderedPostIds: string[] = [];
    const seen = new Set<string>();
    for (const row of data as any[]) {
      if (!seen.has(row.post_id)) {
        seen.add(row.post_id);
        orderedPostIds.push(row.post_id);
      }
    }

    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*, post_likes ( id )')
      .in('id', orderedPostIds);

    if (postsError || !posts) return [];

    const postMap = new Map(
      posts.map((p: any) => [p.id, { ...p, likes: p.post_likes?.length || 0 }]),
    );
    return orderedPostIds
      .map((id) => postMap.get(id))
      .filter((p): p is Post => p != null);
  } catch (error) {
    console.error('Error in getUserCommentedPosts:', error);
    return [];
  }
};
