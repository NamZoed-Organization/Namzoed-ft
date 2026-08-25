import WhatsNewModal from "@/components/modals/WhatsNewModal";
import type { AppUpdateStatus } from "@/hooks/useAppUpdateCheck";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import React from "react";

interface WhatsNewGateProps {
  updateStatus: AppUpdateStatus;
}

/**
 * Mounts at app root, after AppUpdateGate. Auto-shows the "What's New" modal
 * once per new release, the first time the app launches on that version.
 * Stays hidden while a force-update is being enforced, so a blocked user
 * isn't shown release notes for a version they haven't unlocked yet.
 */
export default function WhatsNewGate({ updateStatus }: WhatsNewGateProps) {
  const { hasUnseen, markSeen } = useWhatsNew();

  if (!hasUnseen || updateStatus === "force-update") return null;

  return <WhatsNewModal visible onClose={() => void markSeen()} />;
}
