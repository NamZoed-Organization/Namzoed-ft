// Center nav in TopNavbar's home layout: "Explore" (the existing home feed —
// For You / Featured / Live / Norbu / Bidding) vs "Following" (posts from
// users the viewer follows). Plain text buttons with a small underline
// indicator on the active tab, RedNote-style.
//
// **While you are on Explore, Following is a face rather than a word.**
// Whoever you follow posted most recently is shown there, with a red dot
// when there is something you have not opened — a word cannot say "there is
// something new from somebody you follow", and that is the only reason
// anybody leaves Explore. It goes back to being the word once you are on
// Following, where the row of faces below is doing that job properly and a
// second face in the header would be the same information twice.
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { UserRound } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export type HomeSection = "explore" | "following";

const SECTIONS: { key: HomeSection; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "explore", label: "Explore" },
];

const AVATAR = 26;

export default function HomeSectionTabs({
  active,
  onChange,
  /** Whoever you follow posted most recently — the face on the Following
   *  tab while you are looking at Explore. */
  followingAvatarUrl,
  /** Somebody you follow has posted something you have not opened. */
  followingUnseen,
}: {
  active: HomeSection;
  onChange: (section: HomeSection) => void;
  followingAvatarUrl?: string | null;
  followingUnseen?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", columnGap: 24 }}>
      {SECTIONS.map(({ key, label }) => {
        const isActive = active === key;
        const asFace = key === "following" && !isActive;

        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={{ alignItems: "center" }}>
              {asFace ? (
                <View style={{ width: AVATAR, height: AVATAR }}>
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
                    {followingAvatarUrl ? (
                      <ProgressiveImage
                        uri={followingAvatarUrl}
                        style={{ width: "100%", height: "100%" }}
                        showProgress={false}
                        recyclingKey={followingAvatarUrl}
                      />
                    ) : (
                      <UserRound size={14} color="#9CA3AF" strokeWidth={1.8} />
                    )}
                  </View>
                  {/* Outside the avatar's clip, so the circle never cuts it. */}
                  {followingUnseen && (
                    <View
                      style={{
                        position: "absolute",
                        top: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        borderCurve: "continuous",
                        backgroundColor: "#DC2626",
                        borderWidth: 1.5,
                        borderColor: "#fff",
                      }}
                    />
                  )}
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: isActive ? "700" : "500",
                    color: isActive ? "#111827" : "#9CA3AF",
                  }}
                >
                  {label}
                </Text>
              )}
              {/* Absolutely positioned so it doesn't add to this View's
                  height — keeps the label itself vertically centered with
                  the hamburger/icon row instead of being pushed up by the
                  underline's layout space. */}
              <View
                style={{
                  position: "absolute",
                  bottom: -6,
                  height: 2,
                  width: isActive ? 22 : 0,
                  borderRadius: 1,
                  borderCurve: "continuous",
                  backgroundColor: "#094569",
                }}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
