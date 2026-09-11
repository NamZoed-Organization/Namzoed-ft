/**
 * MessagesListPreview  (dev only)
 *
 * The conversation list on fixtures. Almost everything that decides how a
 * row reads is data you cannot conjure on demand — an unread count, an
 * unsent draft, a muted thread, a name long enough to collide with the
 * timestamp, a last message that was a photo rather than text, a
 * conversation old enough to print a weekday instead of a clock. Judging
 * the list without them means judging the one case that happens to be in
 * your own inbox.
 *
 * Composes the real `ConversationRow`, `FrequentContacts`, `PeopleGroup`
 * and `ConversationSkeleton`, never lookalikes — a preview built from
 * copies stops matching the day the real row changes, which is the only
 * thing that keeps it worth trusting.
 *
 * Not reachable outside Settings › Dev Components.
 */

import ConversationRow, {
  CONVERSATION_GROUP_RADIUS,
} from "@/components/messages/ConversationRow";
import FrequentContacts from "@/components/messages/FrequentContacts";
import ConversationSkeleton from "@/components/ui/ConversationSkeleton";
import PeopleGroup, { type PeopleGroupRow } from "@/components/ui/PeopleGroup";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import { ChevronLeft, ChevronRight, MailQuestion, Search } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 16;

const AVATARS = [
  "https://i.pravatar.cc/200?img=47",
  null,
  "https://i.pravatar.cc/200?img=12",
  "https://i.pravatar.cc/200?img=5",
  null,
  "https://i.pravatar.cc/200?img=68",
];

// Deliberately not uniform — the standard's own rule for fixtures. Each row
// exercises something different: a big unread count, a draft, a muted
// thread, a photo preview, a name that must truncate against a timestamp,
// and a conversation old enough to print a date.
const CONVERSATIONS = [
  {
    name: "Pema Choden",
    avatarUrl: AVATARS[0],
    time: "12:04",
    preview: "See you at the market at 6 then",
    unreadCount: 3,
  },
  {
    name: "Karma Wangchuk Dorji Namgyel",
    avatarUrl: AVATARS[1],
    time: "11:20",
    preview: "You: Photo",
    unreadCount: 0,
  },
  {
    name: "Tashi Dema",
    avatarUrl: AVATARS[2],
    time: "Yesterday",
    preview: "the invoice is wrong, it says 12,500 but we agreed",
    draft: "no worries — I'll send the corrected one",
    unreadCount: 0,
  },
  {
    name: "Ugyen",
    avatarUrl: AVATARS[3],
    time: "Yesterday",
    preview: "Voice message",
    unreadCount: 24,
    muted: true,
  },
  {
    name: "Sonam T.",
    avatarUrl: AVATARS[4],
    time: "Tue",
    preview: "No messages yet",
    unreadCount: 0,
  },
  {
    name: "Jigme Singye",
    avatarUrl: AVATARS[5],
    time: "3 Mar",
    preview: "You: Mongoose delivery request",
    unreadCount: 0,
    muted: true,
  },
];

const REQUEST_ROWS: PeopleGroupRow[] = [
  {
    key: "r1",
    name: "Dechen Wangmo",
    avatarUrl: "https://i.pravatar.cc/200?img=32",
    secondary: "Hi — is the dresser still available?",
    actions: [
      { label: "Delete", tone: "quiet" },
      { label: "Accept", tone: "action" },
    ],
  },
  {
    key: "r2",
    name: "Norbu",
    avatarUrl: null,
    secondary: "Photo",
    actions: [
      { label: "Delete", tone: "quiet" },
      { label: "Accept", tone: "action" },
    ],
  },
];

const CONTACTS = CONVERSATIONS.slice(0, 6).map((c, i) => ({
  id: `c${i}`,
  name: c.name,
  avatar: c.avatarUrl,
}));

/** Mirrors MESSAGE_FILTERS on the screen (§ The conversation list). */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "personal", label: "Personal" },
  { key: "business", label: "Business" },
  { key: "mongoose", label: "Mongoose" },
];

type View_ = "list" | "empty" | "loading" | "requests" | "search";

const VIEWS: { key: View_; label: string }[] = [
  { key: "list", label: "Conversations" },
  { key: "search", label: "Search focused" },
  { key: "requests", label: "Message requests" },
  { key: "empty", label: "Empty" },
  { key: "loading", label: "First load" },
];

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: active ? "#0369A1" : "#F5F5F5",
        marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: active ? "#fff" : "#111" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Header({ title, back }: { title: string; back?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 2,
        paddingBottom: 12,
      }}
    >
      {back ? <ChevronLeft size={28} color="#374151" /> : <View style={{ width: 32 }} />}
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>{title}</Text>
      </View>
      <View style={{ width: 32 }} />
    </View>
  );
}

interface MessagesListPreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function MessagesListPreview({ visible, onClose }: MessagesListPreviewProps) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>("list");
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState("all");

  const rows = view === "empty" ? [] : CONVERSATIONS;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
        {/* Only the requests view has a header. The tab root's said
            "Messages" directly above a tab that says "Messages", and went. */}
        {view === "requests" && <Header title="Message requests" back />}

        {view !== "requests" && (
          <View
            style={{
              flexDirection: "row",
              gap: 18,
              paddingHorizontal: GROUP_INSET,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            {["Messages", "Setlog"].map((t, i) => (
              <TouchableOpacity key={t} onPress={() => setTab(i)} style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: tab === i ? 17 : 15,
                    fontWeight: tab === i ? "700" : "500",
                    color: tab === i ? "#111827" : "#9CA3AF",
                  }}
                >
                  {t}
                </Text>
                <View
                  style={{
                    marginTop: 4,
                    width: 24,
                    height: 2,
                    borderRadius: 1,
                    borderCurve: "continuous",
                    backgroundColor: tab === i ? "#111827" : "transparent",
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {view !== "requests" && (
          <View style={{ paddingHorizontal: GROUP_INSET, paddingBottom: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#fff",
                borderRadius: 999,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Search size={18} color="#9CA3AF" strokeWidth={1.8} />
              <Text style={{ marginLeft: 8, fontSize: 15, color: "#9CA3AF" }}>Search</Text>
            </View>
          </View>
        )}

        {view !== "requests" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, paddingBottom: 12 }}
            contentContainerStyle={{ flexDirection: "row", gap: 8, paddingHorizontal: GROUP_INSET }}
          >
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  activeOpacity={0.7}
                  onPress={() => setFilter(f.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderCurve: "continuous",
                    backgroundColor: active ? "#094569" : "#fff",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "600", color: active ? "#fff" : "#6B7280" }}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        >
          {view === "loading" && <ConversationSkeleton count={8} />}

          {view === "requests" && (
            <View style={{ paddingHorizontal: GROUP_INSET }}>
              <PeopleGroup label="Waiting for you" rows={REQUEST_ROWS} />
            </View>
          )}

          {(view === "list" || view === "search" || view === "empty") && (
            <>
              <View style={{ paddingHorizontal: GROUP_INSET }}>
                {view === "search" && (
                  <FrequentContacts contacts={CONTACTS} onPress={() => {}} />
                )}

                {view !== "empty" && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#fff",
                      borderRadius: CONVERSATION_GROUP_RADIUS,
                      borderCurve: "continuous",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      marginBottom: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#F5F5F5",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MailQuestion size={20} color="#9CA3AF" strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
                        Message requests
                      </Text>
                      <Text style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
                        2 people you don&apos;t follow
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#C7C7CC" />
                  </View>
                )}
              </View>

              <View style={{ marginHorizontal: GROUP_INSET }}>
                {rows.map((c, i) => (
                  <ConversationRow
                    key={c.name}
                    {...c}
                    first={i === 0}
                    last={i === rows.length - 1}
                  />
                ))}
              </View>

              {view === "empty" && (
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 22,
                    color: "#9CA3AF",
                    textAlign: "center",
                    paddingHorizontal: 24,
                    paddingTop: 32,
                  }}
                >
                  No conversations yet. Search for someone you follow to start one.
                </Text>
              )}
            </>
          )}
        </ScrollView>

        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.96)",
            borderTopWidth: 1,
            borderTopColor: "#ececec",
            paddingVertical: 10,
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {VIEWS.map((v) => (
              <Toggle
                key={v.key}
                label={v.label}
                active={view === v.key}
                onPress={() => setView(v.key)}
              />
            ))}
            <Toggle label="Close" active={false} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
