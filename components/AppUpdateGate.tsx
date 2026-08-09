import UpdateAvailableModal from "@/components/modals/UpdateAvailableModal";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import React, { useState } from "react";

/**
 * Mounts the version check once at app root and shows the update prompt
 * when needed. Soft "update-available" prompts can be dismissed for the
 * rest of the session; "force-update" cannot be dismissed at all.
 */
export default function AppUpdateGate() {
  const { status, message } = useAppUpdateCheck();
  const [dismissed, setDismissed] = useState(false);

  const shouldShow =
    status === "force-update" || (status === "update-available" && !dismissed);

  if (!shouldShow) return null;

  return (
    <UpdateAvailableModal
      visible
      forceUpdate={status === "force-update"}
      message={message || ""}
      onDismiss={() => setDismissed(true)}
    />
  );
}
