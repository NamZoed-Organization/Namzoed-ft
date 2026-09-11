/**
 * The export's way back into the app it was made in.
 *
 * Both editors could send a day to Instagram, TikTok or X and had no way to
 * put it on Namzoed — the one place the people in it already are. This is
 * that destination, and it is the same composer the "+" button opens, not a
 * second posting path: the file is handed in as if it had just been picked,
 * so the Vision scan, the tagging, the location, the content rating and the
 * publish all behave exactly as they do for any other post.
 *
 * **A collage becomes a post; a reel becomes a post that is also a Reel.**
 * There is no separate reels table in this app — `fetchVideoReels` reads the
 * feed and keeps the posts whose media is a video (lib/postsService.ts). So
 * offering "post or reel" as a choice would be a control with nothing behind
 * it: what decides is whether the export is a picture or a video, which the
 * recorder already chose back on the export screen. The caption says which
 * one they are about to get instead of pretending to ask.
 *
 * The composer is a full-screen `Modal` here rather than a route, the same
 * way the profile mounts it — the editor underneath keeps its state, so
 * backing out of the composer returns to the reel exactly as it was rather
 * than to a re-render that has to fetch the day again.
 */

import CreatePost, { type ComposerSeedMedia } from "@/components/modals/CreatePost";
import React from "react";
import { Modal, View } from "react-native";

export default function PostToNamzoed({
  media,
  caption,
  onClose,
}: {
  /** Null when closed. The file is local and already rendered. */
  media: ComposerSeedMedia | null;
  caption?: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={media != null}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Keyed on the file, so opening a second export after changing the
            grid seeds the composer again instead of reusing the instance
            that has already spent its one-shot seed. */}
        {media && (
          <CreatePost
            key={media.uri}
            initialMedia={[media]}
            initialText={caption}
            onClose={onClose}
          />
        )}
      </View>
    </Modal>
  );
}
