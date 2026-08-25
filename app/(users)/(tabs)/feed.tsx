/**
 * This route no longer renders a standalone feed screen — the "+" tab opens
 * the create menu directly instead of navigating here (see _layout.tsx).
 * This file still exists only because a handful of notification deep links
 * still push to `/(users)/(tabs)/feed?streamId=` / `?storyUserId=`; it now
 * exists solely to resolve those two cases (open the matching live stream or
 * story) and otherwise bounces straight back to Home.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import { useUser } from "@/contexts/UserContext";
import { useStories } from "@/hooks/useStories";
import type { UserStoryGroup } from "@/lib/storiesService";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";

type StoryViewerProps = {
  visible: boolean;
  onClose: () => void;
  storyGroups: UserStoryGroup[];
  initialGroupIndex: number;
  currentUserId?: string;
  onGroupSeen?: (userId: string) => void;
};

function FeedScreen() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { streamId: deepLinkedStreamId, storyUserId: deepLinkedStoryUserId } = useLocalSearchParams<{
    streamId?: string;
    storyUserId?: string;
  }>();

  const goHome = () => router.replace("/(users)/(tabs)");

  // ── Live deep link ───────────────────────────────────────────────────
  const [showLive, setShowLive] = useState(false);
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
  }> | null>(null);

  useEffect(() => {
    if (!deepLinkedStreamId) return;
    setShowLive(true);
    import("@/components/livestream/LiveScrollScreen").then((m) => setLiveScrollScreen(() => m.default));
  }, [deepLinkedStreamId]);

  // ── Story deep link ──────────────────────────────────────────────────
  const { storyGroups, loading: storiesLoading, markGroupSeen } = useStories(currentUser?.id);
  const [viewingStoryGroups, setViewingStoryGroups] = useState<UserStoryGroup[] | null>(null);
  const [viewingGroupIndex, setViewingGroupIndex] = useState(0);
  const [StoryViewerComponent, setStoryViewerComponent] =
    useState<React.ComponentType<StoryViewerProps> | null>(null);
  const storyDeepLinkHandledRef = useRef(false);

  useEffect(() => {
    if (!deepLinkedStoryUserId || storyDeepLinkHandledRef.current || storiesLoading) return;
    storyDeepLinkHandledRef.current = true;
    const index = storyGroups.findIndex((g) => g.userId === deepLinkedStoryUserId);
    if (index === -1) {
      goHome(); // that user's story has since expired
      return;
    }
    setViewingGroupIndex(index);
    setViewingStoryGroups(storyGroups);
    import("@/components/modals/StoryViewer").then((m) => setStoryViewerComponent(() => m.default));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedStoryUserId, storiesLoading, storyGroups]);

  // Neither deep link present — nothing to do here, bounce back to Home.
  const bouncedRef = useRef(false);
  useEffect(() => {
    if (bouncedRef.current || deepLinkedStreamId || deepLinkedStoryUserId) return;
    bouncedRef.current = true;
    goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedStreamId, deepLinkedStoryUserId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {showLive && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={() => {
            setShowLive(false);
            goHome();
          }}
        >
          {LiveScrollScreen ? (
            <LiveScrollScreen
              initialStreamId={deepLinkedStreamId}
              onClose={() => {
                setShowLive(false);
                goHome();
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
              <CircularLoader size="large" color="#fff" />
            </View>
          )}
        </Modal>
      )}

      {viewingStoryGroups && StoryViewerComponent && (
        <StoryViewerComponent
          visible
          onClose={() => {
            setViewingStoryGroups(null);
            goHome();
          }}
          storyGroups={viewingStoryGroups}
          initialGroupIndex={viewingGroupIndex}
          currentUserId={currentUser?.id}
          onGroupSeen={markGroupSeen}
        />
      )}
    </View>
  );
}

export default FeedScreen;
