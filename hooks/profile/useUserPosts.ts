import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export interface PostThumbnail {
  postId: string;
  thumbnailUrl: string;
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

export const useUserPosts = (
  refreshKey: number,
  showErrorPopup: (message: string) => void,
) => {
  const { currentUser } = useUser();
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [imagePostMap, setImagePostMap] = useState<Map<string, Post>>(
    new Map(),
  );
  const [postThumbnails, setPostThumbnails] = useState<PostThumbnail[]>([]);

  useEffect(() => {
    const loadPosts = async () => {
      if (!currentUser?.id) {
        setLoadingPosts(false);
        return;
      }
      try {
        setLoadingPosts(true);
        const posts = await fetchUserPosts(currentUser.id);
        setUserPosts(posts);

        const allImages: string[] = [];
        const postMap = new Map<string, Post>();
        const thumbnails: PostThumbnail[] = [];

        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            thumbnails.push({
              postId: post.id,
              thumbnailUrl: post.images[0],
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

        setUserImages(allImages);
        setImagePostMap(postMap);
        setPostThumbnails(thumbnails);
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
