import TaggedItemsModal from "@/components/modals/TaggedItemsModal";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import {
  hydrateTaggedAccount,
  hydrateTaggedProduct,
  markStoryViewed,
  type StoryWithUser,
  type UserStoryGroup,
} from "@/lib/storiesService";
import type { TaggedAccount, TaggedProduct } from "@/types/post";
import { Image as ExpoImage } from "expo-image";
import { X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STORY_DURATION_MS = 5000;

interface StoryViewerProps {
  visible: boolean;
  onClose: () => void;
  storyGroups: UserStoryGroup[];
  initialGroupIndex: number;
  currentUserId?: string;
  /** Called whenever a group's stories have all been viewed, to update the tray ring. */
  onGroupSeen?: (userId: string) => void;
}

// `progress` is only passed for the currently-active segment; already-played
// or not-yet-reached segments render as a plain static filled/empty bar.
function ProgressBar({ progress, staticFraction }: { progress?: SharedValue<number>; staticFraction?: number }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, progress?.value ?? 0)) * 100}%`,
  }));
  return (
    <View
      style={{
        flex: 1,
        height: 2.5,
        borderRadius: 1.5,
        borderCurve: "continuous",
        backgroundColor: "rgba(255,255,255,0.35)",
        overflow: "hidden",
      }}
    >
      {progress ? (
        <Animated.View style={[{ height: "100%", backgroundColor: "#fff" }, animatedStyle]} />
      ) : (
        <View style={{ height: "100%", width: `${(staticFraction ?? 0) * 100}%`, backgroundColor: "#fff" }} />
      )}
    </View>
  );
}

function StoryGroupPage({
  group,
  isActive,
  currentUserId,
  width,
  onAdvanceGroup,
  onRetreatGroup,
  onGroupSeen,
  onClose,
}: {
  group: UserStoryGroup;
  isActive: boolean;
  currentUserId?: string;
  width: number;
  onAdvanceGroup: () => void;
  onRetreatGroup: () => void;
  onGroupSeen?: (userId: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [storyIndex, setStoryIndex] = useState(0);
  const [tagModal, setTagModal] = useState<{
    products?: TaggedProduct[];
    accounts?: TaggedAccount[];
  } | null>(null);
  const progress = useSharedValue(0);
  const story: StoryWithUser | undefined = group.stories[storyIndex];

  const goToStory = (index: number) => {
    if (index < 0) {
      onRetreatGroup();
      return;
    }
    if (index >= group.stories.length) {
      onAdvanceGroup();
      return;
    }
    setStoryIndex(index);
  };

  const handleNext = () => goToStory(storyIndex + 1);
  const handlePrev = () => goToStory(storyIndex - 1);

  // Drive the active segment's fill + auto-advance timer. Only the currently
  // visible outer page runs its timer; others stay paused on entry/mount.
  useEffect(() => {
    if (!isActive || !story) {
      cancelAnimation(progress);
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: STORY_DURATION_MS }, (finished) => {
      if (finished) runOnJS(handleNext)();
    });
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, storyIndex, story?.id]);

  // View tracking + tray "seen" propagation
  useEffect(() => {
    if (!isActive || !story || !currentUserId) return;
    markStoryViewed(story.id, currentUserId, group.userId);
    onGroupSeen?.(group.userId);
  }, [isActive, story?.id, currentUserId, group.userId, onGroupSeen]);

  // Plain JS helper — cancelAnimation/withTiming are callable from either
  // thread, so this works both from JS callbacks (handleTagPress, the tag
  // modal's onClose) and, wrapped in runOnJS, from gesture worklets.
  const resumeFromPause = () => {
    const remaining = (1 - progress.value) * STORY_DURATION_MS;
    if (remaining <= 0) {
      handleNext();
      return;
    }
    progress.value = withTiming(1, { duration: remaining }, (finished) => {
      if (finished) runOnJS(handleNext)();
    });
  };

  const makeZoneGesture = (onTap: () => void) => {
    const tap = Gesture.Tap()
      .maxDuration(180)
      .onEnd(() => {
        runOnJS(onTap)();
      });
    const longPress = Gesture.LongPress()
      .minDuration(180)
      .onStart(() => {
        cancelAnimation(progress);
      })
      .onEnd(() => {
        runOnJS(resumeFromPause)();
      });
    return Gesture.Exclusive(longPress, tap);
  };

  const leftZoneGesture = makeZoneGesture(handlePrev);
  const rightZoneGesture = makeZoneGesture(handleNext);

  const handleTagPress = async () => {
    if (!story) return;
    cancelAnimation(progress);
    if (story.tagged_product_id) {
      const product = await hydrateTaggedProduct(story.tagged_product_id);
      if (product) {
        setTagModal({
          products: [
            {
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.images?.[0],
              current_price: product.current_price,
              is_currently_active: product.is_currently_active,
              discount_percent: product.discount_percent,
            },
          ],
        });
      }
    } else if (story.tagged_account_id) {
      const account = await hydrateTaggedAccount(story.tagged_account_id);
      if (account) {
        setTagModal({
          accounts: [{ id: account.id, name: account.name, avatar_url: account.avatar_url }],
        });
      }
    }
  };

  if (!story) return <View style={{ width, flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={{ width, flex: 1, backgroundColor: "#000" }}>
      <ProgressiveImage
        uri={story.image_url}
        style={{ flex: 1 }}
        showProgress={false}
        recyclingKey={story.id}
        priority="high"
      />

      {/* Progress bars */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 8,
          right: 8,
          flexDirection: "row",
          gap: 4,
        }}
      >
        {group.stories.map((s, i) =>
          i === storyIndex ? (
            <ProgressBar key={s.id} progress={progress} />
          ) : (
            <ProgressBar key={s.id} staticFraction={i < storyIndex ? 1 : 0} />
          ),
        )}
      </View>

      {/* Header: avatar + name + close */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 20,
          left: 12,
          right: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {group.avatarUrl ? (
          <ExpoImage
            source={{ uri: group.avatarUrl }}
            style={{ width: 32, height: 32, borderRadius: 16 }}
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: "#094569",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {group.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8, flex: 1 }} numberOfLines={1}>
          {group.username}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={16} style={{ padding: 6 }}>
          <X size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tap zones */}
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row" }}>
        <GestureDetector gesture={leftZoneGesture}>
          <View style={{ width: "33%", height: "100%" }} />
        </GestureDetector>
        <GestureDetector gesture={rightZoneGesture}>
          <View style={{ width: "67%", height: "100%" }} />
        </GestureDetector>
      </View>

      {(story.tagged_product_id || story.tagged_account_id) && (
        <TouchableOpacity
          onPress={handleTagPress}
          style={{
            position: "absolute",
            bottom: insets.bottom + 32,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 20,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            {story.tagged_product_id ? "🛍  View Product" : "👤  View Profile"}
          </Text>
        </TouchableOpacity>
      )}

      <TaggedItemsModal
        visible={!!tagModal}
        onClose={() => {
          setTagModal(null);
          resumeFromPause();
        }}
        products={tagModal?.products}
        accounts={tagModal?.accounts}
      />
    </View>
  );
}

export default function StoryViewer({
  visible,
  onClose,
  storyGroups,
  initialGroupIndex,
  currentUserId,
  onGroupSeen,
}: StoryViewerProps) {
  const { width } = useWindowDimensions();
  const [activeGroupIndex, setActiveGroupIndex] = useState(initialGroupIndex);
  const listRef = useRef<FlatList<UserStoryGroup>>(null);

  useEffect(() => {
    if (visible) setActiveGroupIndex(initialGroupIndex);
  }, [visible, initialGroupIndex]);

  const translateY = useSharedValue(0);
  const dismissPan = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd(() => {
      if (translateY.value > 120) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const goToIndex = (index: number) => {
    if (index < 0 || index >= storyGroups.length) {
      onClose();
      return;
    }
    listRef.current?.scrollToIndex({ index, animated: true });
    setActiveGroupIndex(index);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar hidden />
        <GestureDetector gesture={dismissPan}>
          <Animated.View style={[{ flex: 1 }, sheetStyle]}>
            <FlatList
              ref={listRef}
              data={storyGroups}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.userId}
              initialScrollIndex={initialGroupIndex}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveGroupIndex(index);
              }}
              renderItem={({ item, index }) => (
                <StoryGroupPage
                  group={item}
                  isActive={visible && index === activeGroupIndex}
                  currentUserId={currentUserId}
                  width={width}
                  onAdvanceGroup={() => goToIndex(index + 1)}
                  onRetreatGroup={() => goToIndex(index - 1)}
                  onGroupSeen={onGroupSeen}
                  onClose={onClose}
                />
              )}
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
