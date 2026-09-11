/**
 * ConnectRequestList
 *
 * The QR handshake half of Add Friends: who scanned your code and is
 * waiting on your confirmation, and whose code you scanned and are waiting
 * on. Both directions are the same list with different pills, because they
 * are the same fact seen from either end.
 *
 * An adapter over `PeopleGroup` — it decides what a row says and which
 * pills it carries, and nothing about how a row is drawn. Nothing here
 * writes: the screen owns the calls and hands back `rows` with the outcome
 * already applied, which is what lets a decline dim in place and offer Undo
 * instead of disappearing under the finger that tapped it.
 */

import PeopleGroup, { type PeopleGroupAction, type PeopleGroupRow } from "@/components/ui/PeopleGroup";
import type { QrConnectRequest } from "@/lib/qrConnectService";
import React from "react";

/** What happened to a row since it loaded, so it can say so in place. */
export type ConnectRowOutcome = "none" | "accepted" | "declined";

export interface ConnectRow {
  request: QrConnectRequest;
  outcome: ConnectRowOutcome;
  /** A call is in flight for this row — its pills go to a loader. */
  busy?: boolean;
}

interface ConnectRequestListProps {
  label: string;
  rows: ConnectRow[];
  direction: "incoming" | "outgoing";
  onPressPerson?: (request: QrConnectRequest) => void;
  onConfirm?: (request: QrConnectRequest) => void;
  onDecline?: (request: QrConnectRequest) => void;
  onUndoDecline?: (request: QrConnectRequest) => void;
  onCancel?: (request: QrConnectRequest) => void;
}

function secondaryLine(row: ConnectRow, direction: ConnectRequestListProps["direction"]): string {
  if (row.outcome === "accepted") return "You now follow each other";
  if (row.outcome === "declined") return "Declined";
  if (direction === "outgoing") return "Waiting for them to confirm";
  return row.request.person.namzoedId
    ? `NamZoed ID: ${row.request.person.namzoedId}`
    : "Scanned your code";
}

export default function ConnectRequestList({
  label,
  rows,
  direction,
  onPressPerson,
  onConfirm,
  onDecline,
  onUndoDecline,
  onCancel,
}: ConnectRequestListProps) {
  const groupRows: PeopleGroupRow[] = rows.map((row) => {
    const { request } = row;

    let actions: PeopleGroupAction[];
    if (row.outcome === "accepted") {
      actions = [{ label: "Connected", tone: "quiet" }];
    } else if (row.outcome === "declined") {
      actions = [{ label: "Undo", tone: "quiet", onPress: () => onUndoDecline?.(request) }];
    } else if (direction === "outgoing") {
      actions = [{ label: "Cancel", tone: "quiet", onPress: () => onCancel?.(request) }];
    } else {
      actions = [
        { label: "Decline", tone: "quiet", onPress: () => onDecline?.(request) },
        { label: "Confirm", tone: "action", onPress: () => onConfirm?.(request) },
      ];
    }

    return {
      key: request.id,
      name: request.person.name,
      avatarUrl: request.person.avatarUrl,
      secondary: secondaryLine(row, direction),
      actions,
      busy: row.busy,
      dimmed: row.outcome === "declined",
      onPress: () => onPressPerson?.(request),
    };
  });

  return <PeopleGroup label={label} rows={groupRows} />;
}
