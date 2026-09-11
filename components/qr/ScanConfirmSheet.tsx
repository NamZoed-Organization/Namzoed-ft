/**
 * ScanConfirmSheet
 *
 * What comes up the moment the camera reads a Namzoed code: who you just
 * scanned, and the one button that is your half of the handshake.
 *
 * There is a sheet here at all because a scan must never be a follow. The
 * camera fires as soon as a code crosses the frame — including one you
 * happened to point at — so the write is deliberately behind a tap on a
 * screen that shows you whose face you are about to be connected to.
 *
 * Presentational: `status` is decided by the scanner screen, which owns
 * every call. That keeps the dev preview able to sit on each state in turn
 * (components/dev/AddFriendsPreview.tsx) without a database.
 *
 * Built on the shared `BottomSheetModal` shell (§ Sheets) — handle,
 * independently-fading backdrop, drag-to-dismiss on the handle alone — and
 * the primary action is a header text action in the standard's two blues,
 * not a coloured pill at the bottom.
 */

import BottomSheetModal from "@/components/modals/BottomSheetModal";
import CircularLoader from "@/components/ui/CircularLoader";
import type { QrProfile } from "@/lib/qrConnectService";
import { Image } from "expo-image";
import { UserRound } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const AVATAR = 72;

export type ScanStatus =
  /** Reading the code / looking the person up. */
  | "loading"
  /** Scanned something that isn't a Namzoed code, or an id with no profile. */
  | "invalid"
  /** Your own code. */
  | "self"
  /** Nothing between you yet — your confirmation is the first. */
  | "new"
  /** They already scanned you: confirming here closes the handshake. */
  | "incoming"
  /** You've confirmed; theirs is outstanding. */
  | "sent"
  /** Both confirmed — you follow each other. */
  | "connected";

interface ScanConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  status: ScanStatus;
  person?: QrProfile | null;
  /** Shown in place of the standard copy for `invalid`. */
  message?: string | null;
  /** A write is in flight — the action swaps for a loader. */
  submitting?: boolean;
  /** The action: adds, confirms, or opens the profile, per `status`. */
  onPrimary?: () => void;
}

/** Title, body, and what the right-hand text action says — all three follow
 *  from the status, so there is one place to read the whole flow. */
function copyFor(status: ScanStatus, name: string): {
  title: string;
  body: string;
  action: string | null;
} {
  switch (status) {
    case "loading":
      return { title: "Scanning", body: "", action: null };
    case "invalid":
      return {
        title: "Not a Namzoed code",
        body: "Point the camera at the code on someone's Add Friends screen.",
        action: null,
      };
    case "self":
      return {
        title: "Your own code",
        body: "This is the code on your Add Friends screen. Show it to someone else to connect.",
        action: null,
      };
    case "incoming":
      return {
        title: "Add friend",
        body: `${name} already scanned your code. Confirm and you'll follow each other.`,
        action: "Confirm",
      };
    case "sent":
      return {
        title: "Request sent",
        body: `Waiting for ${name} to confirm. You'll follow each other once they do.`,
        action: null,
      };
    case "connected":
      return {
        title: "Connected",
        body: `You and ${name} now follow each other.`,
        action: "View profile",
      };
    case "new":
    default:
      return {
        title: "Add friend",
        body: `${name} confirms on their side, then you'll follow each other.`,
        action: "Add",
      };
  }
}

export default function ScanConfirmSheet({
  visible,
  onClose,
  status,
  person,
  message,
  submitting = false,
  onPrimary,
}: ScanConfirmSheetProps) {
  const name = person?.name || "They";
  const { title, body, action } = copyFor(status, name);
  const showPerson = !!person && status !== "invalid";

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="60%">
      {(close) => (
        <View style={{ paddingHorizontal: 16 }}>
          {/* Three parts, at most one text action — § Header, in a sheet. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 8,
            }}
          >
            <View style={{ width: 72 }} />
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>{title}</Text>
            <View style={{ width: 72, alignItems: "flex-end" }}>
              {submitting ? (
                <CircularLoader size="small" color="#094569" />
              ) : action ? (
                <TouchableOpacity
                  onPress={() => {
                    onPrimary?.();
                  }}
                  style={{ paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: 17, fontWeight: "500", color: "#0369A1" }}>
                    {action}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={close} style={{ paddingVertical: 4 }}>
                  <Text style={{ fontSize: 17, fontWeight: "500", color: "#0369A1" }}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            {status === "loading" ? (
              <View style={{ height: AVATAR, justifyContent: "center" }}>
                <CircularLoader size="large" color="#094569" />
              </View>
            ) : showPerson ? (
              <View
                style={{
                  width: AVATAR,
                  height: AVATAR,
                  borderRadius: AVATAR / 2,
                  borderCurve: "continuous",
                  backgroundColor: person?.avatarUrl ? "#E5E7EB" : "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {person?.avatarUrl ? (
                  <Image
                    source={{ uri: person.avatarUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <UserRound size={30} color="#9CA3AF" strokeWidth={1.8} />
                )}
              </View>
            ) : null}

            {showPerson && (
              <>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 12, fontSize: 17, fontWeight: "600", color: "#111827" }}
                >
                  {person?.name}
                </Text>
                {person?.namzoedId ? (
                  <Text style={{ marginTop: 2, fontSize: 15, color: "#9CA3AF" }}>
                    NamZoed ID: {person.namzoedId}
                  </Text>
                ) : null}
              </>
            )}

            {/* Explanatory copy sits below what it explains (§ Multi-field
                screens), never as a label above it. */}
            {status !== "loading" && (
              <Text
                style={{
                  marginTop: showPerson ? 14 : 4,
                  fontSize: 16,
                  lineHeight: 22,
                  color: "#9CA3AF",
                  textAlign: "center",
                  paddingHorizontal: 8,
                }}
              >
                {message || body}
              </Text>
            )}
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
}
