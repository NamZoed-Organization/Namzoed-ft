import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { peekCache, readCache, writeCache } from "@/lib/queryCache";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export interface PostThumbnail {
  postId: string;
  thumbnailUrl: string;
  thumbnailBlurHash: string | null;
  mediaCount: number;
  isVideo: boolean;
  post: Post;
}

const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("post-videos")
  );
};

const postsCacheKey = (userId: string) => `profile:posts:${userId}`;

/** Only `userPosts` is cached (it's the JSON-serialisable source of truth) —
 *  userImages/imagePostMap/postThumbnails are derived from it both here and
 *  after a fresh fetch, so cache seeding and live data stay in lockstep. */
function derivePostsData(posts: Post[]) {
  const allImages: string[] = [];
  const postMap = new Map<string, Post>();
  const thumbnails: PostThumbnail[] = [];

  posts.forEach((post) => {
    if (post.images && post.images.length > 0) {
      thumbnails.push({
        postId: post.id,
        thumbnailUrl: post.images[0],
        thumbnailBlurHash: (post as any).blur_hashes?.[0] ?? null,
        mediaCount: post.images.length,
        isVideo: isVideoUrl(post.images[0]),
        post,
      });

      post.images.forEach((imageUrl: string) => {
        allImages.push(imageUrl);
        postMap.set(imageUrl, post);
      });
    }
  });

  return { allImages, postMap, thumbnails };
}

export const useUserPosts = (
  refreshKey: number,
  showErrorPopup: (message: string) => void,
) => {
  const { currentUser } = useUser();
  const cachedPosts = currentUser?.id
    ? peekCache<Post[]>(postsCacheKey(currentUser.id))?.data ?? null
    : null;
  const cachedDerived = cachedPosts ? derivePostsData(cachedPosts) : null;

  const [userPosts, setUserPosts] = useState<Post[]>(cachedPosts ?? []);
  const [loadingPosts, setLoadingPosts] = useState(!cachedPosts);
  const [userImages, setUserImages] = useState<string[]>(cachedDerived?.allImages ?? []);
  const [imagePostMap, setImagePostMap] = useState<Map<string, Post>>(
    cachedDerived?.postMap ?? new Map(),
  );
  const [postThumbnails, setPostThumbnails] = useState<PostThumbnail[]>(
    cachedDerived?.thumbnails ?? [],
  );

  useEffect(() => {
    const loadPosts = async () => {
      if (!currentUser?.id) {
        setLoadingPosts(false);
        return;
      }
      const key = postsCacheKey(currentUser.id);
      try {
        // Re-navigating to the profile screen unmounts/remounts it, so
        // without this every visit would start blank and refetch from
        // scratch. Seed from cache first (covers a cold app start where the
        // in-memory peek above was empty but AsyncStorage has a prior
        // session's data) so the grid renders instantly, then the fetch
        // below still runs to get the latest.
        const cached = await readCache<Post[]>(key);
        if (cached) {
          setUserPosts(cached.data);
          const derived = derivePostsData(cached.data);
          setUserImages(derived.allImages);
          setImagePostMap(derived.postMap);
          setPostThumbnails(derived.thumbnails);
          setLoadingPosts(false);
        } else {
          setLoadingPosts(true);
        }

        const posts = await fetchUserPosts(currentUser.id);
        setUserPosts(posts);

        const derived = derivePostsData(posts);
        setUserImages(derived.allImages);
        setImagePostMap(derived.postMap);
        setPostThumbnails(derived.thumbnails);
        await writeCache(key, posts);
      } catch (error) {
        console.error("Error loading user posts:", error);
        showErrorPopup("Failed to load your posts");
      } finally {
        setLoadingPosts(false);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadPosts();
    });
    return () => task.cancel();
  }, [currentUser?.id, refreshKey]);

  return {
    userPosts,
    setUserPosts,
    loadingPosts,
    userImages,
    imagePostMap,
    postThumbnails,
  };
};
