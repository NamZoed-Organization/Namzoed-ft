import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

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
  setIsOnMessagesScreen: (val: boolean) => void;
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
  const [activeChatPartnerId, setActiveChatPartnerIdState] = useState<string | null>(null);
  // Ref mirror so the real-time handler always reads the latest value
  // without needing to be recreated every time it changes
  const activeChatPartnerIdRef = useRef<string | null>(null);

  const setActiveChatPartnerId = useCallback((partnerId: string | null) => {
    activeChatPartnerIdRef.current = partnerId;
    setActiveChatPartnerIdState(partnerId);
  }, []);
  const isOnMessagesScreenRef = useRef(false);
  const setIsOnMessagesScreen = useCallback((val: boolean) => {
    isOnMessagesScreenRef.current = val;
  }, []);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unreadFallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const latestBannerMessageIdRef = useRef<string | null>(null);
  const senderMetaCacheRef = useRef<
    Record<string, { senderName: string; senderAvatarUrl: string | null }>
  >({});
  // Muted + hidden conversations loaded from AsyncStorage so banners can be
  // suppressed for muted users and hidden (deleted) conversations.
  const mutedIdsRef = useRef<Set<string>>(new Set());
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const candidateUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUserUUID) ids.add(String(currentUserUUID));
    if ((currentUser as any)?.id) ids.add(String((currentUser as any).id));
    return Array.from(ids);
  }, [currentUserUUID, currentUser]);

  // ── Load muted / hidden sets from AsyncStorage ──────────────────────
  useEffect(() => {
    const uid = currentUserUUID || (currentUser as any)?.id;
    if (!uid) return;
    AsyncStorage.getItem(`muted_conversations_${uid}`).then((val) => {
      mutedIdsRef.current = val ? new Set(JSON.parse(val) as string[]) : new Set();
    });
    AsyncStorage.getItem(`hidden_conversations_${uid}`).then((val) => {
      hiddenIdsRef.current = val ? new Set(JSON.parse(val) as string[]) : new Set();
    });
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
      console.log("[UnreadCtx] getCurrentUserUUID — no currentUser or authUser");
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

    const fallbackId = authUser?.id ?? null;
    console.log("[UnreadCtx] getCurrentUserUUID resolved:", fallbackId?.substring(0, 8) ?? "null");
    return fallbackId;
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
      console.log("[UnreadCtx] refreshUnreadCount skipped — no candidateUserIds");
      setUnreadCount(0);
      return;
    }

    const myId = currentUserUUID || candidateUserIds[0];

    const { data, error } = await supabase
      .from("messages")
      .select("sender_id")
      .in("receiver_id", candidateUserIds)
      .eq("is_read", false);

    if (error) {
      console.warn("[UnreadCtx] refreshUnreadCount error:", error.message);
      setUnreadCount(0);
      return;
    }

    if (!data || data.length === 0) {
      setUnreadCount(0);
      return;
    }

    const allSenderIds = [
      ...new Set(data.map((r: any) => String(r.sender_id)).filter(Boolean)),
    ];

    if (allSenderIds.length === 0) {
      setUnreadCount(0);
      return;
    }

    // ── Match the conversations screen's main-inbox gating ──
    // Fetch follow relationships, message requests, and mongoose profiles
    // in parallel so the badge count aligns with what the user actually sees.
    const [followingRes, followersRes, requestsRes, mongooseRes] =
      await Promise.all([
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", myId)
          .in("following_id", allSenderIds),
        supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", myId)
          .in("follower_id", allSenderIds),
        supabase
          .from("message_requests")
          .select("sender_id, status, context")
          .eq("receiver_id", myId)
          .in("sender_id", allSenderIds),
        supabase
          .from("profiles")
          .select("id, email")
          .in("id", allSenderIds)
          .like("email", "mongoose@gmail.com%"),
      ]);

    const iFollow = new Set(
      (followingRes.data ?? []).map((r: any) => String(r.following_id)),
    );
    const followsMe = new Set(
      (followersRes.data ?? []).map((r: any) => String(r.follower_id)),
    );
    const requestMap = new Map<string, { status: string; context: string }>(
      (requestsRes.data ?? []).map((r: any) => [
        String(r.sender_id),
        { status: String(r.status), context: String(r.context ?? "personal") },
      ]),
    );
    const mongooseSet = new Set(
      (mongooseRes.data ?? []).map((r: any) => String(r.id)),
    );

    let count = 0;
    for (const senderId of allSenderIds) {
      const isMutual = iFollow.has(senderId) && followsMe.has(senderId);
      const req = requestMap.get(senderId);

      if (
        isMutual ||
        req?.status === "accepted" ||
        (req?.status === "pending" && req?.context === "commerce") ||
        mongooseSet.has(senderId)
      ) {
        count++;
      }
      // All other senders (pending personal requests, no relationship) live
      // in the request tray on the conversations screen, so they don't count.
    }

    console.log("[UnreadCtx] unread from", count, "main-inbox sender(s)");
    setUnreadCount(count);
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

  // Stable ref kept up-to-date so pollLatestUnreadForBanner can call it without
  // adding it to its own deps (which would create ordering issues).
  const markConversationAsReadRef = useRef(markConversationAsRead);
  useEffect(() => { markConversationAsReadRef.current = markConversationAsRead; }, [markConversationAsRead]);

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
    const currentPartner = activeChatPartnerIdRef.current;
    if (currentPartner && latestUnread.sender_id === currentPartner) {
      await markConversationAsReadRef.current(currentPartner);
      return;
    }

    // Gate banner: only show for main-inbox senders (mutual follow,
    // accepted request, commerce request, or mongoose partner)
    const myId = currentUserUUID || candidateUserIds[0];
    if (myId && latestUnread.sender_id) {
      const senderId = String(latestUnread.sender_id);

      const [fwdRes, revRes] = await Promise.all([
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", myId)
          .eq("following_id", senderId)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", myId)
          .eq("follower_id", senderId)
          .maybeSingle(),
      ]);
      const isMutual = !!(fwdRes.data && revRes.data);

      if (!isMutual) {
        const { data: reqRow } = await supabase
          .from("message_requests")
          .select("status, context")
          .eq("sender_id", senderId)
          .eq("receiver_id", myId)
          .maybeSingle();

        const isAccepted = reqRow?.status === "accepted";
        const isCommerce =
          reqRow?.status === "pending" &&
          String(reqRow?.context ?? "") === "commerce";

        const { data: profRow } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", senderId)
          .maybeSingle();
        const isMongoose = String(profRow?.email ?? "").startsWith(
          "mongoose@gmail.com",
        );

        if (!isAccepted && !isCommerce && !isMongoose) return;
      }
    }

    // Suppress banner if user is on the conversations screen,
    // if the sender is muted, or if the conversation was deleted.
    if (latestUnread.sender_id) {
      const sid = String(latestUnread.sender_id);
      if (isOnMessagesScreenRef.current) return;
      if (mutedIdsRef.current.has(sid)) return;
      if (hiddenIdsRef.current.has(sid)) return;
    }

    await buildAndShowBanner(latestUnread);
  }, [
    buildAndShowBanner,
    candidateUserIds,
    currentUserUUID,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadUserUUID = async () => {
      const uuid = await getCurrentUserUUID();
      console.log("[UnreadCtx] loadUserUUID resolved:", uuid?.substring(0, 8) ?? "null");
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

  // Stable ref wrappers so the channel is never recreated when these callbacks change
  const refreshUnreadCountRef = useRef(refreshUnreadCount);
  const buildAndShowBannerRef = useRef(buildAndShowBanner);
  const pollLatestUnreadForBannerRef = useRef(pollLatestUnreadForBanner);
  useEffect(() => { refreshUnreadCountRef.current = refreshUnreadCount; }, [refreshUnreadCount]);
  useEffect(() => { buildAndShowBannerRef.current = buildAndShowBanner; }, [buildAndShowBanner]);
  useEffect(() => { pollLatestUnreadForBannerRef.current = pollLatestUnreadForBanner; }, [pollLatestUnreadForBanner]);

  useEffect(() => {
    if (!candidateUserIds.length) return;

    let isSubscribed = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let periodicRefresh: ReturnType<typeof setInterval> | null = null;

    const setup = async () => {
      // Confirm UUID is available before subscribing
      const { data: authData } = await supabase.auth.getUser();
      const subscriberUUID = authData?.user?.id || candidateUserIds[0];
      if (!subscriberUUID || !isSubscribed) return;

      console.log("[UnreadCtx] subscribing as", subscriberUUID.substring(0, 8), "candidates:", candidateUserIds.map(id => id.substring(0, 8)));

      // NOTE: We do NOT use a DB-level `filter:` on receiver_id because
      // Supabase Realtime requires the table's replica identity to be set
      // to FULL for non-primary-key column filters to work.  Without that
      // the subscription succeeds but silently delivers zero events.
      // Instead we listen to ALL changes on the messages table and filter
      // in the JS callback (same approach as the per-chat channel).
      channel = supabase
        .channel(`unread-${subscriberUUID}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            if (!isSubscribed) return;
            const message = payload.new as any;

            // Only care about messages addressed to us
            const isForMe =
              message &&
              candidateUserIds.includes(String(message.receiver_id));
            if (!isForMe && payload.eventType !== "DELETE") {
              return;
            }

            if (payload.eventType === "INSERT" && message && !message.is_read) {
              console.log("[UnreadCtx] INSERT for me from", String(message.sender_id).substring(0, 8));

              const currentPartner = activeChatPartnerIdRef.current;
              if (currentPartner && message.sender_id === currentPartner) {
                await markConversationAsReadRef.current(currentPartner);
                return;
              }

              // Always refresh the badge count (it applies the full
              // main-inbox gating: mutual follow, accepted request,
              // commerce, mongoose).  The banner is also gated below.
              await refreshUnreadCountRef.current();

              // Gate the in-app banner: only show for main-inbox senders
              try {
                const senderId = String(message.sender_id);

                // Check mutual follow
                const [fwdRes, revRes] = await Promise.all([
                  supabase
                    .from("follows")
                    .select("following_id")
                    .eq("follower_id", subscriberUUID)
                    .eq("following_id", senderId)
                    .maybeSingle(),
                  supabase
                    .from("follows")
                    .select("follower_id")
                    .eq("following_id", subscriberUUID)
                    .eq("follower_id", senderId)
                    .maybeSingle(),
                ]);
                const isMutual = !!(fwdRes.data && revRes.data);

                if (!isMutual) {
                  // Check message_request status
                  const { data: reqRow } = await supabase
                    .from("message_requests")
                    .select("status, context")
                    .eq("sender_id", senderId)
                    .eq("receiver_id", subscriberUUID)
                    .maybeSingle();

                  const isAccepted = reqRow?.status === "accepted";
                  const isCommerce =
                    reqRow?.status === "pending" &&
                    String(reqRow?.context ?? "") === "commerce";

                  // Check mongoose service partner
                  const { data: profRow } = await supabase
                    .from("profiles")
                    .select("email")
                    .eq("id", senderId)
                    .maybeSingle();
                  const isMongoose = String(
                    profRow?.email ?? "",
                  ).startsWith("mongoose@gmail.com");

                  if (!isAccepted && !isCommerce && !isMongoose) {
                    // Sender is in the request tray — suppress banner
                    return;
                  }
                }
              } catch {
                // If gating check fails, still show the banner
              }

              // Suppress banner if user is on the conversations screen,
              // if the sender is muted, or if the conversation was deleted.
              const sid = String(message.sender_id);
              if (isOnMessagesScreenRef.current) return;
              if (mutedIdsRef.current.has(sid)) return;
              if (hiddenIdsRef.current.has(sid)) return;

              await buildAndShowBannerRef.current(message);
              return;
            }

            // UPDATE / DELETE — just refresh the count
            await refreshUnreadCountRef.current();
          },
        )
        .subscribe((status) => {
          console.log("[UnreadCtx] channel status:", status);
          if (!isSubscribed) return;
          if (status === "SUBSCRIBED") {
            // Do an immediate refresh now that we know we're connected
            refreshUnreadCountRef.current();
            if (unreadFallbackPollRef.current) {
              clearInterval(unreadFallbackPollRef.current);
              unreadFallbackPollRef.current = null;
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[UnreadCtx] channel error/timeout — falling back to polling");
            if (!unreadFallbackPollRef.current) {
              unreadFallbackPollRef.current = setInterval(() => {
                if (!isSubscribed) return;
                refreshUnreadCountRef.current();
                pollLatestUnreadForBannerRef.current();
              }, 3000);
            }
          }
        });

      // Periodic heartbeat
      periodicRefresh = setInterval(() => {
        if (isSubscribed) refreshUnreadCountRef.current();
      }, 15000);
    };

    setup();

    return () => {
      isSubscribed = false;
      if (channel) supabase.removeChannel(channel);
      if (periodicRefresh) clearInterval(periodicRefresh);
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
      if (unreadFallbackPollRef.current) {
        clearInterval(unreadFallbackPollRef.current);
        unreadFallbackPollRef.current = null;
      }
    };
  // Only recreate the channel when the user identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateUserIds]);

  // Refresh badge when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshUnreadCount();
    });
    return () => sub.remove();
  }, [refreshUnreadCount]);

  // Refresh badge when leaving a chat (partner id goes null)
  useEffect(() => {
    if (activeChatPartnerId === null) refreshUnreadCount();
  }, [activeChatPartnerId, refreshUnreadCount]);

  const value = useMemo(
    () => ({
      unreadCount,
      banner,
      activeChatPartnerId,
      currentUserUUID,
      dismissBanner,
      setActiveChatPartnerId,
      setIsOnMessagesScreen,
      refreshUnreadCount,
      markConversationAsRead,
    }),
    [
      unreadCount,
      banner,
      activeChatPartnerId,
      currentUserUUID,
      dismissBanner,
      setActiveChatPartnerId,
      setIsOnMessagesScreen,
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
