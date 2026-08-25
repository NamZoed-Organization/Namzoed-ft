import CommentAudioPlayer from "@/components/comments/CommentAudioPlayer";
import React from "react";

interface CommentMediaMessageProps {
  url: string;
  duration?: number | null;
  /** True while the voice note is still uploading (shows a spinner overlay). */
  isOptimistic?: boolean;
}

/** Renders a comment/reply's voice note. Image/video attachments render via
 * CommentMediaGallery instead — see that file for the carousel treatment. */
export default function CommentMediaMessage({ url, duration, isOptimistic }: CommentMediaMessageProps) {
  return (
    <CommentAudioPlayer
      audioUrl={url}
      duration={duration ?? 0}
      isOptimistic={isOptimistic}
    />
  );
}
