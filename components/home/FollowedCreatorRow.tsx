/**
 * The people you follow, as a row of faces above their posts.
 *
 * The Following tab was a single mixed wall with no way to say "just this
 * person" and no sign of who had been busy. A face is how anybody thinks
 * about that — you go looking for a person, not for a post — so the filter
 * is the person, and the dot says who is worth opening.
 *
 * **"All" is a face too**, and it leads. Making it a text chip beside a row
 * of avatars would have it read as a different kind of control from the
 * things it sits with; as the first item in the same row, at the same size,
 * it is plainly one of the choices.
 *
 * **The ring is selection, the dot is news.** They are different questions —
 * "what am I looking at" and "who has posted" — so they never share a
 * colour: the ring is the brand blue, the dot is the app's red, and an
 * avatar can carry both at once without either being ambiguous.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import type { FollowedCreator } from "@/hooks/useFollowedCreators";
import { Layers, UserRound } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const AVATAR = 54;
const RING = 2;
const ACCENT = "#094569";
const NEWS = "#DC2626";

export default function FollowedCreatorRow({
  creators,
  selected,
  onSelect,
  background = "#fff",
}: {
  creators: FollowedCreator[];
  /** `null` is everybody — the default. */
  selected: string | null;
  onSelect: (creatorId: string | null) => void;
  background?: string;
}) {
  if (creators.length === 0) return null;

  return (
    <View style={{ backgroundColor: background, paddingTop: 10, paddingBottom: 6 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}
      >
        <Face
          label="All"
          active={selected === null}
          onPress={() => onSelect(null)}
          icon={<Layers size={20} color={selected === null ? ACCENT : "#9CA3AF"} strokeWidth={1.8} />}
        />

        {creators.map((creator) => (
          <Face
            key={creator.id}
            label={creator.name}
            active={selected === creator.id}
            unseen={creator.unseen}
            avatarUrl={creator.avatarUrl}
            onPress={() => onSelect(creator.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Face({
  label,
  active,
  unseen,
  avatarUrl,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  unseen?: boolean;
  avatarUrl?: string | null;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ width: AVATAR + 8, alignItems: "center" }}
    >
      <View
        style={{
          width: AVATAR + RING * 2 + 4,
          height: AVATAR + RING * 2 + 4,
          borderRadius: (AVATAR + RING * 2 + 4) / 2,
          borderCurve: "continuous",
          borderWidth: active ? RING : 0,
          borderColor: ACCENT,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: AVATAR / 2,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: "#F3F4F6",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <ProgressiveImage
              uri={avatarUrl}
              style={{ width: "100%", height: "100%" }}
              showProgress={false}
              recyclingKey={avatarUrl}
            />
          ) : (
            (icon ?? <UserRound size={22} color="#9CA3AF" strokeWidth={1.8} />)
          )}
        </View>

        {/* Outside the avatar's own clip, so it is never cut in half by the
            circle it sits on. */}
        {unseen && (
          <View
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              width: 13,
              height: 13,
              borderRadius: 7,
              borderCurve: "continuous",
              backgroundColor: NEWS,
              borderWidth: 2,
              borderColor: "#fff",
            }}
          />
        )}
      </View>

      <Text
        numberOfLines={1}
        style={{
          fontSize: 11.5,
          marginTop: 4,
          maxWidth: AVATAR + 8,
          textAlign: "center",
          fontWeight: active ? "700" : "500",
          color: active ? "#111827" : "#6B7280",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
