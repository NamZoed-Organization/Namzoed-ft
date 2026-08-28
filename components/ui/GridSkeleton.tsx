/**
 * GridSkeleton
 *
 * Two-column shimmering skeleton grid — the app's default "content is
 * loading" placeholder for grid-shaped screens (Home's feed/live/featured
 * tabs, Categories, Marketplace). Swapped in for CircularLoader spinners on
 * these screens because a shaped placeholder that mirrors the incoming
 * layout reads as faster and feels less jarring when the real content pops
 * in, versus a spinner that gives no sense of what's about to load.
 *
 * Two card shapes:
 *  - "card"   image-on-top tile (products, posts, marketplace listings,
 *             live streams) — matches GridCard/PostGridCard proportions.
 *  - "avatar" profile-style tile (featured sellers) — centered circular
 *             avatar over name/subtitle lines, matches FeaturedSellers'
 *             UserCard.
 */

import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

interface GridSkeletonProps {
  /** Number of two-card rows to render. Use a small number (e.g. 1) for a
   * lightweight "loading more" footer, and 2-3 for a full-screen initial
   * loading state. */
  rows?: number;
  variant?: "card" | "avatar";
  /** Image/avatar block height in px (variant "card" only). */
  imageHeight?: number;
}

export default function GridSkeleton({
  rows = 3,
  variant = "card",
  imageHeight = 150,
}: GridSkeletonProps) {
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerOpacity]);

  const SkeletonBox = ({
    width,
    height,
    className,
  }: {
    width?: string | number;
    height?: number;
    className?: string;
  }) => (
    <Animated.View
      className={`bg-gray-300 rounded ${className || ""}`}
      style={{
        opacity: shimmerOpacity,
        width: width ?? "100%",
        height: height ?? 16,
      }}
    />
  );

  const CardTile = ({ tileKey }: { tileKey: string | number }) => (
    <View
      key={tileKey}
      className="flex-1 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
    >
      <SkeletonBox height={imageHeight} className="w-full" />
      <View className="p-3">
        <SkeletonBox width="80%" height={16} className="mb-2" />
        <SkeletonBox width="100%" height={12} className="mb-1" />
        <SkeletonBox width="60%" height={12} className="mb-3" />
        <SkeletonBox width="50%" height={18} />
      </View>
    </View>
  );

  const AvatarTile = ({ tileKey }: { tileKey: string | number }) => (
    <View
      key={tileKey}
      className="flex-1 bg-white rounded-lg shadow-sm border border-gray-100 p-3 items-center"
    >
      <SkeletonBox width={64} height={64} className="rounded-full mb-2" />
      <SkeletonBox width="70%" height={14} className="mb-2" />
      <SkeletonBox width="45%" height={11} />
    </View>
  );

  const Tile = variant === "avatar" ? AvatarTile : CardTile;

  return (
    <View>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <View
          key={rowIndex}
          className={`flex-row justify-between gap-3 ${
            rowIndex < rows - 1 ? "mb-3" : ""
          }`}
        >
          <Tile tileKey={`${rowIndex}-a`} />
          <Tile tileKey={`${rowIndex}-b`} />
        </View>
      ))}
    </View>
  );
}
