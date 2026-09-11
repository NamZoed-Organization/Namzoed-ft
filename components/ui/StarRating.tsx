/**
 * StarRating
 *
 * Five stars, filled to a rating. The one implementation — ProductReviews,
 * ShopReviews and the business header each had their own, which is how three
 * surfaces end up with three slightly different sizes and golds.
 *
 * Rounds to the nearest whole star rather than drawing half ones: at 13pt a
 * half star is a smudge, and the numeric value is always shown beside it for
 * anyone who wants the precision.
 */

import { Star } from "lucide-react-native";
import React from "react";
import { View } from "react-native";

export const RATING_GOLD = "#F5A623";
const EMPTY = "#D1D5DB";

interface StarRatingProps {
  rating: number;
  size?: number;
  gap?: number;
  /** Unrated stars on a dark ground need a lighter empty than on white. */
  emptyColor?: string;
}

export default function StarRating({
  rating,
  size = 13,
  gap = 2,
  emptyColor = EMPTY,
}: StarRatingProps) {
  const filled = Math.round(rating);
  return (
    <View style={{ flexDirection: "row", gap }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= filled;
        return (
          <Star
            key={n}
            size={size}
            color={on ? RATING_GOLD : emptyColor}
            fill={on ? RATING_GOLD : emptyColor}
          />
        );
      })}
    </View>
  );
}
