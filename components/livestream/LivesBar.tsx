/**
 * LivesBar
 *
 * An Instagram/iMessage-style horizontal scroll row shown at the top of the
 * feed. Each avatar has a pulsing red/gradient ring to indicate "LIVE" and
 * tapping it opens that specific stream via the `onJoin` callback.
 *
 * The component owns its own real-time subscription through `useLivestreams`
 * so it stays fresh without any parent having to pass the data down.
 */
import { useLivestreams } from "@/hooks/useLivestreams";
import type { Livestream } from "@/services/livestreamService";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, Radio } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
    FlatList,
    Image,
    Modal,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

interface LivesBarProps {
  /** Called when the user taps a live avatar */
  onJoin: (stream: Livestream) => void;
  /** Called when the user picks Go Live from the Create menu */
  onGoLive: () => void;
  /** Called when the user picks Create Post from the Create menu */
  onCreatePost: () => void;
  /** Changes when the parent wants to force a live list refresh */
  refreshKey?: number;
}

/** Pulsing ring wrapper around a live avatar */
const LiveRingAvatar = React.memo(function LiveRingAvatar({
  stream,
  onPress,
}: {
  stream: Livestream;
  onPress: () => void;
}) {
  const name =
    stream.username ?? stream.user_id?.slice(0, 6) ?? "Live";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ alignItems: "center", marginRight: 14, width: 68 }}
    >
      {/* Gradient ring */}
      <View
        style={{
          borderRadius: 36,
          padding: 2.5,
        }}
      >
        <LinearGradient
          colors={["#FF3B30", "#FF6B35", "#FF3B30"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 34,
            padding: 2,
          }}
        >
          {/* White gap between ring and avatar (Instagram style) */}
          <View
            style={{
              borderRadius: 30,
              padding: 2,
              backgroundColor: "white",
            }}
          >
            {stream.profile_image ? (
              <Image
                source={{ uri: stream.profile_image }}
                style={{ width: 52, height: 52, borderRadius: 26 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#094569",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "white", fontWeight: "700", fontSize: 20 }}
                >
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* LIVE badge */}
      <View
        style={{
          backgroundColor: "#FF3B30",
          borderRadius: 4,
          paddingHorizontal: 5,
          paddingVertical: 1,
          marginTop: -8,
          zIndex: 1,
          borderWidth: 1.5,
          borderColor: "white",
        }}
      >
        <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>
          LIVE
        </Text>
      </View>

      {/* Name */}
      <Text
        style={{
          fontSize: 11,
          color: "#374151",
          marginTop: 4,
          textAlign: "center",
        }}
        numberOfLines={1}
      >
        {name.length > 9 ? name.slice(0, 8) + "…" : name}
      </Text>
    </TouchableOpacity>
  );
});

export default function LivesBar({ onJoin, onGoLive, onCreatePost, refreshKey }: LivesBarProps) {
  const { livestreams, loading } = useLivestreams(refreshKey);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<View>(null);

  const openMenu = () => {
    buttonRef.current?.measureInWindow((x, y, _w, h) => {
      setMenuPos({ top: y + h + 4, left: x });
      setShowMenu(true);
    });
  };

  // Always render — the Create button must stay visible even when no one is live

  return (
    <View
      style={{
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      {/* Create button — fixed left, ref'd so we can measure its screen position */}
      <View ref={buttonRef} collapsable={false} style={{ alignItems: "center", marginLeft: 12, marginRight: 14, width: 68 }}>
        <TouchableOpacity
          onPress={openMenu}
          activeOpacity={0.85}
          style={{ alignItems: "center" }}
        >
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#f3f4f6",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "#e5e7eb",
              borderStyle: "dashed",
            }}
          >
            <Plus size={26} color="#374151" strokeWidth={1.5} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: "#374151", textAlign: "center" }}>
              Create
            </Text>
   
          </View>
        </TouchableOpacity>
      </View>

      {/* Dropdown in a transparent Modal — renders above everything, never clipped */}
      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                width: 152,
                backgroundColor: "white",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 12,
                overflow: "hidden",
              }}
            >
              <TouchableOpacity
                onPress={() => { setShowMenu(false); onCreatePost(); }}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Plus size={16} color="#1877F2" strokeWidth={1.5} />
                <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: "500", color: "#374151" }}>
                  Create Post
                </Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 12 }} />

              <TouchableOpacity
                onPress={() => { setShowMenu(false); onGoLive(); }}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Radio size={16} color="#DC2626" strokeWidth={1.5} />
                <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: "500", color: "#374151" }}>
                  Go Live
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Scrollable live avatars */}
      <FlatList
        horizontal
        data={livestreams}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 12 }}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <LiveRingAvatar
            stream={item}
            onPress={() => onJoin(item)}
          />
        )}
      />
    </View>
  );
}
