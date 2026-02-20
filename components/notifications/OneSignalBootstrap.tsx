import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import {
    addOneSignalForegroundNotificationHandler,
    addOneSignalNotificationClickListener,
    ensureOneSignalInitialized,
    ensureOneSignalPushOptedIn,
    identifyOneSignalUser,
    logOneSignalDebugState,
    requestOneSignalPermissionIfNeeded,
} from "@/services/oneSignalService";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function OneSignalBootstrap() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!ensureOneSignalInitialized()) return;

    requestOneSignalPermissionIfNeeded().catch((error) => {
      console.warn("OneSignal permission request failed:", error);
    });

    // Temporary diagnostics for TestFlight/device push mapping.
    const timer = setTimeout(() => {
      logOneSignalDebugState("app_start").catch(() => undefined);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ensureOneSignalInitialized()) return;

    // Suppress push notifications when the app is in the foreground.
    // Real-time chat updates are shown directly in the UI, so a banner is redundant
    // and confusing while the user is actively using the app.
    const handleForegroundNotification = (event: any) => {
      event.preventDefault();
    };

    const unsubscribeForeground = addOneSignalForegroundNotificationHandler(
      handleForegroundNotification,
    );
    return () => {
      unsubscribeForeground?.();
    };
  }, []);

  useEffect(() => {
    if (!ensureOneSignalInitialized()) return;

    const handleNotificationClick = (event: any) => {
      const additionalData = event?.notification?.additionalData as
        | Record<string, unknown>
        | undefined;
      const type = String(additionalData?.type ?? "");
      if (type !== "chat_message") return;

      const chatPartnerId = String(
        additionalData?.chat_partner_id ?? additionalData?.sender_id ?? "",
      );

      if (!chatPartnerId) return;
      router.push(`/(users)/chat/${chatPartnerId}` as any);
    };

    const unsubscribe = addOneSignalNotificationClickListener(
      handleNotificationClick,
    );
    return () => {
      unsubscribe?.();
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;
        setAuthUserId(data.user?.id ?? null);
      })
      .catch(() => undefined);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const externalId = authUserId || currentUser?.id || null;
    identifyOneSignalUser(externalId);

    if (!externalId) return;

    // Temporary diagnostics for external_id + subscription linkage.
    const timer = setTimeout(() => {
      ensureOneSignalPushOptedIn("after_identify_user")
        .then(() =>
          logOneSignalDebugState("after_identify_user", externalId),
        )
        .catch(() => undefined);
    }, 1800);

    return () => clearTimeout(timer);
  }, [authUserId, currentUser?.id]);

  return null;
}
