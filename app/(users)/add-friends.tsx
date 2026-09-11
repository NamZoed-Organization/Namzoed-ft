/**
 * Add Friends
 *
 * Everything asking to be let into your network, in one place: your own
 * code to be scanned, the follow requests that "+ Add Friends" in the
 * hamburger drawer used to open on the profile, and both directions of the
 * pending QR handshake. Following back a stranger who followed you and
 * confirming a code you scanned are the same decision, and they used to
 * live on two different screens.
 *
 * Nobody follows anybody from a scan alone. A scan writes a `pending` row;
 * the Confirm here is the second half, and the database creates both follow
 * rows together at that moment (see
 * supabase/migrations/20260907120000_create_qr_connect_requests.sql).
 *
 * This file fetches and writes; `AddFriendsView` is the presentation, so
 * the dev preview exercises the real screen without a database.
 */

import AddFriendsView, { type AddFriendsIdentity } from "@/components/qr/AddFriendsView";
import type { ConnectRow } from "@/components/qr/ConnectRequestList";
import type { FollowRequestRow } from "@/components/qr/FollowRequestList";
import ScanConfirmSheet from "@/components/qr/ScanConfirmSheet";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { useQrConnectFlow } from "@/hooks/useQrConnectFlow";
import { fetchFollowers, followUser, type FollowUser } from "@/lib/followService";
import { buildNamzoedQrShareUrl } from "@/lib/qrPayload";
import {
  acceptConnectRequest,
  cancelConnectRequest,
  declineConnectRequest,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  restoreConnectRequest,
  type QrConnectRequest,
} from "@/lib/qrConnectService";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AddFriendsScreen() {
  const router = useAppRouter();
  const { currentUser, setCurrentUser, isLoading } = useUser();
  const { connect } = useLocalSearchParams<{ connect?: string }>();

  const [followRequests, setFollowRequests] = useState<FollowRequestRow[]>([]);
  const [incoming, setIncoming] = useState<ConnectRow[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** currentUser is read from AsyncStorage and can predate a column — a
   *  record saved before namzoed_id existed would leave the card with
   *  nothing to encode, and a stale cover_hue would print the code in
   *  somebody's old colour. So the screen reads its own identity off the
   *  row on mount, exactly as the profile hub does, and starts from the
   *  cached values so the first paint isn't empty. */
  const [me, setMe] = useState<AddFriendsIdentity>({
    id: currentUser?.id,
    name: currentUser?.name || "You",
    namzoedId: currentUser?.namzoed_id ?? null,
    avatarUrl: currentUser?.avatar_url ?? null,
    coverImageUrl: currentUser?.cover_image_url ?? null,
    coverHue: currentUser?.cover_hue ?? null,
  });

  const meId = currentUser?.id;
  const flow = useQrConnectFlow(meId);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const load = useCallback(async () => {
    if (!meId) return;
    // § Feedback and motion — fire everything together and let each slice
    // land on its own; none of the three needs another's answer.
    const [followers, incomingRows, outgoingRows] = await Promise.all([
      fetchFollowers(meId, "desc"),
      fetchIncomingRequests(meId),
      fetchOutgoingRequests(meId),
    ]);
    // A "follow request" here is a follower you haven't followed back —
    // the app has no private accounts, so there is no separate pending
    // state to read. Same derivation the old FollowRequests screen used.
    setFollowRequests(
      followers
        .filter((user) => !user.isFollowingBack)
        .map((user) => ({ user, outcome: "none" as const })),
    );
    setIncoming(incomingRows.map((request) => ({ request, outcome: "none" })));
    setOutgoing(outgoingRows.map((request) => ({ request, outcome: "none" })));
  }, [meId]);

  // Covers the mount as well as every return to the screen — the usual way
  // here is Scan → back, and the request just sent belongs in "Waiting for
  // them" by the time you land.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, namzoed_id, avatar_url, cover_image_url, cover_hue")
        .eq("id", meId)
        .maybeSingle();
      if (cancelled || !data) return;

      const next: AddFriendsIdentity = {
        id: meId,
        name: data.name || currentUserRef.current?.name || "You",
        namzoedId: data.namzoed_id ?? null,
        avatarUrl: data.avatar_url ?? null,
        coverImageUrl: data.cover_image_url ?? null,
        coverHue: typeof data.cover_hue === "number" ? data.cover_hue : null,
      };
      setMe(next);

      // Same sync the profile screen does, so the next screen to read
      // namzoed_id off currentUser gets the real one — state alone would
      // last only this session.
      const cached = currentUserRef.current;
      if (cached && cached.namzoed_id !== next.namzoedId) {
        const updated = { ...cached, namzoed_id: next.namzoedId };
        await AsyncStorage.setItem("currentUser", JSON.stringify(updated));
        setCurrentUser(updated);
      }
    })();

    return () => {
      cancelled = true;
    };
    // currentUser is read through a ref: it is only needed to merge the id
    // back in, and depending on it would refetch on every profile change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  /** A `namzoed://add/<id>` link opened from outside the app lands here
   *  rather than on the camera — there is nothing to scan, but the same
   *  confirmation is still owed. Handled once per id. */
  const handledDeepLink = useRef<string | null>(null);
  useEffect(() => {
    if (!connect || !meId || handledDeepLink.current === connect) return;
    handledDeepLink.current = connect;
    flow.begin(connect);
    // flow.begin is stable per meId; adding `flow` would re-fire on every
    // state change it makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, meId]);

  // ─── row actions ──────────────────────────────────────────────────
  // Each marks its own row rather than dropping it: an accepted row says
  // "You now follow each other" and a declined one dims with Undo, so
  // nothing vanishes under the finger that tapped it (§ People lists).

  const patchRow = (
    set: React.Dispatch<React.SetStateAction<ConnectRow[]>>,
    id: string,
    patch: Partial<ConnectRow>,
  ) => set((rows) => rows.map((r) => (r.request.id === id ? { ...r, ...patch } : r)));

  const runIncoming = useCallback(
    async (
      request: QrConnectRequest,
      call: () => Promise<{ success: boolean; error?: string }>,
      outcome: ConnectRow["outcome"],
    ) => {
      patchRow(setIncoming, request.id, { busy: true });
      const result = await call();
      if (!result.success) {
        patchRow(setIncoming, request.id, { busy: false });
        setError(result.error || "That didn't go through. Try again.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      patchRow(setIncoming, request.id, { busy: false, outcome });
    },
    [],
  );

  const handleConfirm = useCallback(
    (request: QrConnectRequest) => {
      if (!meId) return;
      void runIncoming(request, () => acceptConnectRequest(request, meId), "accepted");
    },
    [meId, runIncoming],
  );

  const handleDecline = useCallback(
    (request: QrConnectRequest) => {
      void runIncoming(request, () => declineConnectRequest(request), "declined");
    },
    [runIncoming],
  );

  const handleUndoDecline = useCallback(
    (request: QrConnectRequest) => {
      void runIncoming(request, () => restoreConnectRequest(request), "none");
    },
    [runIncoming],
  );

  /** Cancelling deletes the row, so this one does leave the list — there is
   *  no state left for it to sit in, and re-sending is a re-scan away. */
  const handleCancel = useCallback(async (request: QrConnectRequest) => {
    patchRow(setOutgoing, request.id, { busy: true });
    const result = await cancelConnectRequest(request);
    if (!result.success) {
      patchRow(setOutgoing, request.id, { busy: false });
      setError(result.error || "Couldn't cancel that request. Try again.");
      return;
    }
    setOutgoing((rows) => rows.filter((r) => r.request.id !== request.id));
  }, []);

  // ─── follow requests ──────────────────────────────────────────────

  const patchFollowRow = (id: string, patch: Partial<FollowRequestRow>) =>
    setFollowRequests((rows) =>
      rows.map((r) => (r.user.id === id ? { ...r, ...patch } : r)),
    );

  const handleFollowBack = useCallback(
    async (user: FollowUser) => {
      if (!meId) return;
      patchFollowRow(user.id, { busy: true });
      const result = await followUser(meId, user.id);
      if (!result.success) {
        patchFollowRow(user.id, { busy: false });
        setError(result.error || "Couldn't follow them back. Try again.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      patchFollowRow(user.id, { busy: false, outcome: "followed" });
    },
    [meId],
  );

  /** Dismissing hides the row for this visit only — there is no table
   *  recording "I saw this and passed", and the list is derived from who
   *  follows you, so it comes back next time. That is what the old
   *  FollowRequests screen did too; the row dims with Undo rather than
   *  vanishing so at least the decision is visibly reversible here. */
  const handleDismissFollower = useCallback((user: FollowUser) => {
    patchFollowRow(user.id, { outcome: "dismissed" });
  }, []);

  const handleUndoDismissFollower = useCallback((user: FollowUser) => {
    patchFollowRow(user.id, { outcome: "none" });
  }, []);

  const handleShareCode = useCallback(async () => {
    const namzoedId = me.namzoedId;
    if (!namzoedId) {
      setError("Your code is still being set up. Try again in a moment.");
      return;
    }
    try {
      // Both fields, as every other share in the app does: iOS takes `url`
      // and would drop a link left only in `message`, Android ignores `url`
      // and shares the text.
      const link = buildNamzoedQrShareUrl(namzoedId);
      await Share.share({
        title: "Add me on Namzoed",
        message: link,
        url: link,
      });
    } catch {
      // The user dismissing the OS sheet lands here too — nothing to say.
    }
  }, [me.namzoedId]);

  return (
    <>
      <AddFriendsView
        me={me}
        followRequests={followRequests}
        incoming={incoming}
        outgoing={outgoing}
        onBack={() => router.back()}
        onScan={() => router.push("/qr-scanner?from=add-friends" as any)}
        onShareCode={handleShareCode}
        onRefresh={load}
        onPressPerson={(request) =>
          router.push(`/(users)/profile/${request.person.id}` as any)
        }
        onConfirm={handleConfirm}
        onDecline={handleDecline}
        onUndoDecline={handleUndoDecline}
        onCancel={handleCancel}
        onPressFollower={(user) => router.push(`/(users)/profile/${user.id}` as any)}
        onFollowBack={handleFollowBack}
        onDismissFollower={handleDismissFollower}
        onUndoDismissFollower={handleUndoDismissFollower}
      />

      <ScanConfirmSheet
        visible={flow.status !== null}
        onClose={() => {
          flow.reset();
          void load();
        }}
        status={flow.status ?? "loading"}
        person={flow.person}
        message={flow.message}
        submitting={flow.submitting}
        onPrimary={() =>
          flow.primary((person) => {
            flow.reset();
            router.push(`/(users)/profile/${person.id}` as any);
          })
        }
      />

      {/* § Feedback — result messages are PopupMessage, not Alert. */}
      <PopupMessage
        visible={error !== null}
        type="error"
        message={error ?? ""}
        onHide={() => setError(null)}
      />

      {/* isLoading guards the flash: currentUser is read from AsyncStorage,
          so it is null for the first frames of a perfectly ordinary
          signed-in session. */}
      <AuthPromptModal
        visible={!isLoading && !currentUser}
        onClose={() => router.back()}
        message="Sign in to add friends"
      />
    </>
  );
}
