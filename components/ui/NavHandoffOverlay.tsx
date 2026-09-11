/**
 * The loading overlay for the gap between a navigation and its screen —
 * see utils/navHandoff.ts for what it is covering and why it is a store
 * rather than a context.
 *
 * Mounted once at the root, above the Stack, so it survives the navigation
 * itself: the screen that starts the handoff is frequently gone by the time
 * it ends, and an overlay owned by that screen would vanish with it, exactly
 * during the wait it exists to cover.
 */

import React from "react";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import { useNavHandoff } from "@/utils/navHandoff";

export default function NavHandoffOverlay() {
  return <LoadingOverlay visible={useNavHandoff()} />;
}
