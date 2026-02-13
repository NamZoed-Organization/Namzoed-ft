import { useUser } from "@/contexts/UserContext";
import {
  addOneSignalNotificationClickListener,
  ensureOneSignalInitialized,
  identifyOneSignalUser,
  requestOneSignalPermissionIfNeeded,
} from "@/services/oneSignalService";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function OneSignalBootstrap() {
  const { currentUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!ensureOneSignalInitialized()) return;

    requestOneSignalPermissionIfNeeded().catch((error) => {
      console.warn("OneSignal permission request failed:", error);
    });
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
    identifyOneSignalUser(currentUser?.id || null);
  }, [currentUser?.id]);

  return null;
}
