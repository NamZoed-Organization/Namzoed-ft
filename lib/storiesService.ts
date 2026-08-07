import { getFollowerIdsOf, getFollowingIds } from '@/lib/followService';
import { notifyNewStory } from '@/services/notificationService';
import type { ContentRating, ModerationStatus } from '@/types/post';
import { classifyPostContent } from './contentClassifier';
import { supabase } from './supabase';
import { uploadFileToSupabase } from './uploadFile';

export interface Story {
  id: string;
  user_id: string;
  image_url: string;
  width?: number | null;
  height?: number | null;
  tagged_product_id?: string | null;
  tagged_account_id?: string | null;
  content_rating: ContentRating;
  moderation_status: ModerationStatus;
  moderation_notes?: string | null;
  view_count: number;
  created_at: string;
  purged_at?: string | null;
  // Present when read from the `stories_active` view
  expires_at?: string;
  is_expired?: boolean;
}

export interface StoryWithUser extends Story {
  profiles?: {
    name?: string;
    avatar_url?: string | null;
  };
}

export interface UserStoryGroup {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  stories: StoryWithUser[];
}

// ─── Upload ─────────────────────────────────────────────────────────────

// Path must start with `${userId}/` to satisfy the stories bucket's
// owner-scoped RLS policy.
export const uploadStoryImage = async (
  userId: string,
  imageUri: string,
): Promise<string> => {
  try {
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = `${userId}/${fileName}`;

    await uploadFileToSupabase(imageUri, 'stories', filePath, 'image/jpeg', false, {
      // The composer already runs moderateImage() at photo-selection time
      // (before crop/design), so a redundant re-scan of the flattened final
      // image is skipped — same convention as the post-creation flow.
      skipImageModeration: true,
    });

    const {
      data: { publicUrl },
    } = supabase.storage.from('stories').getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadStoryImage:', error);
    throw error;
  }
};

// ─── Create / delete ────────────────────────────────────────────────────

export const createStory = async (params: {
  userId: string;
  imageUri: string;
  width?: number;
  height?: number;
  taggedProductId?: string | null;
  taggedAccountId?: string | null;
  /** Used only to inform automatic content-rating classification. */
  taggedProductName?: string;
  contentRating?: ContentRating;
}): Promise<Story> => {
  const imageUrl = await uploadStoryImage(params.userId, params.imageUri);

  const contentRating: ContentRating =
    params.contentRating ||
    classifyPostContent(
      '',
      undefined,
      params.taggedProductName ? [params.taggedProductName] : undefined,
    );

  const moderationStatus: ModerationStatus =
    contentRating === 'review_required' ? 'pending_review' : 'approved';

  const insertPayload: Record<string, unknown> = {
    user_id: params.userId,
    image_url: imageUrl,
    content_rating: contentRating,
    moderation_status: moderationStatus,
  };

  if (params.width != null) insertPayload.width = params.width;
  if (params.height != null) insertPayload.height = params.height;
  if (params.taggedProductId) insertPayload.tagged_product_id = params.taggedProductId;
  if (params.taggedAccountId) insertPayload.tagged_account_id = params.taggedAccountId;

  const { data, error } = await supabase
    .from('stories')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('Error creating story:', error);
    throw error;
  }

  // Fire-and-forget: notify followers, but only if the story is approved
  // (mirrors createPost's convention).
  if (data?.id && data?.moderation_status === 'approved') {
    (async () => {
      try {
        const followerIds = await getFollowerIdsOf(params.userId);
        if (followerIds.length > 0) {
          await notifyNewStory(params.userId, data.id, followerIds);
        }
      } catch (e) {
        console.warn('[storiesService] notifyNewStory failed:', e);
      }
    })();
  }

  return data as Story;
};

// Best-effort immediate Storage cleanup on explicit user delete, rather than
// waiting for the expiry purge job.
export const deleteStory = async (storyId: string): Promise<void> => {
  const { data: story } = await supabase
    .from('stories')
    .select('image_url')
    .eq('id', storyId)
    .maybeSingle();

  const { error } = await supabase.from('stories').delete().eq('id', storyId);

  if (error) {
    console.error('Error deleting story:', error);
    throw error;
  }

  if (story?.image_url) {
    const marker = '/object/public/stories/';
    const idx = story.image_url.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(story.image_url.slice(idx + marker.length));
      supabase.storage
        .from('stories')
        .remove([path])
        .catch((e) => console.warn('[storiesService] deleteStory storage cleanup failed:', e));
    }
  }
};

// ─── Fetch ──────────────────────────────────────────────────────────────

// Groups active stories by user for the tray, scoped to who the current
// user follows (plus their own stories, Instagram convention). Own group
// is sorted first, the rest by most recent story activity.
export const fetchStoriesForFollowedUsers = async (
  currentUserId: string,
): Promise<UserStoryGroup[]> => {
  try {
    const followingIds = await getFollowingIds(currentUserId);
    const userIds = Array.from(new Set([...followingIds, currentUserId]));
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('stories_active')
      .select(
        `
        *,
        profiles:user_id (
          name,
          avatar_url
        )
      `,
      )
      .in('user_id', userIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching stories for followed users:', error);
      return [];
    }

    const groups = new Map<string, UserStoryGroup>();
    for (const row of (data || []) as any[]) {
      const uid = row.user_id;
      if (!groups.has(uid)) {
        groups.set(uid, {
          userId: uid,
          username: row.profiles?.name || 'Unknown',
          avatarUrl: row.profiles?.avatar_url ?? null,
          stories: [],
        });
      }
      groups.get(uid)!.stories.push(row as StoryWithUser);
    }

    const groupList = Array.from(groups.values());
    groupList.sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      const aLatest = a.stories[a.stories.length - 1]?.created_at ?? '';
      const bLatest = b.stories[b.stories.length - 1]?.created_at ?? '';
      return bLatest.localeCompare(aLatest);
    });

    return groupList;
  } catch (error) {
    console.error('Error in fetchStoriesForFollowedUsers:', error);
    return [];
  }
};

export const fetchMyStories = async (userId: string): Promise<StoryWithUser[]> => {
  try {
    const { data, error } = await supabase
      .from('stories_active')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching my stories:', error);
      return [];
    }
    return (data || []) as StoryWithUser[];
  } catch (error) {
    console.error('Error in fetchMyStories:', error);
    return [];
  }
};

// ─── Tag hydration (for the viewer's tag pill) ─────────────────────────

export const hydrateTaggedProduct = async (productId: string) => {
  const { data, error } = await supabase
    .from('products_with_discounts')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    console.error('Error hydrating tagged product:', error);
    return null;
  }
  return data;
};

export const hydrateTaggedAccount = async (accountId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    console.error('Error hydrating tagged account:', error);
    return null;
  }
  return data;
};

// ─── View tracking ──────────────────────────────────────────────────────
// Mirrors lib/viewTrackingService.ts's trackPostView: self-view guard +
// client-side session dedup + graceful failure. No date component in the
// dedup key since story_views has no daily reset (a story only lives 24h).

const trackedStoryViews = new Set<string>();

export const markStoryViewed = async (
  storyId: string,
  viewerId: string,
  ownerId: string,
): Promise<void> => {
  if (viewerId === ownerId) return; // no self-views

  const key = `${storyId}:${viewerId}`;
  if (trackedStoryViews.has(key)) return;
  trackedStoryViews.add(key);

  try {
    await supabase.from('story_views').insert({
      story_id: storyId,
      viewer_id: viewerId,
    });
    // UNIQUE(story_id, viewer_id) is handled server-side; the trigger
    // increments stories.view_count on each successful insert.
  } catch {
    trackedStoryViews.delete(key);
  }
};

// Hydrates which of the given story IDs the current user has already
// viewed, for cross-session "seen" ring state on the tray.
export const fetchViewedStoryIds = async (
  viewerId: string,
  storyIds: string[],
): Promise<Set<string>> => {
  if (storyIds.length === 0) return new Set();

  try {
    const { data, error } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', viewerId)
      .in('story_id', storyIds);

    if (error) {
      console.error('Error fetching viewed story ids:', error);
      return new Set();
    }

    const ids = new Set((data || []).map((row) => row.story_id as string));
    ids.forEach((id) => trackedStoryViews.add(`${id}:${viewerId}`));
    return ids;
  } catch (error) {
    console.error('Error in fetchViewedStoryIds:', error);
    return new Set();
  }
};
