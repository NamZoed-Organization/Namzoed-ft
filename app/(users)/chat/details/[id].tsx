/**
 * Chat details — everything the conversation contains, and what you can do
 * about the person in it.
 *
 * Reached by tapping the partner in a chat's header, which used to go
 * straight to their public profile. Their profile is a thing you visit
 * occasionally; what you want from that tap in a chat is nearly always about
 * *this conversation* — the photo they sent last month, the link somebody
 * pasted, silencing the thread, or getting out of it. The profile is still
 * one row down (§ Chat details).
 *
 * Search runs against the whole history rather than the page the chat
 * happens to have loaded — see lib/chatDetails.ts. Tapping a result opens
 * the chat; it does not yet scroll to the message, because the chat pages
 * backwards from newest and jumping to a message from May means loading
 * everything after it.
 */

import ChatImageViewer from "@/components/chat/ChatImageViewer";
import ChatSharedContent, {
  CHAT_DETAILS_INSET as GROUP_INSET,
  shortChatDate as shortDate,
  type ChatSharedTab,
} from "@/components/chat/ChatSharedContent";
import ReportUserModal from "@/components/modals/ReportUserModal";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSwitchRow,
} from "@/components/settings/SettingsChrome";
import CircularLoader from "@/components/ui/CircularLoader";
import { useUser } from "@/contexts/UserContext";
import {
  fetchChatLinks,
  fetchChatMedia,
  fetchChatVoice,
  searchChatMessages,
  type ChatLinkItem,
  type ChatMediaItem,
  type ChatSearchHit,
  type ChatVoiceItem,
} from "@/lib/chatDetails";
import { requestMessageFocus } from "@/lib/chatFocus";
import { blockUser, isUserBlocked, unblockUser } from "@/lib/blockService";
import {
  isConversationMuted,
  toggleMutedConversation,
} from "@/lib/mutedConversations";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import {
  AlertCircle,
  Ban,
  BellOff,
  ChevronLeft,
  Search,
  UserRound,
  Verified,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

export default function ChatDetailsScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const partnerId = typeof id === "string" ? id : "";
  const myId = String(currentUser?.id ?? "");

  const [partner, setPartner] = useState<any>(null);
  const [tab, setTab] = useState<ChatSharedTab>("media");
  const [media, setMedia] = useState<ChatMediaItem[]>([]);
  const [links, setLinks] = useState<ChatLinkItem[]>([]);
  const [voice, setVoice] = useState<ChatVoiceItem[]>([]);
  const [loadingTab, setLoadingTab] = useState(true);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ChatSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // ── Who this is ──
  useEffect(() => {
    if (!partnerId) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("id, name, avatar_url, namzoed_id, dzongkhag")
      .eq("id", partnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setPartner(data);
      });
    return () => {
      alive = false;
    };
  }, [partnerId]);

  useEffect(() => {
    if (!partnerId) return;
    let alive = true;
    isConversationMuted(myId, partnerId).then((m) => alive && setMuted(m));
    if (myId) {
      isUserBlocked(myId, partnerId)
        .then((b) => alive && setBlocked(!!b))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [myId, partnerId]);

  // ── What is in the conversation ──
  // Each tab fetches once, the first time it is opened: three queries over a
  // long history on mount is three waits for two lists nobody has asked to
  // see yet.
  useEffect(() => {
    if (!myId || !partnerId) return;
    let alive = true;
    const loaded =
      (tab === "media" && media.length > 0) ||
      (tab === "links" && links.length > 0) ||
      (tab === "voice" && voice.length > 0);
    if (loaded) {
      setLoadingTab(false);
      return;
    }
    setLoadingTab(true);
    const run =
      tab === "media"
        ? fetchChatMedia(myId, partnerId).then((r) => alive && setMedia(r))
        : tab === "links"
          ? fetchChatLinks(myId, partnerId).then((r) => alive && setLinks(r))
          : fetchChatVoice(myId, partnerId).then((r) => alive && setVoice(r));
    run
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingTab(false);
      });
    return () => {
      alive = false;
    };
    // media/links/voice are the caches this checks, not inputs to re-run on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, myId, partnerId]);

  // ── Search ──
  useEffect(() => {
    const term = query.trim();
    if (!term || !myId || !partnerId) {
      setHits([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchChatMessages(myId, partnerId, term)
        .then((found) => alive && setHits(found))
        .catch(() => alive && setHits([]))
        .finally(() => alive && setSearching(false));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, myId, partnerId]);

  const imageUrls = useMemo(
    () => media.filter((m) => m.kind !== "video").map((m) => m.url),
    [media],
  );

  const partnerName = partner?.name || "This person";

  const onToggleMute = useCallback(async () => {
    const next = await toggleMutedConversation(myId, partnerId);
    setMuted(next.has(partnerId));
  }, [myId, partnerId]);

  const onToggleBlock = useCallback(async () => {
    if (!myId || !partnerId) return;
    try {
      if (blocked) {
        await unblockUser(myId, partnerId);
        setBlocked(false);
      } else {
        await blockUser(myId, partnerId);
        setBlocked(true);
      }
    } catch (e) {
      console.error("Failed to change block state:", e);
    }
  }, [blocked, myId, partnerId]);

  const searching_ = query.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5", paddingTop: insets.top }}>
      {/* § Header — chevron, centred title, no action. */}
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
            Chat details
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={{ paddingHorizontal: 12, alignSelf: "flex-start" }}
        >
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Who you are talking to. The avatar still opens their profile —
            it is one of the things this screen offers, no longer the only
            thing the tap could mean. */}
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 18 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/(users)/profile/${partnerId}` as any)}
            style={{
              width: 86,
              height: 86,
              borderRadius: 43,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {partner?.avatar_url ? (
              <Image
                source={{ uri: partner.avatar_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <UserRound size={34} color="#9CA3AF" strokeWidth={1.8} />
            )}
          </TouchableOpacity>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
              {partnerName}
            </Text>
            {partner?.namzoed_id ? <Verified size={15} color={PRIMARY} /> : null}
          </View>
          {partner?.dzongkhag ? (
            <Text style={{ fontSize: 15, color: "#9CA3AF", marginTop: 2 }}>
              {partner.dzongkhag}
            </Text>
          ) : null}
        </View>

        {/* Search the whole history. It heads the shared content because it
            is the fastest way through all of it — the tabs below are for
            browsing, this is for knowing what you are after. */}
        <View style={{ paddingHorizontal: GROUP_INSET, marginBottom: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#fff",
              borderRadius: 999,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              height: 42,
            }}
          >
            <Search size={16} color="#9CA3AF" strokeWidth={1.8} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search this conversation"
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              style={{ flex: 1, marginLeft: 8, fontSize: 15, color: "#111827" }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {searching_ ? (
          <View style={{ paddingHorizontal: GROUP_INSET }}>
            {searching && hits.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <CircularLoader size="small" color={PRIMARY} />
              </View>
            ) : hits.length === 0 ? (
              <Text style={{ fontSize: 15, color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>
                Nothing in this conversation matches “{query.trim()}”.
              </Text>
            ) : (
              <SettingsGroup>
                {hits.map((hit, i) => (
                  <SettingsRow
                    key={hit.id}
                    first={i === 0}
                    label={hit.mine ? "You" : partnerName}
                    description={hit.text}
                    value={shortDate(hit.createdAt)}
                    // Back into the conversation already on the stack,
                    // carrying which message to land on — not a second copy
                    // of it opened at the bottom (lib/chatFocus.ts).
                    onPress={() => {
                      requestMessageFocus({
                        partnerId: String(partnerId),
                        messageId: hit.id,
                        createdAt: hit.createdAt,
                      });
                      router.back();
                    }}
                  />
                ))}
              </SettingsGroup>
            )}
          </View>
        ) : (
          <>
            <ChatSharedContent
              tab={tab}
              onTabChange={setTab}
              loading={loadingTab}
              media={media}
              links={links}
              voice={voice}
              onOpenImage={(item) => {
                const idx = imageUrls.indexOf(item.url);
                if (idx >= 0) setViewerIndex(idx);
              }}
            />
          </>
        )}

        {/* What you can do about this conversation, and about the person. */}
        <View style={{ paddingHorizontal: GROUP_INSET, marginTop: 6 }}>
          <SettingsGroup>
            <SettingsSwitchRow
              first
              icon={BellOff}
              label="Mute notifications"
              description="No sound or banner from this chat on this device"
              value={muted}
              onValueChange={onToggleMute}
            />
            <SettingsRow
              icon={UserRound}
              label="View profile"
              onPress={() => router.push(`/(users)/profile/${partnerId}` as any)}
            />
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
              first
              icon={Ban}
              label={blocked ? "Unblock" : "Block"}
              description={
                blocked
                  ? "They will be able to message you again"
                  : "They will not be able to message you"
              }
              destructive={!blocked}
              onPress={onToggleBlock}
            />
            <SettingsRow
              icon={AlertCircle}
              label="Report"
              description="For violating the guidelines"
              destructive
              onPress={() => setShowReport(true)}
            />
          </SettingsGroup>
        </View>
      </ScrollView>

      <ChatImageViewer
        visible={viewerIndex !== null}
        images={imageUrls}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

      {myId && partnerId ? (
        <ReportUserModal
          visible={showReport}
          onClose={() => setShowReport(false)}
          targetUserId={partnerId}
          targetUserName={partnerName}
          currentUserId={myId}
          onReportSuccess={() => setShowReport(false)}
        />
      ) : null}
    </View>
  );
}
