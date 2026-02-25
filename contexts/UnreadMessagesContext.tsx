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
  senderAvatarUrl?: string | null;
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
  const senderMetaCacheRef = useRef<
    Record<string, { senderName: string; senderAvatarUrl: string | null }>
  >({});
  const candidateUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUserUUID) ids.add(String(currentUserUUID));
    if ((currentUser as any)?.id) ids.add(String((currentUser as any).id));
    return Array.from(ids);
  }, [currentUserUUID, currentUser]);

  const dismissBanner = useCallback(() => {
    setBanner(null);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  }, []);

  const getCurrentUserUUID = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!currentUser && !authUser) {
      return null;
    }

    const userPhone =
      currentUser?.phone_number ||
      (currentUser as any)?.phone ||
      (currentUser as any)?.phoneNumber ||
      (currentUser as any)?.mobile;
    const userEmail = currentUser?.email || authUser?.email;

    if (currentUser?.id) {
      const { data: byId } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (byId?.id) return byId.id;
    }

    if (userPhone) {
      const cleanPhone = String(userPhone).replace("+975", "");
      const { data: byPhone } = await supabase
        .from("profiles")
        .select("id")
        .or(`phone.eq.${userPhone},phone.eq.${cleanPhone}`)
        .maybeSingle();
      if (byPhone?.id) return byPhone.id;
    }

    if (userEmail) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();
      if (byEmail?.id) return byEmail.id;
    }

    return authUser?.id ?? null;
  }, [currentUser]);

  const resolveSenderMeta = useCallback(async (message: any) => {
    const senderId = String(message?.sender_id || "");
    if (!senderId) {
      return { senderName: "User", senderAvatarUrl: null as string | null };
    }

    const cached = senderMetaCacheRef.current[senderId];
    if (cached) return cached;

    let profile: any = null;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", senderId)
      .maybeSingle();
    profile = profileById || null;

    if (!profile) {
      const cleanSender = senderId.replace("+975", "").replace(/\D/g, "");
      if (cleanSender || senderId) {
        const { data: profileByPhone } = await supabase
          .from("profiles")
          .select("*")
          .or(`phone.eq.${senderId},phone.eq.${cleanSender}`)
          .maybeSingle();
        profile = profileByPhone || null;
      }
    }

    const cleanSender = senderId.replace("+975", "").replace(/\D/g, "");
    const senderName =
      profile?.name ||
      profile?.username ||
      profile?.full_name ||
      profile?.display_name ||
      (profile?.phone
        ? `+975${profile.phone}`
        : /^\d{8}$/.test(cleanSender)
          ? `+975${cleanSender}`
          : senderId.slice(0, 8));

    const senderAvatarUrl =
      profile?.avatar_url ||
      profile?.profile_img ||
      profile?.profileImg ||
      message?.sender_avatar_url ||
      null;

    const resolved = { senderName, senderAvatarUrl };
    senderMetaCacheRef.current[senderId] = resolved;
    return resolved;
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!candidateUserIds.length) {
      setUnreadCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select("sender_id")
      .in("receiver_id", candidateUserIds)
      .eq("is_read", false);

    if (error || !data) {
      setUnreadCount(0);
      return;
    }

    const allSenderIds = [
      ...new Set(data.map((r: any) => String(r.sender_id)).filter(Boolean)),
    ];

    // Exclude senders who have a pending (un-accepted) message request to me
    let pendingSet = new Set<string>();
    const myId = currentUserUUID || candidateUserIds[0];
    if (myId && allSenderIds.length > 0) {
      const { data: pending } = await supabase
        .from("message_requests")
        .select("sender_id")
        .eq("receiver_id", myId)
        .eq("status", "pending")
        .in("sender_id", allSenderIds);
      pendingSet = new Set((pending ?? []).map((r: any) => String(r.sender_id)));
    }

    const uniqueSenders = new Set(allSenderIds.filter((id) => !pendingSet.has(id)));
    setUnreadCount(uniqueSenders.size);
  }, [candidateUserIds, currentUserUUID]);

  const buildAndShowBanner = useCallback(async (message: any) => {
    if (!message?.id) return;

    const messageId = String(message.id);
    if (latestBannerMessageIdRef.current === messageId) return;
    latestBannerMessageIdRef.current = messageId;

    const { senderName, senderAvatarUrl } = await resolveSenderMeta(message);

    setBanner({
      messageId,
      senderId: String(message.sender_id),
      senderName,
      senderAvatarUrl,
      content:
        message.content?.trim() ||
        (message.message_type === "image"
          ? "Sent a photo"
          : message.message_type === "audio"
            ? "Sent a voice message"
            : "Sent a message"),
    });

    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setBanner(null);
      bannerTimerRef.current = null;
    }, 5000);
  }, [resolveSenderMeta]);

  const pollLatestUnreadForBanner = useCallback(async () => {
    if (!candidateUserIds.length) return;

    const { data: latestUnread } = await supabase
      .from("messages")
      .select("*")
      .in("receiver_id", candidateUserIds)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestUnread) return;
    if (activeChatPartnerId && latestUnread.sender_id === activeChatPartnerId) {
      await markConversationAsRead(activeChatPartnerId);
      return;
    }

    // Suppress banner for pending request senders
    const myId = currentUserUUID || candidateUserIds[0];
    if (myId && latestUnread.sender_id) {
      const { data: reqRow } = await supabase
        .from("message_requests")
        .select("status")
        .eq("sender_id", latestUnread.sender_id)
        .eq("receiver_id", myId)
        .maybeSingle();
      if (reqRow?.status === "pending") return;
    }

    await buildAndShowBanner(latestUnread);
  }, [
    activeChatPartnerId,
    buildAndShowBanner,
    candidateUserIds,
    currentUserUUID,
    markConversationAsRead,
  ]);

  const markConversationAsRead = useCallback(
    async (partnerId: string) => {
      const receiverId = currentUserUUID || candidateUserIds[0];
      if (!receiverId || !partnerId) return;

      const { error } = await supabase.rpc("mark_messages_as_read", {
        sender_user_id: partnerId,
        receiver_user_id: receiverId,
      });

      if (!error) {
        await refreshUnreadCount();
      }
    },
    [candidateUserIds, currentUserUUID, refreshUnreadCount],
  );

  useEffect(() => {
    let isMounted = true;

    const loadUserUUID = async () => {
      const uuid = await getCurrentUserUUID();
      if (isMounted) {
        setCurrentUserUUID(uuid);
        if (!uuid) {
          setUnreadCount(0);
        }
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
    if (!candidateUserIds.length) return;

    const channel = supabase
      .channel(`unread-messages-${candidateUserIds.join("_")}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const message = payload.new as any;
          const oldMessage = payload.old as any;
          const receiverId = String(
            message?.receiver_id || oldMessage?.receiver_id || "",
          );
          if (!candidateUserIds.includes(receiverId)) return;

          if (payload.eventType === "INSERT" && message && !message.is_read) {
            if (activeChatPartnerId && message.sender_id === activeChatPartnerId) {
              await markConversationAsRead(activeChatPartnerId);
              return;
            }

            // Suppress banner + count for messages sitting in the requests tray
            const myId = currentUserUUID || candidateUserIds[0];
            if (myId && message.sender_id) {
              const { data: reqRow } = await supabase
                .from("message_requests")
                .select("status")
                .eq("sender_id", message.sender_id)
                .eq("receiver_id", myId)
                .maybeSingle();
              if (reqRow?.status === "pending") {
                // Don't notify — user will see it only after accepting the request
                return;
              }
            }

            await refreshUnreadCount();
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
    candidateUserIds,
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
