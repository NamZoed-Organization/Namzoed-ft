/**
 * Wiring for the grid → post-detail morph (see components/PostDetailOverlay
 * and UI_STANDARD.md § Grid to detail), so a screen that has a grid of posts
 * gets the transition in three lines rather than reimplementing the state
 * each time.
 *
 *   const { openPost, overlayProps } = usePostDetailMorph();
 *   ...
 *   onPress={(_, rect) => openPost(toPostData(thumb.post, author), rect)}
 *   ...
 *   <PostDetailOverlay {...overlayProps} />
 *
 * The rect comes free: GridCard measures itself on press and passes its
 * on-screen frame as the second argument to onPress.
 */

import type { GridCardSourceRect } from "@/components/GridCard";
import { PostData } from "@/types/post";
import { useCallback, useState } from "react";

export function usePostDetailMorph() {
  const [post, setPost] = useState<PostData | null>(null);
  const [sourceRect, setSourceRect] = useState<GridCardSourceRect | null>(null);
  const [visible, setVisible] = useState(false);

  const openPost = useCallback((next: PostData, rect: GridCardSourceRect) => {
    setPost(next);
    setSourceRect(rect);
    setVisible(true);
  }, []);

  // The post is kept mounted after closing so the shrink animation still has
  // something to draw; the overlay returns null on !visible anyway.
  const close = useCallback(() => setVisible(false), []);

  return {
    openPost,
    overlayProps: { visible, post, sourceRect, onClose: close },
  };
}
