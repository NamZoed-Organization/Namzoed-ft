/**
 * qrConnectService
 *
 * Everything behind the QR "add friend" handshake: what a Namzoed QR code
 * says, how a scan of one turns into a person, and the two confirmations
 * that turn that person into a mutual follow.
 *
 * What the code itself says, and how to read one back, is lib/qrPayload.ts
 * — kept apart so a presentational component can import it without pulling
 * this whole data layer in behind it.
 *
 * Neither side follows anyone until both have confirmed:
 *
 *   1. The scanner sees who they scanned and taps Add   -> `pending` row.
 *   2. The scanned person accepts from Add Friends      -> the database
 *      writes *both* follow rows in one transaction.
 *
 * See supabase/migrations/20260907120000_create_qr_connect_requests.sql for
 * why the requester's follow isn't written at step 1.
 */

import { supabase } from "./supabase";
import {
  notifyQrConnectAccepted,
  notifyQrConnectRequest,
} from "@/services/notificationService";

// ─── people ─────────────────────────────────────────────────────────

export interface QrProfile {
  id: string;
  name: string;
  namzoedId: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  coverHue: number | null;
  dzongkhag: string | null;
}

const toQrProfile = (row: any): QrProfile => ({
  id: row.id,
  name: row.name || "Namzoed user",
  namzoedId: row.namzoed_id ?? null,
  avatarUrl: row.avatar_url ?? null,
  coverImageUrl: row.cover_image_url ?? null,
  coverHue: typeof row.cover_hue === "number" ? row.cover_hue : null,
  dzongkhag: row.dzongkhag ?? null,
});

const PROFILE_COLUMNS = "id, name, namzoed_id, avatar_url, cover_image_url, cover_hue, dzongkhag";

/** `namzoed_id` is unique and stored in the case the generator produced, so
 *  the lookup is case-insensitive (`ilike`) — a code is scanned, but an id
 *  is also typed. */
export async function findProfileByNamzoedId(namzoedId: string): Promise<QrProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .ilike("namzoed_id", namzoedId)
    .maybeSingle();

  if (error) {
    console.error("[qrConnect] findProfileByNamzoedId:", error.message);
    return null;
  }
  return data ? toQrProfile(data) : null;
}

// ─── the handshake ──────────────────────────────────────────────────

export type QrConnectStatus = "pending" | "accepted" | "declined";

export interface QrConnectRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  status: QrConnectStatus;
  createdAt: string;
  /** The other person — the requester on an incoming row, the recipient on
   *  an outgoing one. */
  person: QrProfile;
}

/**
 * Where two people stand with each other, as the scan result sheet needs to
 * describe it. One round trip per question, all fired together.
 */
export interface QrConnectState {
  /** They already follow each other — nothing to confirm. */
  connected: boolean;
  /** We've asked and they haven't answered. */
  outgoingPending: boolean;
  /** They've asked us — accepting is the second confirmation. */
  incomingPendingId: string | null;
}

export async function getConnectState(
  meId: string,
  otherId: string,
): Promise<QrConnectState> {
  const [requests, followsOut, followsIn] = await Promise.all([
    supabase
      .from("qr_connect_requests")
      .select("id, requester_id, recipient_id, status")
      .or(
        `and(requester_id.eq.${meId},recipient_id.eq.${otherId}),` +
          `and(requester_id.eq.${otherId},recipient_id.eq.${meId})`,
      ),
    // limit(1) rather than a bare maybeSingle: `follows` carries no unique
    // constraint on the pair in every deployment, and maybeSingle throws on
    // a second row rather than answering the yes/no being asked.
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", meId)
      .eq("following_id", otherId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", otherId)
      .eq("following_id", meId)
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = requests.data ?? [];
  const incoming = rows.find(
    (r: any) => r.requester_id === otherId && r.status === "pending",
  );
  const outgoing = rows.find(
    (r: any) => r.requester_id === meId && r.status === "pending",
  );

  return {
    connected: !!followsOut.data && !!followsIn.data,
    outgoingPending: !!outgoing,
    incomingPendingId: incoming?.id ?? null,
  };
}

export interface SendConnectResult {
  success: boolean;
  /** 'pending' when we've asked and are waiting; 'accepted' when the other
   *  person had already asked us, so this tap was the second confirmation
   *  and both follows just landed. */
  status?: QrConnectStatus;
  error?: string;
}

/**
 * The scanner's confirmation. Returns 'accepted' — not 'pending' — when the
 * other person had already scanned us, because the database treats that as
 * the second confirmation and connects the two immediately; the sheet says
 * "you're connected" rather than "waiting for them".
 */
export async function sendConnectRequest(
  meId: string,
  person: QrProfile,
): Promise<SendConnectResult> {
  if (meId === person.id) {
    return { success: false, error: "That's your own code." };
  }

  const { data, error } = await supabase.rpc("send_qr_connect_request", {
    p_recipient_id: person.id,
  });

  if (error) {
    console.error("[qrConnect] sendConnectRequest:", error.message);
    return { success: false, error: error.message };
  }

  const status: QrConnectStatus = data?.status ?? "pending";

  // Fire-and-forget: a failed notification must not read as a failed
  // request — the row is already written either way.
  if (status === "accepted") {
    notifyQrConnectAccepted(person.id, meId).catch(() => {});
  } else {
    notifyQrConnectRequest(person.id, meId).catch(() => {});
  }

  return { success: true, status };
}

const REQUEST_COLUMNS = `
  id,
  requester_id,
  recipient_id,
  status,
  created_at,
  requester:profiles!qr_connect_requests_requester_id_fkey (${PROFILE_COLUMNS}),
  recipient:profiles!qr_connect_requests_recipient_id_fkey (${PROFILE_COLUMNS})
`;

const toRequest = (row: any, side: "requester" | "recipient"): QrConnectRequest | null => {
  const joined = Array.isArray(row[side]) ? row[side][0] : row[side];
  if (!joined) return null;
  return {
    id: row.id,
    requesterId: row.requester_id,
    recipientId: row.recipient_id,
    status: row.status,
    createdAt: row.created_at,
    person: toQrProfile(joined),
  };
};

/** People waiting on *our* confirmation. */
export async function fetchIncomingRequests(meId: string): Promise<QrConnectRequest[]> {
  const { data, error } = await supabase
    .from("qr_connect_requests")
    .select(REQUEST_COLUMNS)
    .eq("recipient_id", meId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[qrConnect] fetchIncomingRequests:", error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => toRequest(row, "requester"))
    .filter((r): r is QrConnectRequest => r !== null);
}

/** People we're waiting on. */
export async function fetchOutgoingRequests(meId: string): Promise<QrConnectRequest[]> {
  const { data, error } = await supabase
    .from("qr_connect_requests")
    .select(REQUEST_COLUMNS)
    .eq("requester_id", meId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[qrConnect] fetchOutgoingRequests:", error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => toRequest(row, "recipient"))
    .filter((r): r is QrConnectRequest => r !== null);
}

/** The second confirmation. Both follows are written by the database. */
export async function acceptConnectRequest(
  request: QrConnectRequest,
  meId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("accept_qr_connect_request", {
    p_request_id: request.id,
  });

  if (error) {
    console.error("[qrConnect] acceptConnectRequest:", error.message);
    return { success: false, error: error.message };
  }

  notifyQrConnectAccepted(request.requesterId, meId).catch(() => {});
  return { success: true };
}

export async function declineConnectRequest(
  request: QrConnectRequest,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("decline_qr_connect_request", {
    p_request_id: request.id,
  });

  if (error) {
    console.error("[qrConnect] declineConnectRequest:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Undoing a decline. The row is put back to `pending` rather than deleted,
 * so the requester never learns a decline happened and the Confirm button
 * comes back exactly where it was — the standard's "a row that vanishes
 * under the finger that tapped it gives no way back", applied to a decline.
 */
export async function restoreConnectRequest(
  request: QrConnectRequest,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("qr_connect_requests")
    .update({ status: "pending", responded_at: null })
    .eq("id", request.id);

  if (error) {
    console.error("[qrConnect] restoreConnectRequest:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Taking back a request we sent. Deleting rather than marking it withdrawn
 *  keeps the unique pair free, so scanning them again later starts clean. */
export async function cancelConnectRequest(
  request: QrConnectRequest,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("qr_connect_requests")
    .delete()
    .eq("id", request.id);

  if (error) {
    console.error("[qrConnect] cancelConnectRequest:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
