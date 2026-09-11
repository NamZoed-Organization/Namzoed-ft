/**
 * AddFriendsPreview  (dev only)
 *
 * The Add Friends screen on fixtures. Every state of it depends on data
 * nobody has until two accounts have scanned each other or followed one
 * another — a follow request, an incoming connect request, an outgoing one,
 * a declined row mid-undo, a scan that turned out to be your own code — so
 * this is the only way to judge any of it short of building two accounts
 * and a second phone.
 *
 * It also covers the one thing three stacked people-lists are for finding:
 * whether "Follow requests", "Waiting for you" and "Waiting for them" read
 * as three sections of one screen rather than three different lists.
 *
 * Composes the real components (`AddFriendsView`, `NamzoedQrCard` through
 * it, `ConnectRequestList`, `ScanConfirmSheet`), never lookalikes: a
 * preview made of copies tells you how the copies render and quietly stops
 * matching the day the real screen changes.
 *
 * Starts where the user starts — Add Friends, with the code on it — and the
 * scan results are reachable from the same header action that opens the
 * camera in production, so the step where you find out whether the sheet
 * explains itself isn't skipped.
 *
 * Not reachable outside Settings › Dev Components.
 */

import AddFriendsView from "@/components/qr/AddFriendsView";
import type { ConnectRow } from "@/components/qr/ConnectRequestList";
import ScanConfirmSheet, { type ScanStatus } from "@/components/qr/ScanConfirmSheet";
import type { FollowRequestRow } from "@/components/qr/FollowRequestList";
import type { FollowUser } from "@/lib/followService";
import type { QrConnectRequest, QrProfile } from "@/lib/qrConnectService";
import React, { useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

// Deliberately not uniform: one with a photo and one without, one long name
// that has to truncate, one profile with no namzoed_id (a row saved before
// the column existed, which the card and the row both have to survive), and
// hues far enough apart to tell the per-user cover identity is real.
const PEOPLE: QrProfile[] = [
  {
    id: "fixture-1",
    name: "Pema Choden",
    namzoedId: "tshe85D7",
    avatarUrl: "https://i.pravatar.cc/200?img=47",
    coverImageUrl: null,
    coverHue: 320,
    dzongkhag: "Thimphu",
  },
  {
    id: "fixture-2",
    name: "Karma Wangchuk Dorji Namgyel",
    namzoedId: "drak0F21",
    avatarUrl: null,
    coverImageUrl: null,
    coverHue: 160,
    dzongkhag: "Paro",
  },
  {
    id: "fixture-3",
    name: "Sonam T.",
    namzoedId: null,
    avatarUrl: "https://i.pravatar.cc/200?img=12",
    coverImageUrl: null,
    coverHue: 40,
    dzongkhag: null,
  },
];

const ME: QrProfile = {
  id: "fixture-me",
  name: "Yeshi Thinley",
  namzoedId: "ngam4C90",
  avatarUrl: "https://i.pravatar.cc/200?img=33",
  coverImageUrl: null,
  coverHue: 200,
  dzongkhag: "Thimphu",
};

const request = (person: QrProfile, incoming: boolean): QrConnectRequest => ({
  id: `req-${person.id}-${incoming ? "in" : "out"}`,
  requesterId: incoming ? person.id : ME.id,
  recipientId: incoming ? ME.id : person.id,
  status: "pending",
  createdAt: new Date().toISOString(),
  person,
});

// Followers you haven't followed back. Deliberately mixed: one with a photo
// and a phone number, one with neither (so the row falls back to "Follows
// you" and the initial-less avatar), one whose name is long enough to
// truncate against two pills.
const FOLLOWERS: FollowUser[] = [
  {
    id: "follower-1",
    name: "Tashi Dema",
    phone: "+975 17 88 22 10",
    avatar_url: "https://i.pravatar.cc/200?img=5",
    isFollowingBack: false,
  },
  {
    id: "follower-2",
    name: "Ugyen",
    avatar_url: null,
    isFollowingBack: false,
  },
  {
    id: "follower-3",
    name: "Jigme Singye Wangchuck Dorji",
    phone: "+975 77 40 15 03",
    avatar_url: "https://i.pravatar.cc/200?img=68",
    isFollowingBack: false,
  },
];

/** The axes that change the *layout*, not every prop. */
type Populated = "empty" | "requests";

const SCAN_STATES: { label: string; status: ScanStatus; person: QrProfile | null }[] = [
  { label: "New", status: "new", person: PEOPLE[0] },
  { label: "They scanned you", status: "incoming", person: PEOPLE[1] },
  { label: "Sent", status: "sent", person: PEOPLE[0] },
  { label: "Connected", status: "connected", person: PEOPLE[1] },
  { label: "Your own code", status: "self", person: ME },
  { label: "Not a code", status: "invalid", person: null },
  { label: "Looking up", status: "loading", person: null },
];

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
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

interface AddFriendsPreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddFriendsPreview({ visible, onClose }: AddFriendsPreviewProps) {
  const [populated, setPopulated] = useState<Populated>("requests");
  const [scan, setScan] = useState<number | null>(null);
  /** Local so Confirm / Decline / Undo actually move the rows here — the
   *  point is to see the in-place outcome, not just the resting state. */
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const followRequests = useMemo<FollowRequestRow[]>(() => {
    if (populated === "empty") return [];
    return FOLLOWERS.map((user) => ({
      user,
      outcome: (outcomes[user.id] as FollowRequestRow["outcome"]) ?? "none",
    }));
  }, [populated, outcomes]);

  const incoming = useMemo<ConnectRow[]>(() => {
    if (populated === "empty") return [];
    return [request(PEOPLE[0], true), request(PEOPLE[1], true), request(PEOPLE[2], true)].map(
      (r) => ({ request: r, outcome: (outcomes[r.id] as ConnectRow["outcome"]) ?? "none" }),
    );
  }, [populated, outcomes]);

  const outgoing = useMemo<ConnectRow[]>(() => {
    if (populated === "empty") return [];
    return [request(PEOPLE[1], false)].map((r) => ({
      request: r,
      outcome: (outcomes[r.id] as ConnectRow["outcome"]) ?? "none",
    }));
  }, [populated, outcomes]);

  const mark = (id: string, outcome: string) =>
    setOutcomes((prev) => ({ ...prev, [id]: outcome }));

  const active = scan !== null ? SCAN_STATES[scan] : null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1 }}>
        <AddFriendsView
          me={{
            id: ME.id,
            name: ME.name,
            namzoedId: ME.namzoedId,
            avatarUrl: ME.avatarUrl,
            coverImageUrl: ME.coverImageUrl,
            coverHue: ME.coverHue,
          }}
          followRequests={followRequests}
          incoming={incoming}
          outgoing={outgoing}
          onBack={onClose}
          // Standing in for the camera: the scanner needs a real one, but
          // every screen it can produce is a ScanConfirmSheet state, and
          // those are all here.
          onScan={() => setScan(0)}
          onShareCode={() => setScan(0)}
          onConfirm={(r) => mark(r.id, "accepted")}
          onDecline={(r) => mark(r.id, "declined")}
          onUndoDecline={(r) => mark(r.id, "none")}
          onCancel={(r) => mark(r.id, "declined")}
          onFollowBack={(u) => mark(u.id, "followed")}
          onDismissFollower={(u) => mark(u.id, "dismissed")}
          onUndoDismissFollower={(u) => mark(u.id, "none")}
        />

        {/* Preview controls, pinned over the screen being previewed. */}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            <Toggle
              label="With requests"
              active={populated === "requests"}
              onPress={() => setPopulated("requests")}
            />
            <Toggle
              label="Empty"
              active={populated === "empty"}
              onPress={() => setPopulated("empty")}
            />
            {SCAN_STATES.map((state, i) => (
              <Toggle
                key={state.label}
                label={`Scan: ${state.label}`}
                active={scan === i}
                onPress={() => setScan(scan === i ? null : i)}
              />
            ))}
          </ScrollView>
        </View>

        <ScanConfirmSheet
          visible={active !== null}
          onClose={() => setScan(null)}
          status={active?.status ?? "loading"}
          person={active?.person ?? null}
          submitting={false}
          onPrimary={() => setScan(null)}
        />
      </View>
    </Modal>
  );
}
