/**
 * AddFriendsView
 *
 * Add Friends, as presentation only. Your own code at the top, then
 * everything asking to be let into your network underneath: people who
 * already follow you and whom you don't follow back, then the two sides of
 * the QR handshake — people waiting on you, and people you are waiting on.
 *
 * Follow requests lead because they are the ones that were already there
 * when the screen opened; the connect requests come from something the user
 * just did.
 *
 * Split out from `app/(users)/add-friends.tsx` (which fetches and writes)
 * so `components/dev/AddFriendsPreview.tsx` can render the real screen on
 * fixtures — this screen's whole look depends on data nobody has until two
 * accounts have scanned each other, which is exactly the case the standard
 * asks for a preview.
 *
 * Chrome is § Header: chevron, centred title, one text action (Scan — the
 * other half of this screen, and the only thing here worth a header slot).
 * The screen paints `SETTINGS_BACKGROUND` behind the status bar and below
 * the last row, per § Grounds.
 */

import ConnectRequestList, { type ConnectRow } from "@/components/qr/ConnectRequestList";
import FollowRequestList, { type FollowRequestRow } from "@/components/qr/FollowRequestList";
import NamzoedQrCard from "@/components/qr/NamzoedQrCard";
import { SETTINGS_BACKGROUND, SettingsGroup, SettingsRow } from "@/components/settings/SettingsChrome";
import PullToRefresh from "@/components/ui/PullToRefresh";
import type { FollowUser } from "@/lib/followService";
import type { QrConnectRequest } from "@/lib/qrConnectService";
import { ChevronLeft, ScanLine, Share2 } from "lucide-react-native";
import React from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface AddFriendsIdentity {
  id?: string;
  name: string;
  namzoedId: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  coverHue?: number | null;
}

interface AddFriendsViewProps {
  me: AddFriendsIdentity;
  // The three lists are independent and each defaults to empty. A section
  // that hasn't arrived renders as absent, which is also what it looks like
  // when it is genuinely empty — the screen has no reason to fall over
  // because one of its three callers is a frame behind (a Fast Refresh mid
  // edit is the everyday case, and it took the whole screen down).
  /** Followers you don't follow back — the old FollowRequests screen. */
  followRequests?: FollowRequestRow[];
  incoming?: ConnectRow[];
  outgoing?: ConnectRow[];
  onBack: () => void;
  onScan: () => void;
  onShareCode: () => void;
  onRefresh?: () => Promise<unknown> | unknown;
  onPressPerson?: (request: QrConnectRequest) => void;
  onConfirm?: (request: QrConnectRequest) => void;
  onDecline?: (request: QrConnectRequest) => void;
  onUndoDecline?: (request: QrConnectRequest) => void;
  onCancel?: (request: QrConnectRequest) => void;
  onPressFollower?: (user: FollowUser) => void;
  onFollowBack?: (user: FollowUser) => void;
  onDismissFollower?: (user: FollowUser) => void;
  onUndoDismissFollower?: (user: FollowUser) => void;
}

export default function AddFriendsView({
  me,
  followRequests = [],
  incoming = [],
  outgoing = [],
  onBack,
  onScan,
  onShareCode,
  onRefresh,
  onPressPerson,
  onConfirm,
  onDecline,
  onUndoDecline,
  onCancel,
  onPressFollower,
  onFollowBack,
  onDismissFollower,
  onUndoDismissFollower,
}: AddFriendsViewProps) {
  const insets = useSafeAreaInsets();
  const nothingPending =
    followRequests.length === 0 && incoming.length === 0 && outgoing.length === 0;

  const body = (
    <>
      <NamzoedQrCard
        userId={me.id}
        name={me.name}
        namzoedId={me.namzoedId}
        avatarUrl={me.avatarUrl}
        coverImageUrl={me.coverImageUrl}
        coverHue={me.coverHue}
        caption="Have someone scan this. You'll follow each other once you both confirm."
      />

      <SettingsGroup>
        <SettingsRow icon={ScanLine} label="Scan someone's code" onPress={onScan} first />
        <SettingsRow icon={Share2} label="Share my code" onPress={onShareCode} />
      </SettingsGroup>

      {/* Already-there before this screen existed: people who followed you
          and are waiting to be followed back. */}
      <FollowRequestList
        label="Follow requests"
        rows={followRequests}
        onPressPerson={onPressFollower}
        onFollowBack={onFollowBack}
        onDismiss={onDismissFollower}
        onUndoDismiss={onUndoDismissFollower}
      />

      <ConnectRequestList
        label="Waiting for you"
        rows={incoming}
        direction="incoming"
        onPressPerson={onPressPerson}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onUndoDecline={onUndoDecline}
      />

      <ConnectRequestList
        label="Waiting for them"
        rows={outgoing}
        direction="outgoing"
        onPressPerson={onPressPerson}
        onCancel={onCancel}
      />

      {/* The state most people are in most of the time, so it says what to
          do rather than that there is nothing here. */}
      {nothingPending && (
        <Text
          style={{
            fontSize: 16,
            lineHeight: 22,
            color: "#9CA3AF",
            textAlign: "center",
            paddingHorizontal: 24,
            paddingTop: 4,
          }}
        >
          No requests yet. Scan a friend&apos;s code, or let them scan yours.
        </Text>
      )}
    </>
  );

  const header = (
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
      <TouchableOpacity onPress={onBack} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
        <ChevronLeft size={28} color="#374151" />
      </TouchableOpacity>

      {/* Absolutely centred against the row's full height (§ Header). */}
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
        <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>Add friends</Text>
      </View>

      <TouchableOpacity onPress={onScan} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: "500", color: "#0369A1" }}>Scan</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
      {/* The screen underneath in the stack may have set light-content. */}
      <StatusBar barStyle="dark-content" />
      {header}

      {onRefresh ? (
        <PullToRefresh onRefresh={onRefresh}>
          {({ indicator, scrollEnabled, onScroll }) => (
            <>
              {indicator}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: Math.max(insets.bottom, 16) + 24,
                }}
                showsVerticalScrollIndicator={false}
                scrollEnabled={scrollEnabled}
                onScroll={onScroll}
                scrollEventThrottle={16}
                bounces={false}
                overScrollMode="never"
              >
                {body}
              </ScrollView>
            </>
          )}
        </PullToRefresh>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      )}
    </View>
  );
}
