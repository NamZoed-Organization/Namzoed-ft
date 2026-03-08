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
    });

    // Diagnostics — only run in development builds.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (__DEV__) {
      timer = setTimeout(() => {
        logOneSignalDebugState("app_start").catch(() => undefined);
      }, 1200);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!ensureOneSignalInitialized()) return;

    // Suppress chat-message pushes in the foreground (real-time UI handles
    // them).  Other notification types (follow, like, live, new post) are
    // allowed through so the native banner appears.
    const handleForegroundNotification = (event: any) => {
      const additionalData = event?.notification?.additionalData as
        | Record<string, unknown>
        | undefined;
      const type = String(additionalData?.type ?? "");
      if (type === "chat_message") {
        event.preventDefault(); // suppress chat banners
      }
      // All other types are shown natively
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

      switch (type) {
        case "chat_message": {
          const chatPartnerId = String(
            additionalData?.chat_partner_id ??
              additionalData?.sender_id ??
              "",
          );
          if (chatPartnerId) {
            router.push(`/(users)/chat/${chatPartnerId}` as any);
          }
          break;
        }
        case "new_follower": {
          const actorId = String(additionalData?.actor_id ?? "");
          if (actorId) {
            router.push(`/(users)/profile/${actorId}` as any);
          } else {
            router.push("/(users)/notifications" as any);
          }
          break;
        }
        case "post_liked":
        case "post_commented":
        case "new_post": {
          // Navigate to the notifications screen to see full context
          router.push("/(users)/notifications" as any);
          break;
        }
        case "user_went_live": {
          // Navigate to feed where LivesBar will surface the active stream
          router.push("/(users)/(tabs)/feed" as any);
          break;
        }
        default:
          // Unknown type — fall back to notifications screen
          router.push("/(users)/notifications" as any);
          break;
      }
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
