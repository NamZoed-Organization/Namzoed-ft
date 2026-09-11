/**
 * useQrConnectFlow
 *
 * The scanner's half of the QR handshake, as state. Two screens start it —
 * the camera (app/(users)/qr-scanner.tsx) and Add Friends, when the app was
 * opened by a `namzoed://add/<id>` link someone tapped rather than scanned
 * — and both then render the same `ScanConfirmSheet` off this state, so the
 * two entry points can't drift into telling the user different things.
 *
 * `begin` is idempotent per payload while a code is on screen: the camera
 * fires `onBarcodeScanned` continuously for as long as a code is in frame,
 * and without the guard a single code would fan out into a lookup per
 * frame.
 */

import { useCallback, useRef, useState } from "react";
import type { ScanStatus } from "@/components/qr/ScanConfirmSheet";
import { parseNamzoedQrPayload } from "@/lib/qrPayload";
import {
  acceptConnectRequest,
  findProfileByNamzoedId,
  getConnectState,
  sendConnectRequest,
  type QrConnectRequest,
  type QrProfile,
} from "@/lib/qrConnectService";

export interface QrConnectFlow {
  /** Null while nothing has been scanned — the sheet stays down. */
  status: ScanStatus | null;
  person: QrProfile | null;
  /** Replaces the status's own copy; set for the "invalid" variants. */
  message: string | null;
  submitting: boolean;
  /** Feed it whatever the camera (or the deep link) produced. */
  begin: (rawPayload: string) => void;
  /** Add / Confirm / View profile — whichever the status is offering. */
  primary: (onViewProfile?: (person: QrProfile) => void) => void;
  /** Puts the sheet away and re-arms the camera. */
  reset: () => void;
}

export function useQrConnectFlow(meId: string | undefined): QrConnectFlow {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [person, setPerson] = useState<QrProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** The pending request from *them* to us, when there is one — accepting
   *  it is what "Confirm" does in the `incoming` state. */
  const incomingRef = useRef<QrConnectRequest | null>(null);
  /** Set for as long as a result is on screen, so repeated frames of the
   *  same code are ignored rather than re-queried. */
  const handlingRef = useRef(false);

  const reset = useCallback(() => {
    handlingRef.current = false;
    incomingRef.current = null;
    setStatus(null);
    setPerson(null);
    setMessage(null);
    setSubmitting(false);
  }, []);

  const begin = useCallback(
    (rawPayload: string) => {
      if (handlingRef.current) return;
      handlingRef.current = true;

      const namzoedId = parseNamzoedQrPayload(rawPayload);
      if (!namzoedId) {
        setPerson(null);
        setMessage(null);
        setStatus("invalid");
        return;
      }

      setStatus("loading");
      setPerson(null);
      setMessage(null);

      (async () => {
        const found = await findProfileByNamzoedId(namzoedId);
        if (!found) {
          setMessage(`No Namzoed profile has the ID ${namzoedId}.`);
          setStatus("invalid");
          return;
        }

        setPerson(found);

        if (!meId) {
          setMessage("Sign in to add friends.");
          setStatus("invalid");
          return;
        }
        if (found.id === meId) {
          setStatus("self");
          return;
        }

        const state = await getConnectState(meId, found.id);
        if (state.connected) {
          setStatus("connected");
          return;
        }
        if (state.incomingPendingId) {
          incomingRef.current = {
            id: state.incomingPendingId,
            requesterId: found.id,
            recipientId: meId,
            status: "pending",
            createdAt: new Date().toISOString(),
            person: found,
          };
          setStatus("incoming");
          return;
        }
        setStatus(state.outgoingPending ? "sent" : "new");
      })().catch((error) => {
        console.error("[useQrConnectFlow] begin:", error);
        setMessage("Couldn't read that code. Try again.");
        setStatus("invalid");
      });
    },
    [meId],
  );

  const primary = useCallback(
    (onViewProfile?: (p: QrProfile) => void) => {
      if (!person) return;

      if (status === "connected") {
        onViewProfile?.(person);
        return;
      }
      if (!meId || submitting) return;

      setSubmitting(true);

      const run = async () => {
        if (status === "incoming" && incomingRef.current) {
          const result = await acceptConnectRequest(incomingRef.current, meId);
          if (!result.success) {
            setMessage(result.error || "Couldn't confirm. Try again.");
            setStatus("invalid");
            return;
          }
          setStatus("connected");
          return;
        }

        const result = await sendConnectRequest(meId, person);
        if (!result.success) {
          setMessage(result.error || "Couldn't send that request. Try again.");
          setStatus("invalid");
          return;
        }
        // 'accepted' comes back when they had already scanned us, so this
        // tap was the second confirmation rather than the first.
        setStatus(result.status === "accepted" ? "connected" : "sent");
      };

      run()
        .catch((error) => {
          console.error("[useQrConnectFlow] primary:", error);
          setMessage("Couldn't send that request. Try again.");
          setStatus("invalid");
        })
        .finally(() => setSubmitting(false));
    },
    [meId, person, status, submitting],
  );

  return { status, person, message, submitting, begin, primary, reset };
}
