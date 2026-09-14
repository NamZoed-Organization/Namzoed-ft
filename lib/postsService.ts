import { getFollowerIdsOf } from '@/lib/followService';
import type { TaggedProduct } from "@/types/post";
import type { PostMediaDisplay } from '@/lib/postMediaDisplay';
import { notifyNewPost } from '@/services/notificationService';
import { recordTrendingSignals } from '@/lib/trendingService';
import { extractHashtags } from '@/utils/hashtags';
import type { ContentRating, ModerationStatus } from '@/types/post';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { canViewContent, classifyPostContent } from './contentClassifier';
import type { RankableItem } from './feedRanking';
import { VIDEO_POSTER_BUCKET, videoPosterPath } from './imagePreview';
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
  tagged_products?: TaggedProduct[];
  tagged_accounts?: Array<{ id: string; name: string; avatar_url?: string | null }>;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  content_rating?: ContentRating;
  moderation_status?: ModerationStatus;
  moderation_notes?: string | null;
  is_flagged_for_review?: boolean;
  view_count?: number;
  impressions_shown?: number;
  last_shown_at?: string | null;
  boost_started_at?: string | null;
  boost_expires_at?: string | null;
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

// Cursor-based fetch for infinite scroll (no count query, O(1) pagination)
export const fetchPostsCursor = async (
  cursor: string | null,
  pageSize: number = 15
): Promise<PostWithUser[]> => {
  let query = supabase
    .from('posts')
    .select(`
      *,
      view_count,
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

// ─── Ranked feed (hooks/useFeedInfiniteScroll.ts) ─────────────────────────
// The feed's order comes from feed_order_posts (lib/feedSession.ts); these
// fetch its rows a page of ids at a time, and the posts newer than it.
//
// The like count comes back as one number (`post_likes(count)`) rather than a
// row per like, which on a popular post was most of the payload. If this
// project's API won't embed a count, the old id-list form is used instead,
// and that is remembered for the rest of the session.
const FEED_POST_SELECT = `
  *,
  profiles:user_id (
    name,
    email,
    avatar_url
  )`;
let likeCountEmbedWorks: boolean | null = null;

const toFeedPosts = (data: any[] | null): PostWithUser[] =>
  (data || []).map((post: any) => {
    const likes = post.post_likes;
    const count = Array.isArray(likes)
      ? typeof likes[0]?.count === 'number'
        ? likes[0].count
        : likes.length
      : 0;
    return { ...post, likes: count };
  }) as PostWithUser[];

const selectFeedPosts = async (narrow: (query: any) => any): Promise<PostWithUser[]> => {
  const run = (likes: string) =>
    narrow(supabase.from('posts').select(`${FEED_POST_SELECT}, post_likes ( ${likes} )`));

  if (likeCountEmbedWorks !== false) {
    const { data, error } = await run('count');
    if (!error) {
      likeCountEmbedWorks = true;
      return toFeedPosts(data);
    }
    if (likeCountEmbedWorks === true) throw error;
    likeCountEmbedWorks = false;
  }
  const { data, error } = await run('id');
  if (error) throw error;
  return toFeedPosts(data);
};

export const fetchPostsByIds = async (ids: string[]): Promise<PostWithUser[]> =>
  ids.length === 0 ? [] : selectFeedPosts((q) => q.in('id', ids));

/** Approved posts created after `asOf`, newest first — what a refresh adds. */
export const fetchPostsCreatedSince = async (asOf: string, limit = 30): Promise<PostWithUser[]> =>
  selectFeedPosts((q) =>
    q
      .eq('moderation_status', 'approved')
      .gt('created_at', asOf)
      .order('created_at', { ascending: false })
      .limit(limit),
  );

/** Id-only candidates, ranked on the device when feed_order_posts isn't deployed. */
export const fetchPostRankingPool = async (): Promise<RankableItem[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, impressions_shown, boost_expires_at')
    .eq('moderation_status', 'approved');
  if (error) throw error;
  return (data || []) as RankableItem[];
};

// Cursor-based fetch of posts from a specific set of authors (the "Following"
// feed) — same shape as fetchPostsCursor but scoped to userIds via .in().
export const fetchFollowingPostsCursor = async (
  userIds: string[],
  cursor: string | null,
  pageSize: number = 15
): Promise<PostWithUser[]> => {
  if (userIds.length === 0) return [];

  let query = supabase
    .from('posts')
    .select(`
      *,
      view_count,
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
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching following posts (cursor):', error);
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
      view_count,
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
  tagged_products?: TaggedProduct[];
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

  // Fire-and-forget: every hashtag in the caption is a trending signal, and
  // publishing one weighs double a search for it — writing about a topic
  // says more about it being alive than looking it up does. See
  // supabase/migrations/20260905120000_create_trending_signals.sql.
  if (data?.id && data?.moderation_status === 'approved') {
    recordTrendingSignals(
      extractHashtags(postData.content),
      'hashtag_post',
      postData.userId,
    ).catch(() => {});
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

// A poster is what grids draw instead of the video (components/ui/
// GridThumbnail.tsx). 720px wide covers the detail hero at 2x; the grid asks
// for a smaller resized copy of it.
const POSTER_MAX_WIDTH = 720;
const POSTER_READY_TIMEOUT_MS = 5000;

// Thumbnails come from the loaded asset, so give the player a moment to load
// the local file — but never hold the post up for it.
const waitForPlayerReady = (player: VideoPlayer): Promise<void> =>
  new Promise((resolve) => {
    if (player.status === 'readyToPlay') return resolve();
    let sub: { remove: () => void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (timer) clearTimeout(timer);
      sub?.remove();
      resolve();
    };
    timer = setTimeout(done, POSTER_READY_TIMEOUT_MS);
    sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' || status === 'error') done();
    });
  });

// Cut the first frame from the local file — the one the grid used to show by
// mounting a player — and store it beside the video under the path
// toVideoPosterUrl derives. Made on the phone from the file it already has,
// so it costs the poster's upload and nothing else. Skips image moderation:
// it is a frame of a video that is itself being posted.
const uploadVideoPoster = async (videoUri: string, videoFileName: string): Promise<void> => {
  const player = createVideoPlayer(videoUri);
  try {
    await waitForPlayerReady(player);
    const [frame] = await player.generateThumbnailsAsync(0, { maxWidth: POSTER_MAX_WIDTH });
    if (!frame) return;
    const image = await ImageManipulator.manipulate(frame).renderAsync();
    const { uri } = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    await uploadFileToSupabase(uri, VIDEO_POSTER_BUCKET, videoPosterPath(videoFileName), 'image/jpeg', false, {
      skipImageModeration: true,
      // Already made at its final size above.
      image: false,
    });
  } finally {
    player.release();
  }
};

// Upload video to Supabase storage
export const uploadVideo = async (videoUri: string): Promise<string> => {
  try {
    // Generate a unique filename
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
    const filePath = fileName;

    await uploadFileToSupabase(videoUri, 'post-videos', filePath, 'video/mp4');

    // Awaited so the post never appears in a grid before its poster does, but
    // best-effort: without one the grid falls back to the video's first frame.
    try {
      await uploadVideoPoster(videoUri, fileName);
    } catch (e) {
      console.warn('[postsService] video poster failed:', e);
    }

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
