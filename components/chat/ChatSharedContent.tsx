/**
 * What a conversation has in it: the photos, the links, the voice notes.
 *
 * The three lists off `lib/chatDetails.ts`, drawn from props alone — the
 * fetching lives on the screen (`app/(users)/chat/details/[id].tsx`) and the
 * fixtures live in Dev Components, because none of these three look like
 * anything on empty data and a chat with a year of history is not something
 * anybody can conjure to check a grid's gutters.
 *
 * Media is a contact sheet, three across at a 2pt gap: the job is
 * recognising a photo you remember, not admiring it, and cards with
 * captions would fit a third as many on the screen.
 */

import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsChrome";
import CircularLoader from "@/components/ui/CircularLoader";
import type {
  ChatLinkItem,
  ChatMediaItem,
  ChatVoiceItem,
} from "@/lib/chatDetails";
import { Image } from "expo-image";
import { Link2, Play } from "lucide-react-native";
import React from "react";
import { Dimensions, Linking, Text, TouchableOpacity, View } from "react-native";

const PRIMARY = "#094569";
const SCREEN_WIDTH = Dimensions.get("window").width;
export const CHAT_DETAILS_INSET = 16;
const MEDIA_COLUMNS = 3;
const MEDIA_GAP = 2;
const MEDIA_TILE = Math.floor(
  (SCREEN_WIDTH - CHAT_DETAILS_INSET * 2 - MEDIA_GAP * (MEDIA_COLUMNS - 1)) /
    MEDIA_COLUMNS,
);

export type ChatSharedTab = "media" | "links" | "voice";

const TABS: { key: ChatSharedTab; label: string }[] = [
  { key: "media", label: "Media" },
  { key: "links", label: "Links" },
  { key: "voice", label: "Voice" },
];

export const shortChatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function EmptyLine({ text }: { text: string }) {
  return (
    <Text
      style={{
        fontSize: 15,
        color: "#9CA3AF",
        textAlign: "center",
        paddingHorizontal: 32,
        paddingVertical: 26,
      }}
    >
      {text}
    </Text>
  );
}

export default function ChatSharedContent({
  tab,
  onTabChange,
  loading,
  media,
  links,
  voice,
  onOpenImage,
}: {
  tab: ChatSharedTab;
  onTabChange: (tab: ChatSharedTab) => void;
  loading: boolean;
  media: ChatMediaItem[];
  links: ChatLinkItem[];
  voice: ChatVoiceItem[];
  onOpenImage: (item: ChatMediaItem) => void;
}) {
  return (
    <>
      {/* § Tabs and pills — plain text with a 24x2 underline, never chips. */}
      <View
        style={{
          flexDirection: "row",
          gap: 18,
          paddingHorizontal: CHAT_DETAILS_INSET,
          marginBottom: 12,
        }}
      >
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <TouchableOpacity key={t.key} onPress={() => onTabChange(t.key)}>
              <Text
                style={{
                  fontSize: on ? 17 : 15,
                  fontWeight: on ? "700" : "500",
                  color: on ? "#111827" : "#9CA3AF",
                }}
              >
                {t.label}
              </Text>
              <View
                style={{
                  alignSelf: "center",
                  marginTop: 4,
                  width: 24,
                  height: 2,
                  borderRadius: 1,
                  borderCurve: "continuous",
                  backgroundColor: on ? "#111827" : "transparent",
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <CircularLoader size="small" color={PRIMARY} />
        </View>
      ) : tab === "media" ? (
        media.length === 0 ? (
          <EmptyLine text="No photos or videos in this chat yet." />
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: MEDIA_GAP,
              paddingHorizontal: CHAT_DETAILS_INSET,
              marginBottom: 18,
            }}
          >
            {media.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => onOpenImage(item)}
                style={{
                  width: MEDIA_TILE,
                  height: MEDIA_TILE,
                  backgroundColor: "#E5E7EB",
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: item.url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {item.kind === "video" && (
                  <View
                    style={{
                      position: "absolute",
                      right: 6,
                      bottom: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderCurve: "continuous",
                      backgroundColor: "rgba(17,24,39,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Play size={11} color="#fff" fill="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )
      ) : tab === "links" ? (
        links.length === 0 ? (
          <EmptyLine text="No links have been shared in this chat." />
        ) : (
          <View style={{ paddingHorizontal: CHAT_DETAILS_INSET }}>
            <SettingsGroup>
              {links.map((link, i) => (
                <SettingsRow
                  key={link.id}
                  first={i === 0}
                  icon={Link2}
                  label={link.url.replace(/^https?:\/\//, "")}
                  description={shortChatDate(link.createdAt)}
                  onPress={() => Linking.openURL(link.url).catch(() => {})}
                />
              ))}
            </SettingsGroup>
          </View>
        )
      ) : voice.length === 0 ? (
        <EmptyLine text="No voice messages in this chat." />
      ) : (
        <View style={{ paddingHorizontal: CHAT_DETAILS_INSET }}>
          <SettingsGroup>
            {voice.map((clip) => (
              <View
                key={clip.id}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {/* The chat's own player, so a voice note looks and sounds
                    the same wherever it is played. */}
                <View style={{ flex: 1 }}>
                  <AudioMessagePlayer
                    audioUrl={clip.url}
                    duration={clip.durationSeconds}
                    isCurrentUser={false}
                  />
                </View>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                  {shortChatDate(clip.createdAt)}
                </Text>
              </View>
            ))}
          </SettingsGroup>
        </View>
      )}
    </>
  );
}
