/**
 * What's New — changelog content shown in WhatsNewModal.
 *
 * Add a new entry to the top of WHATS_NEW_RELEASES whenever a release ships
 * user-facing changes worth showcasing. The topmost entry's `version` is
 * treated as the "latest" — useWhatsNew() compares it against the last
 * version the user has seen to decide whether to auto-show the modal.
 */

import {
  LucideIcon,
  Palette,
  Rocket,
  Sparkles,
} from "lucide-react-native";

export interface WhatsNewItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface WhatsNewRelease {
  version: string;
  date: string;
  accentColor: string;
  items: WhatsNewItem[];
}

export const WHATS_NEW_RELEASES: WhatsNewRelease[] = [
  {
    version: "2.0.0",
    date: "August 2026",
    accentColor: "#094569",
    items: [
      {
        icon: Palette,
        title: "A Redesigned Look",
        description:
          "We've refreshed the app's design from top to bottom for a cleaner, more modern experience.",
      },
      {
        icon: Sparkles,
        title: "Smoother Everywhere",
        description:
          "Navigation, animations, and everyday interactions feel faster and more polished.",
      },
      {
        icon: Rocket,
        title: "More To Come",
        description:
          "This is just the start — check back here after every update to see what's new.",
      },
    ],
  },
];

/** The newest release's version string, e.g. "2.0.0". */
export const LATEST_WHATS_NEW_VERSION = WHATS_NEW_RELEASES[0]?.version ?? "0.0.0";
