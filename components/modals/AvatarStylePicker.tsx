/**
 * Choosing a generated avatar.
 *
 * Every style DiceBear serves, drawn with this account's own seed — so the
 * grid is not a catalogue of somebody else's samples, it is sixty-one
 * versions of *you*, and picking one is a comparison rather than a leap of
 * faith. The seed never changes, so the tile you tapped is exactly the
 * avatar you get (§ Generated avatars).
 *
 * Tiles rather than rows here, where the services directory went the other
 * way: the thing being chosen is a picture, the labels are two words, and
 * the whole point is seeing many at once.
 *
 * The grid is raster — sixty-one PNGs that `expo-image` caches — and only
 * the preview at the top is the live SVG, because that is the one avatar
 * whose animation anybody can actually see. See
 * `components/ui/GeneratedAvatar.tsx` for why that split exists.
 */

import GeneratedAvatar from "@/components/ui/GeneratedAvatar";
import FilterPills from "@/components/ui/FilterPills";
import {
  DICEBEAR_STYLES,
  DEFAULT_AVATAR_STYLE,
  avatarSeed,
  dicebearPngUrl,
  isAnimatedStyle,
  type AvatarAnimation,
} from "@/lib/dicebear";
import { Image } from "expo-image";
import { ChevronLeft } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";
const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMNS = 3;
const INSET = 16;
const GAP = 12;

/** Off first, because the animated styles are also perfectly good still —
 *  and an avatar that moves in every list is a decision, not a default. */
const SPEEDS: { value: AvatarAnimation; label: string }[] = [
  { value: "none", label: "Still" },
  { value: "slow", label: "Slow" },
  { value: "medium", label: "Medium" },
  { value: "fast", label: "Fast" },
];

export default function AvatarStylePicker({
  visible,
  userId,
  /** What the profile is wearing now, so the sheet opens on it. */
  currentStyle,
  currentAnimation = "none",
  onClose,
  onSave,
  saving = false,
}: {
  visible: boolean;
  userId: string;
  currentStyle?: string | null;
  currentAnimation?: AvatarAnimation;
  onClose: () => void;
  onSave: (style: string, animation: AvatarAnimation) => void;
  saving?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const seed = avatarSeed(userId);
  const [style, setStyle] = useState(currentStyle || DEFAULT_AVATAR_STYLE);
  const [animation, setAnimation] = useState<AvatarAnimation>(currentAnimation);

  // Reopening on a profile that changed elsewhere should not show the last
  // session's choice.
  React.useEffect(() => {
    if (!visible) return;
    setStyle(currentStyle || DEFAULT_AVATAR_STYLE);
    setAnimation(currentAnimation);
  }, [visible, currentStyle, currentAnimation]);

  const tile = useMemo(
    () => Math.floor((SCREEN_WIDTH - INSET * 2 - GAP * (COLUMNS - 1)) / COLUMNS),
    [],
  );

  const animates = isAnimatedStyle(style);
  const unchanged = style === currentStyle && animation === currentAnimation;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#f5f5f5", paddingTop: insets.top }}>
        {/* § Header — chevron, centred title, one text action. */}
        <View style={{ height: 52, justifyContent: "center" }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>
              Generated avatar
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 12,
            }}
          >
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={saving}>
              <ChevronLeft size={28} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(style, animates ? animation : "none")}
              disabled={saving || unchanged}
              hitSlop={10}
            >
              {saving ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: unchanged ? "#C7C7CC" : PRIMARY,
                  }}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={DICEBEAR_STYLES}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: INSET }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 18 }}>
              {/* The one avatar that actually moves. */}
              <GeneratedAvatar
                seed={seed}
                style={style}
                animation={animation}
                size={120}
              />
              <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 10 }}>
                {animates
                  ? "This one can move"
                  : "Drawn from your account, so it never changes on its own"}
              </Text>
              {animates ? (
                <View style={{ alignSelf: "stretch", marginTop: 12 }}>
                  <FilterPills
                    options={SPEEDS}
                    value={animation}
                    onChange={setAnimation}
                    inset={INSET}
                    paddingBottom={0}
                  />
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const selected = item.id === style;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setStyle(item.id)}
                style={{ width: tile, marginBottom: 16, alignItems: "center" }}
              >
                <View
                  style={{
                    width: tile,
                    height: tile,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? PRIMARY : "#EFEFEF",
                  }}
                >
                  <Image
                    source={{ uri: dicebearPngUrl(item.id, seed) }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: selected ? "600" : "400",
                    color: selected ? "#111" : "#6B7280",
                    marginTop: 6,
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}
