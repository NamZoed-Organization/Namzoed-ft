/**
 * MasonryGrid
 *
 * Content-agnostic 2-column masonry layout, generalized from FeedGrid so
 * products, marketplace listings, and services can share the exact same
 * grid system posts use (shortest-column-first greedy fill, so card heights
 * driven by real media aspect ratio stay roughly balanced) instead of each
 * screen hand-rolling its own grid. Pair with GridCard for the tile itself.
 */

import React, { useEffect, useMemo } from "react";
import { Dimensions, Text, View } from "react-native";
import CircularLoader from "@/components/ui/CircularLoader";
import { useGridReveal } from "@/hooks/useGridReveal";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 4;
const GRID_PADDING = GRID_GAP;

interface PositionedItem<T> {
  item: T;
  top: number;
  height: number;
}

function splitIntoColumns<T>(items: T[], getHeight: (item: T, columnWidth: number) => number, columnWidth: number) {
  const left: PositionedItem<T>[] = [];
  const right: PositionedItem<T>[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const item of items) {
    const height = getHeight(item, columnWidth);
    if (leftHeight <= rightHeight) {
      left.push({ item, top: leftHeight, height });
      leftHeight += height;
    } else {
      right.push({ item, top: rightHeight, height });
      rightHeight += height;
    }
  }
  return { left, right };
}

export interface MasonryGridProps<T> {
  items: T[];
  loading: boolean;
  keyExtractor: (item: T) => string;
  /** Predicted render height for an item at the given column width — drives column balancing. */
  getHeight: (item: T, columnWidth: number) => number;
  /** deferred: render a same-size placeholder instead of the real card (far
   * off-screen). priority: "high" for cards on the first screen, so they
   * win bandwidth contention over ones merely pre-revealed ahead of scroll. */
  renderCard: (item: T, columnWidth: number, deferred: boolean, priority: "low" | "normal" | "high") => React.ReactNode;
  emptyText?: string;
}

function MasonryGrid<T>({ items, loading, keyExtractor, getHeight, renderCard, emptyText = "Nothing here yet." }: MasonryGridProps<T>) {
  const columnWidth = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;
  const { left, right } = useMemo(() => splitIntoColumns(items, getHeight, columnWidth), [items, getHeight, columnWidth]);
  const { containerRef, isNear, isAboveFold, markAllRevealed, rearm } = useGridReveal();

  useEffect(() => {
    rearm();
  }, [items.length, rearm]);

  const allRevealed = useMemo(
    () => [...left, ...right].every((p) => isNear(keyExtractor(p.item), p.top, p.height)),
    [left, right, isNear, keyExtractor],
  );
  useEffect(() => {
    if (allRevealed) markAllRevealed();
  }, [allRevealed, markAllRevealed]);

  if (items.length === 0) {
    return (
      <View style={{ paddingHorizontal: GRID_PADDING, paddingVertical: 48, alignItems: "center", backgroundColor: "#F0F1F3" }}>
        {loading ? <CircularLoader size="small" color="#094569" /> : <Text style={{ fontSize: 14, color: "#9CA3AF" }}>{emptyText}</Text>}
      </View>
    );
  }

  return (
    <View ref={containerRef} collapsable={false} style={{ paddingHorizontal: GRID_PADDING, backgroundColor: "#F0F1F3" }}>
      <View style={{ flexDirection: "row", gap: GRID_GAP }}>
        <View style={{ flex: 1 }}>
          {left.map(({ item, top, height }) => (
            <React.Fragment key={keyExtractor(item)}>
              {renderCard(item, columnWidth, !isNear(keyExtractor(item), top, height), isAboveFold(top) ? "high" : "normal")}
            </React.Fragment>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {right.map(({ item, top, height }) => (
            <React.Fragment key={keyExtractor(item)}>
              {renderCard(item, columnWidth, !isNear(keyExtractor(item), top, height), isAboveFold(top) ? "high" : "normal")}
            </React.Fragment>
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

export default React.memo(MasonryGrid) as typeof MasonryGrid;
