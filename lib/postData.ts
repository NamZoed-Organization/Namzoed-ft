/**
 * The one conversion from a database post row to the PostData shape FeedPost
 * and PostDetailOverlay consume.
 *
 * It lived privately inside app/(users)/post/[id].tsx, which was fine while
 * that screen was the only thing opening a post from outside the Home feed.
 * Now that every grid morphs into PostDetailOverlay directly, each of those
 * screens needs the same conversion, and a fourth copy of it is how the
 * shapes quietly drift apart.
 *
 * `fallbackAuthor` exists because not every query joins the author: the
 * profile grids fetch a single user's posts and already know whose they are
 * (fetchUserPosts doesn't select `profiles`), while the liked/commented
 * grids come back as PostWithUser and carry their own.
 */

import { parseMediaDisplay } from "@/lib/postMediaDisplay";
import type { Post, PostWithUser } from "@/lib/postsService";
import { PostData } from "@/types/post";

export interface PostAuthorFallback {
  name?: string | null;
  avatarUrl?: string | null;
}

export function toPostData(
  post: Post | PostWithUser,
  fallbackAuthor?: PostAuthorFallback,
): PostData {
  const profiles = (post as PostWithUser).profiles;
  const username =
    profiles?.name ||
    fallbackAuthor?.name ||
    profiles?.email?.split("@")[0] ||
    "Unknown User";

  return {
    id: post.id,
    userId: post.user_id,
    username,
    profilePic: profiles?.avatar_url || fallbackAuthor?.avatarUrl || undefined,
    content: post.content,
    images: post.images,
    blurHashes: (post as any).blur_hashes ?? undefined,
    date: new Date(post.created_at),
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    mediaDisplay: parseMediaDisplay((post as any).media_display),
    locationName: (post as any).location_name ?? undefined,
    tagged_products: (post as any).tagged_products ?? undefined,
    tagged_accounts: (post as any).tagged_accounts ?? undefined,
    view_count: (post as any).view_count ?? 0,
  };
}
