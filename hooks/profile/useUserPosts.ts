import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { useEffect, useState } from "react";

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

        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            post.images.forEach((imageUrl: string) => {
              allImages.push(imageUrl);
              postMap.set(imageUrl, post);
            });
          }
        });

        setUserImages(allImages);
        setImagePostMap(postMap);
      } catch (error) {
        console.error("Error loading user posts:", error);
        showErrorPopup("Failed to load your posts");
      } finally {
        setLoadingPosts(false);
      }
    };

    loadPosts();
  }, [currentUser?.id, refreshKey]);

  return {
    userPosts,
    setUserPosts,
    loadingPosts,
    userImages,
    imagePostMap,
  };
};
