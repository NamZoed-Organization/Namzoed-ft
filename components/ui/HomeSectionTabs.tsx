// Center nav in TopNavbar's home layout: "Explore" (the existing home feed —
// For You / Featured / Live / Norbu / Bidding) vs "Following" (posts from
// users the viewer follows). Plain text buttons with a small underline
// indicator on the active tab, RedNote-style.
//
// **Following becomes a face only while it has something to report.**
// On Explore, if somebody you follow has posted something you have not
// opened, the tab is their picture with a red dot — a word cannot say
// "there is something new from somebody you follow", and that is the only
// reason anybody leaves Explore. The moment you are caught up it goes back
// to the word.
//
// It used to wear a face the whole time you were on Explore, dot or no dot,
// which spent the loudest thing in the header on "yes, the Following tab
// still exists". A picture that is always there is furniture: by the time
// it has something to say nobody is looking at it any more. The face has to
// be able to be absent for its presence to mean anything.
//
// It is also the word whenever Following is the active tab, where the row
// of faces below is doing this job properly and a second face in the header
// would be the same information twice.
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
  /** The most recent person you have something unopened from — the face on
   *  the Following tab while you are looking at Explore. */
  followingAvatarUrl,
  /** Somebody you follow has posted something you have not opened. This is
   *  what decides face-or-word, not just whether the dot is drawn. */
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
        // A face only when there is news behind it, so the header is quiet
        // when there is nothing to say.
        const asFace = key === "following" && !isActive && !!followingUnseen;

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
                  {/* Unconditional: a face is only drawn when there is
                      something unopened, so there is no such thing as a
                      face without its dot any more. Outside the avatar's
                      clip, so the circle never cuts it. */}
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
