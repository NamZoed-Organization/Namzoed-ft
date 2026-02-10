import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type IncomingBanner = {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
};

type UnreadMessagesContextType = {
  unreadCount: number;
  banner: IncomingBanner | null;
  activeChatPartnerId: string | null;
  currentUserUUID: string | null;
  dismissBanner: () => void;
  setActiveChatPartnerId: (partnerId: string | null) => void;
  refreshUnreadCount: () => Promise<void>;
  markConversationAsRead: (partnerId: string) => Promise<void>;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(
  undefined,
);

export const UnreadMessagesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser } = useUser();
  const [currentUserUUID, setCurrentUserUUID] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [banner, setBanner] = useState<IncomingBanner | null>(null);
  const [activeChatPartnerId, setActiveChatPartnerId] = useState<string | null>(
    null,
  );
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unreadFallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const latestBannerMessageIdRef = useRef<string | null>(null);

  const dismissBanner = useCallback(() => {
    setBanner(null);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  }, []);

  const getCurrentUserUUID = useCallback(async () => {
    if (!currentUser) {
      const { data: authData } = await supabase.auth.getUser();
      return authData.user?.id ?? null;
    }

    const userPhone =
      currentUser.phone_number ||
      (currentUser as any)?.phone ||
      (currentUser as any)?.phoneNumber ||
      (currentUser as any)?.mobile;

    if (currentUser.id) {
      const { data: byId } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (byId?.id) return byId.id;
    }

    if (!userPhone) return null;
    const cleanPhone = String(userPhone).replace("+975", "");

    const { data: byPhone } = await supabase
      .from("profiles")
      .select("id")
      .or(`phone.eq.${userPhone},phone.eq.${cleanPhone}`)
      .maybeSingle();

    if (byPhone?.id) return byPhone.id;

    const { data: authData } = await supabase.auth.getUser();
    return authData.user?.id ?? null;
  }, [currentUser]);

  const refreshUnreadCount = useCallback(async () => {
    if (!currentUserUUID) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", currentUserUUID)
      .eq("is_read", false);

    setUnreadCount(count || 0);
  }, [currentUserUUID]);

  const buildAndShowBanner = useCallback(async (message: any) => {
    if (!message?.id) return;

    const messageId = String(message.id);
    if (latestBannerMessageIdRef.current === messageId) return;
    latestBannerMessageIdRef.current = messageId;

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("name, username, full_name, phone")
      .eq("id", message.sender_id)
      .maybeSingle();

    const senderName =
      senderProfile?.name ||
      senderProfile?.username ||
      senderProfile?.full_name ||
      (senderProfile?.phone ? `+975${senderProfile.phone}` : "New message");

    setBanner({
      messageId,
      senderId: String(message.sender_id),
      senderName,
      content:
        message.content?.trim() ||
        (message.message_type === "image"
          ? "Sent a photo"
          : message.message_type === "audio"
            ? "Sent a voice message"
            : "New message"),
    });

    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setBanner(null);
      bannerTimerRef.current = null;
    }, 5000);
  }, []);

  const pollLatestUnreadForBanner = useCallback(async () => {
    if (!currentUserUUID) return;

    const { data: latestUnread } = await supabase
      .from("messages")
      .select("*")
      .eq("receiver_id", currentUserUUID)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestUnread) return;
    if (activeChatPartnerId && latestUnread.sender_id === activeChatPartnerId) {
      await markConversationAsRead(activeChatPartnerId);
      return;
    }
    await buildAndShowBanner(latestUnread);
  }, [
    activeChatPartnerId,
    buildAndShowBanner,
    currentUserUUID,
    markConversationAsRead,
  ]);

  const markConversationAsRead = useCallback(
    async (partnerId: string) => {
      if (!currentUserUUID || !partnerId) return;

      const { error } = await supabase.rpc("mark_messages_as_read", {
        sender_user_id: partnerId,
        receiver_user_id: currentUserUUID,
      });

      if (!error) {
        await refreshUnreadCount();
      }
    },
    [currentUserUUID, refreshUnreadCount],
  );

  useEffect(() => {
    let isMounted = true;

    const loadUserUUID = async () => {
      if (!currentUser) {
        setCurrentUserUUID(null);
        setUnreadCount(0);
        return;
      }

      const uuid = await getCurrentUserUUID();
      if (isMounted) {
        setCurrentUserUUID(uuid);
      }
    };

    loadUserUUID();
    return () => {
      isMounted = false;
    };
  }, [currentUser, getCurrentUserUUID]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!currentUserUUID) return;

    const channel = supabase
      .channel(`unread-messages-${currentUserUUID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id.eq.${currentUserUUID}`,
        },
        async (payload) => {
          const message = payload.new as any;

          if (payload.eventType === "INSERT" && message && !message.is_read) {
            if (activeChatPartnerId && message.sender_id === activeChatPartnerId) {
              await markConversationAsRead(activeChatPartnerId);
              return;
            }

            setUnreadCount((prev) => prev + 1);

            await buildAndShowBanner(message);
            return;
          }

          await refreshUnreadCount();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (unreadFallbackPollRef.current) {
            clearInterval(unreadFallbackPollRef.current);
            unreadFallbackPollRef.current = null;
          }
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!unreadFallbackPollRef.current) {
            unreadFallbackPollRef.current = setInterval(() => {
              refreshUnreadCount();
              pollLatestUnreadForBanner();
            }, 3000);
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
      if (unreadFallbackPollRef.current) {
        clearInterval(unreadFallbackPollRef.current);
        unreadFallbackPollRef.current = null;
      }
    };
  }, [
    activeChatPartnerId,
    buildAndShowBanner,
    currentUserUUID,
    markConversationAsRead,
    pollLatestUnreadForBanner,
    refreshUnreadCount,
  ]);

  const value = useMemo(
    () => ({
      unreadCount,
      banner,
      activeChatPartnerId,
      currentUserUUID,
      dismissBanner,
      setActiveChatPartnerId,
      refreshUnreadCount,
      markConversationAsRead,
    }),
    [
      unreadCount,
      banner,
      activeChatPartnerId,
      currentUserUUID,
      dismissBanner,
      refreshUnreadCount,
      markConversationAsRead,
    ],
  );

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};

export const useUnreadMessages = () => {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) {
    throw new Error(
      "useUnreadMessages must be used within an UnreadMessagesProvider",
    );
  }
  return ctx;
};
