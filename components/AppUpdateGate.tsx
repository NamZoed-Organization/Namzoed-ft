import UpdateAvailableModal from "@/components/modals/UpdateAvailableModal";
import type { AppUpdateStatus } from "@/hooks/useAppUpdateCheck";
import React, { useState } from "react";

interface AppUpdateGateProps {
  status: AppUpdateStatus;
  message: string | null;
}

/**
 * Shows the update prompt when needed, driven by a version check performed
 * once at app root (see app/_layout.tsx) and passed down as props. Soft
 * "update-available" prompts can be dismissed for the rest of the session;
 * "force-update" cannot be dismissed at all.
 */
export default function AppUpdateGate({ status, message }: AppUpdateGateProps) {
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
