/**
 * MentionText
 *
 * Renders stored comment text with its mentions bold and tappable — each
 * one opens that person's profile. The `@` is not drawn: it is how a
 * mention is *written*, not what one looks like once it has been made.
 *
 * Plain runs are handed to `HashtagText`, so a comment gets hashtags for
 * free and neither feature has to know about the other.
 *
 * Returns a fragment of strings and `<Text>` runs, so it **must be used
 * inside a parent `<Text>`** — that is what keeps a mention inline in the
 * middle of a sentence rather than breaking it onto its own line, and it
 * inherits the body's font and line height for free. Same contract as
 * `HashtagText`, for the same reason.
 */

import HashtagText from "@/components/ui/HashtagText";
import { splitByMentions } from "@/utils/mentions";
import { useAppRouter } from "@/utils/navigation";
import React from "react";
import { StyleProp, Text, TextStyle } from "react-native";

interface MentionTextProps {
  text: string | null | undefined;
  /** Applied to the mention runs only; plain text inherits the parent. */
  mentionStyle?: StyleProp<TextStyle>;
  /** Set on a measuring copy so an off-screen measurer isn't tappable. */
  disabled?: boolean;
}

export default function MentionText({
  text,
  mentionStyle,
  disabled,
}: MentionTextProps) {
  const router = useAppRouter();
  const segments = React.useMemo(() => splitByMentions(text), [text]);
  if (!segments.length) return null;

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <HashtagText
            key={`t${index}`}
            text={segment.value}
            disabled={disabled}
          />
        ) : (
          <Text
            key={`m${segment.userId}-${index}`}
            // Weight rather than colour: a mention is a person, and the
            // blue in this app already means "a link to a topic"
            // (§ Hashtags). Two blues in one sentence meaning two different
            // things is worse than one that is simply bolder.
            style={[{ fontWeight: "700", color: "#111827" }, mentionStyle]}
            onPress={
              disabled
                ? undefined
                : () => router.push(`/(users)/profile/${segment.userId}` as any)
            }
            suppressHighlighting
          >
            {segment.value}
          </Text>
        ),
      )}
    </>
  );
}
