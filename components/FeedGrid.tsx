/**
 * FeedGrid
 *
 * RedNote/Xiaohongshu-style 2-column masonry grid of feed posts, used on the
 * Home "For You" tab in place of the old Products/Services/Marketplace
 * sections. Splits posts across two columns with a shortest-column-first
 * greedy fill so card heights (driven by each post's real media aspect
 * ratio) stay roughly balanced, instead of a uniform-height grid.
 */

import PostGridCard, { gridCardImageHeight, PostGridCardSourceRect } from "@/components/PostGridCard";
import CircularLoader from "@/components/ui/CircularLoader";
import { useGridReveal } from "@/hooks/useGridReveal";
import { PostData } from "@/types/post";
import React, { useEffect, useMemo } from "react";
import { Dimensions, Text, View } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 4;
const GRID_PADDING = GRID_GAP;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

interface PositionedPost {
  post: PostData;
  top: number;
  height: number;
}

function splitIntoColumns(posts: PostData[]) {
  const left: PositionedPost[] = [];
  const right: PositionedPost[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const post of posts) {
    if (!post.images?.[0]) continue;
    const height = gridCardImageHeight(post, COLUMN_WIDTH);
    if (leftHeight <= rightHeight) {
      left.push({ post, top: leftHeight, height });
      leftHeight += height;
    } else {
      right.push({ post, top: rightHeight, height });
      rightHeight += height;
    }
  }
  return { left, right };
}

export interface FeedGridProps {
  posts: PostData[];
  loading: boolean;
  onPostPress: (postId: string, rect: PostGridCardSourceRect) => void;
}

function FeedGrid({ posts, loading, onPostPress }: FeedGridProps) {
  const { left, right } = useMemo(() => splitIntoColumns(posts), [posts]);
  const { containerRef, isNear, isAboveFold, markAllRevealed, rearm } = useGridReveal();

  // New posts (e.g. after loadMoreFeedPosts) may have arrived below the
  // point the poll already gave up at — re-arm it so they get checked too.
  useEffect(() => {
    rearm();
  }, [posts.length, rearm]);

  const allRevealed = useMemo(
    () => [...left, ...right].every((p) => isNear(p.post.id, p.top, p.height)),
    [left, right, isNear],
  );
  useEffect(() => {
    if (allRevealed) markAllRevealed();
  }, [allRevealed, markAllRevealed]);

  if (posts.length === 0) {
    return (
      <View
        style={{
          paddingHorizontal: GRID_PADDING,
          paddingVertical: 48,
          alignItems: "center",
          backgroundColor: "#F0F1F3",
        }}
      >
        {loading ? (
          <CircularLoader size="small" color="#094569" />
        ) : (
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
            No posts yet — be the first to share something!
          </Text>
        )}
      </View>
    );
  }

  return (
    <View ref={containerRef} collapsable={false} style={{ paddingHorizontal: GRID_PADDING, backgroundColor: "#F0F1F3" }}>
      <View style={{ flexDirection: "row", gap: GRID_GAP }}>
        <View style={{ flex: 1 }}>
          {left.map(({ post, top, height }) => (
            <PostGridCard
              key={post.id}
              post={post}
              width={COLUMN_WIDTH}
              onPress={onPostPress}
              deferred={!isNear(post.id, top, height)}
              priority={isAboveFold(top) ? "high" : "normal"}
            />
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {right.map(({ post, top, height }) => (
            <PostGridCard
              key={post.id}
              post={post}
              width={COLUMN_WIDTH}
              onPress={onPostPress}
              deferred={!isNear(post.id, top, height)}
              priority={isAboveFold(top) ? "high" : "normal"}
            />
          ))}
        </View>
      </View>
      {loading && (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <CircularLoader size="small" color="#094569" />
        </View>
      )}
    </View>
  );
}

export default React.memo(FeedGrid);
