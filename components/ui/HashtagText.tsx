/**
 * HashtagText
 *
 * Renders post text with its hashtags tappable — each one opens the Search
 * screen already searching that topic, and records the tap as a trending
 * signal on the way (see lib/trendingService.ts).
 *
 * Returns a fragment of strings and <Text> runs, so it **must be used inside
 * a parent <Text>** — that's what keeps a hashtag inline in the middle of a
 * caption rather than breaking it onto its own line, and it inherits the
 * caption's own font and line height for free.
 */

import { useUser } from "@/contexts/UserContext";
import { recordTrendingSignal } from "@/lib/trendingService";
import { splitByHashtags } from "@/utils/hashtags";
import { useAppRouter } from "@/utils/navigation";
import React from "react";
import { StyleProp, Text, TextStyle } from "react-native";

interface HashtagTextProps {
  text: string | null | undefined;
  /** Applied to the hashtag runs only; plain text inherits the parent. */
  hashtagStyle?: StyleProp<TextStyle>;
  /** Set on a measuring copy so an off-screen measurer isn't tappable. */
  disabled?: boolean;
}

export default function HashtagText({
  text,
  hashtagStyle,
  disabled,
}: HashtagTextProps) {
  const router = useAppRouter();
  const { currentUser } = useUser();

  const segments = React.useMemo(() => splitByHashtags(text), [text]);
  if (!segments.length) return null;

  const openTag = (term: string) => {
    recordTrendingSignal(term, "hashtag_tap", currentUser?.id);
    router.push(`/(users)/search?q=${encodeURIComponent(term)}` as any);
  };

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          segment.value
        ) : (
          <Text
            key={`${segment.term}-${index}`}
            style={[{ color: "#0369A1" }, hashtagStyle]}
            onPress={disabled ? undefined : () => openTag(segment.term)}
            suppressHighlighting
          >
            {segment.value}
          </Text>
        ),
      )}
    </>
  );
}
