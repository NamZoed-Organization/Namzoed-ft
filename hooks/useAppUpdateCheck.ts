import { supabase } from "@/lib/supabase";
import { compareVersions, getCurrentAppVersion } from "@/utils/appUpdate";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export type AppUpdateStatus = "checking" | "up-to-date" | "update-available" | "force-update";

interface AppUpdateCheckResult {
  status: AppUpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  message: string | null;
}

const DEFAULT_UPDATE_MESSAGE =
  "A new version of Namzoed is available. Update now for the latest features and fixes.";
const DEFAULT_FORCE_UPDATE_MESSAGE =
  "This version of Namzoed is no longer supported. Please update to continue.";

/**
 * Checks the app_config Supabase table (one singleton row, hand-maintained
 * per release) against the app's own bundled version, once per mount.
 * Web is never checked — there's no store to update from there.
 */
export function useAppUpdateCheck(): AppUpdateCheckResult {
  const [result, setResult] = useState<AppUpdateCheckResult>({
    status: Platform.OS === "web" ? "up-to-date" : "checking",
    currentVersion: getCurrentAppVersion(),
    latestVersion: null,
    message: null,
  });

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select(
          "ios_latest_version, android_latest_version, ios_min_supported_version, android_min_supported_version, update_message, force_update_message",
        )
        .eq("id", "default")
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setResult((prev) => ({ ...prev, status: "up-to-date" }));
        return;
      }

      const currentVersion = getCurrentAppVersion();
      const latestVersion =
        Platform.OS === "ios" ? data.ios_latest_version : data.android_latest_version;
      const minSupportedVersion =
        Platform.OS === "ios"
          ? data.ios_min_supported_version
          : data.android_min_supported_version;

      let status: AppUpdateStatus = "up-to-date";
      let message: string | null = null;

      if (minSupportedVersion && compareVersions(currentVersion, minSupportedVersion) < 0) {
        status = "force-update";
        message = data.force_update_message || DEFAULT_FORCE_UPDATE_MESSAGE;
      } else if (latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
        status = "update-available";
        message = data.update_message || DEFAULT_UPDATE_MESSAGE;
      }

      setResult({ status, currentVersion, latestVersion: latestVersion || null, message });
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
