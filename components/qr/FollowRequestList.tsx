/**
 * FollowRequestList
 *
 * People who already follow you and whom you don't follow back — the list
 * `components/modals/FollowRequests.tsx` opens as its own screen, rendered
 * here as a section of Add Friends so that everything asking to be let into
 * your network is in one place. Following a stranger back and confirming a
 * scanned code are the same decision, and they were on two screens.
 *
 * Not the old modal embedded: that one is a bordered white card per person
 * on a tinted ground with green and grey status chips, which § People lists
 * and § Icons both rule out. Same data, this app's list.
 *
 * The same adapter-over-`PeopleGroup` shape as `ConnectRequestList`, and
 * for the same reason — the two sit directly above and below each other on
 * the screen, so a row that differs by two points of padding is obvious.
 */

import PeopleGroup, { type PeopleGroupAction, type PeopleGroupRow } from "@/components/ui/PeopleGroup";
import type { FollowUser } from "@/lib/followService";
import React from "react";

/** What happened to a row since it loaded. `dismissed` is local to the
 *  session — see the note on `onDismiss` in `app/(users)/add-friends.tsx`. */
export type FollowRowOutcome = "none" | "followed" | "dismissed";

export interface FollowRequestRow {
  user: FollowUser;
  outcome: FollowRowOutcome;
  busy?: boolean;
}

interface FollowRequestListProps {
  label: string;
  rows: FollowRequestRow[];
  onPressPerson?: (user: FollowUser) => void;
  onFollowBack?: (user: FollowUser) => void;
  onDismiss?: (user: FollowUser) => void;
  onUndoDismiss?: (user: FollowUser) => void;
}

function secondaryLine(row: FollowRequestRow): string {
  if (row.outcome === "followed") return "You now follow each other";
  if (row.outcome === "dismissed") return "Dismissed";
  // The phone number when there is one, because on this list it's often the
  // only way to tell which "Karma" this is. "Follows you" would restate the
  // section label, which § People lists calls out as not a badge.
  return row.user.phone || "Follows you";
}

export default function FollowRequestList({
  label,
  rows,
  onPressPerson,
  onFollowBack,
  onDismiss,
  onUndoDismiss,
}: FollowRequestListProps) {
  const groupRows: PeopleGroupRow[] = rows.map((row) => {
    const { user } = row;

    let actions: PeopleGroupAction[];
    if (row.outcome === "followed") {
      actions = [{ label: "Following", tone: "quiet" }];
    } else if (row.outcome === "dismissed") {
      actions = [{ label: "Undo", tone: "quiet", onPress: () => onUndoDismiss?.(user) }];
    } else {
      actions = [
        { label: "Dismiss", tone: "quiet", onPress: () => onDismiss?.(user) },
        { label: "Follow back", tone: "action", onPress: () => onFollowBack?.(user) },
      ];
    }

    return {
      key: user.id,
      name: user.name,
      avatarUrl: user.avatar_url ?? null,
      secondary: secondaryLine(row),
      actions,
      busy: row.busy,
      dimmed: row.outcome === "dismissed",
      onPress: () => onPressPerson?.(user),
    };
  });

  return <PeopleGroup label={label} rows={groupRows} />;
}
