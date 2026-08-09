import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
    Check,
    ChevronRight,
    Copy,
    Facebook,
    Instagram,
    Link2,
    MessageCircle,
    Search,
    Send,
    Share2,
    UserRound,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Linking,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

let ClipboardModule: { setStringAsync: (text: string) => Promise<void> } | null = null;
try {
  // Optional native module: may be unavailable until a fresh dev build is installed.
  // Use lazy require to avoid hard crash on import.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClipboardModule = require("expo-clipboard");
} catch {
  ClipboardModule = null;
}

type SharePayload = {
  title?: string;
  message: string;
  url?: string;
};

type FollowedUser = {
  id: string;
  name: string;
  avatar_url?: string | null;
};

interface ShareComposerModalProps {
  visible: boolean;
  onClose: () => void;
  sharePayload: SharePayload;
  inAppContextParams?: Record<string, string>;
  heading?: string;
}

const optionStyle = {
  width: 72,
  alignItems: "center" as const,
  marginRight: 14,
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const FOLLOW_COLUMNS = 4;
const FOLLOW_ITEM_GAP = 8;
const FOLLOW_ITEM_WIDTH = (SCREEN_WIDTH - 40 - FOLLOW_ITEM_GAP * (FOLLOW_COLUMNS - 1)) / FOLLOW_COLUMNS;
const FOLLOW_ROW_HEIGHT = 82;
const FOLLOW_MIN_ROWS = 3;
const PRODUCT_META_PREFIX = "[product-meta]";
const PRODUCT_META_SUFFIX = "[/product-meta]";

export default function ShareComposerModal({
  visible,
  onClose,
  sharePayload,
  inAppContextParams,
  heading = "Share",
}: ShareComposerModalProps) {
  const router = useAppRouter();
  const { currentUser } = useUser();

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");
  const [sendingInApp, setSendingInApp] = useState(false);
  const [launchingExternal, setLaunchingExternal] = useState(false);
  const [hasScrolledExternal, setHasScrolledExternal] = useState(false);
  const sheetTranslateY = useState(() => new Animated.Value(440))[0];
  const backdropOpacity = useState(() => new Animated.Value(0))[0];
  const [isClosing, setIsClosing] = useState(false);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    text: string;
    kind: "success" | "error" | "info";
  }>({ visible: false, text: "", kind: "info" });
  const feedbackOpacity = useState(() => new Animated.Value(0))[0];
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSentToast, setShowSentToast] = useState(false);
  const sentToastOpacity = useState(() => new Animated.Value(0))[0];
  const sentToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const composedText = useMemo(
    () => [sharePayload.message, sharePayload.url].filter(Boolean).join("\n"),
    [sharePayload.message, sharePayload.url],
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return followedUsers;
    const q = search.trim().toLowerCase();
    return followedUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [followedUsers, search]);

  useEffect(() => {
    if (!visible || !currentUser?.id) return;

    let active = true;
    const loadFollowing = async () => {
      setLoadingUsers(true);
      try {
        const { data: follows, error: followError } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id);

        if (followError) throw followError;

        const ids = (follows ?? []).map((f: any) => String(f.following_id));
        if (!ids.length) {
          if (active) setFollowedUsers([]);
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id,name,email,avatar_url")
          .in("id", ids)
          .limit(50);

        if (profileError) throw profileError;

        const mapped: FollowedUser[] = (profiles ?? []).map((p: any) => ({
          id: String(p.id),
          name: p.name || p.email?.split("@")[0] || "User",
          avatar_url: p.avatar_url,
        }));

        if (active) {
          setFollowedUsers(mapped.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error("Share modal follow list error:", err);
        if (active) setFollowedUsers([]);
      } finally {
        if (active) setLoadingUsers(false);
      }
    };

    void loadFollowing();
    return () => {
      active = false;
    };
  }, [visible, currentUser?.id]);

  useEffect(() => {
    if (!visible) return;

    setIsClosing(false);
    sheetTranslateY.setValue(440);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, backdropOpacity, sheetTranslateY]);

  const closeWithDrawerAnimation = () => {
    if (isClosing) return;
    setIsClosing(true);
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 460,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsClosing(false);
      onClose();
    });
  };

  const closeImmediately = () => {
    setIsClosing(false);
    onClose();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            sheetTranslateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.9) {
            closeWithDrawerAnimation();
            return;
          }
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }).start();
        },
      }),
    [sheetTranslateY, isClosing],
  );

  useEffect(() => {
    if (!visible) {
      setSelectedUserIds([]);
      setNoteText("");
      setSearch("");
      setSendingInApp(false);
      setLaunchingExternal(false);
      setHasScrolledExternal(false);
      setShowSentToast(false);
      sentToastOpacity.setValue(0);
      setFeedback({ visible: false, text: "", kind: "info" });
      feedbackOpacity.setValue(0);
    }
  }, [visible, feedbackOpacity, sentToastOpacity]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      if (sentToastTimerRef.current) {
        clearTimeout(sentToastTimerRef.current);
      }
    };
  }, []);

  const showSentSuccessToast = () => {
    if (sentToastTimerRef.current) {
      clearTimeout(sentToastTimerRef.current);
      sentToastTimerRef.current = null;
    }

    setShowSentToast(true);
    sentToastOpacity.setValue(0);
    Animated.timing(sentToastOpacity, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();

    sentToastTimerRef.current = setTimeout(() => {
      Animated.timing(sentToastOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setShowSentToast(false);
        closeWithDrawerAnimation();
      });
    }, 1300);
  };

  const showFeedback = (
    text: string,
    kind: "success" | "error" | "info" = "info",
  ) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    setFeedback({ visible: true, text, kind });
    feedbackOpacity.setValue(0);
    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();

    feedbackTimerRef.current = setTimeout(() => {
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setFeedback((prev) => ({ ...prev, visible: false }));
      });
    }, 1700);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const buildInAppShareContent = () => {
    const note = noteText.trim();
    const id = inAppContextParams?.context_product_id;
    const title = inAppContextParams?.context_product_title;

    if (!id || !title) {
      return note || sharePayload.url || sharePayload.message || "";
    }

    const productMeta = {
      id,
      title,
      price: inAppContextParams?.context_product_price || undefined,
      imageUrl: inAppContextParams?.context_product_image || undefined,
      source:
        inAppContextParams?.context_source === "marketplace" ||
        inAppContextParams?.context_source === "post" ||
        inAppContextParams?.context_source === "profile"
          ? inAppContextParams.context_source
          : "product",
      caption: inAppContextParams?.context_caption || undefined,
      date: inAppContextParams?.context_date || undefined,
      location: inAppContextParams?.context_location || undefined,
      username: inAppContextParams?.context_username || undefined,
      isVerified: inAppContextParams?.context_verified === "true",
    };

    const metaBlock = `${PRODUCT_META_PREFIX}${encodeURIComponent(
      JSON.stringify(productMeta),
    )}${PRODUCT_META_SUFFIX}`;

    return note ? `${metaBlock}\n${note}` : metaBlock;
  };

  const sendInAppNow = async () => {
    if (!currentUser?.id) {
      showFeedback("Please sign in to send in-app.", "error");
      return;
    }
    if (!selectedUserIds.length) {
      showFeedback("Select at least one recipient.", "error");
      return;
    }

    try {
      setSendingInApp(true);
      const content = buildInAppShareContent();
      const rows = selectedUserIds.map((receiverId) => ({
        sender_id: String(currentUser.id),
        receiver_id: String(receiverId),
        content,
        is_read: false,
      }));

      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;

      showSentSuccessToast();
    } catch (err) {
      console.error("In-app share send error:", err);
      showFeedback("Send failed. Please try again.", "error");
    } finally {
      setSendingInApp(false);
    }
  };

  const shareDefault = async () => {
    try {
      await Share.share(sharePayload);
    } catch (err) {
      console.error("Default share error:", err);
    }
  };

  const shareViaSheetForApp = async (appName: string) => {
    try {
      const payload = encodeURIComponent(JSON.stringify(sharePayload));
      closeImmediately();
      setTimeout(() => {
        router.push(
          {
            pathname: "/(users)/share-bridge",
            params: { payload, app: appName },
          } as any,
        );
      }, 70);
    } catch (err) {
      console.error(`Share sheet error (${appName}):`, err);
      showFeedback(`Could not share to ${appName}.`, "error");
    }
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  const safeOpenURL = async (url: string) => {
    try {
      return await Promise.race<boolean>([
        Linking.openURL(url).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1800)),
      ]);
    } catch {
      return false;
    }
  };

  const safeCanOpenURL = async (url: string) => {
    try {
      return await Promise.race<boolean>([
        Linking.canOpenURL(url),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1200)),
      ]);
    } catch {
      return false;
    }
  };

  const launchExternal = async ({
    appUrl,
    appUrls,
    appName,
    webFallbackUrl,
    copyLinkFirst,
    copyText,
  }: {
    appUrl: string;
    appUrls?: string[];
    appName: string;
    webFallbackUrl?: string;
    copyLinkFirst?: boolean;
    copyText?: string;
  }): Promise<boolean> => {
    if (launchingExternal) return false;

    try {
      setLaunchingExternal(true);

      const textToCopy = copyText ?? sharePayload.url;
      if (copyLinkFirst && textToCopy && ClipboardModule?.setStringAsync) {
        try {
          await ClipboardModule.setStringAsync(textToCopy);
        } catch {
          // Best effort only.
        }
      }

      const candidateUrls = (appUrls && appUrls.length ? appUrls : [appUrl]).filter(Boolean);

      const tryOpenCandidates = async () => {
        for (const candidate of candidateUrls) {
          // 1) Try direct open first. This is more reliable in Expo Go/dev clients
          // where canOpenURL may return false for third-party schemes.
          const openedDirect = await safeOpenURL(candidate);
          if (openedDirect) return true;

          // 2) iOS fallback: explicit canOpenURL check, then open again.
          if (Platform.OS === "ios") {
            const canOpen = await safeCanOpenURL(candidate);
            if (!canOpen) continue;
            const openedChecked = await safeOpenURL(candidate);
            if (openedChecked) return true;
          }
        }

        return false;
      };

      const openedApp = await tryOpenCandidates();
      if (openedApp) {
        closeWithDrawerAnimation();
        return true;
      }

      if (webFallbackUrl) {
        const openedWeb = await safeOpenURL(webFallbackUrl);
        if (openedWeb) {
          closeWithDrawerAnimation();
          return true;
        }
        showFeedback(`Could not open ${appName}.`, "error");
        return false;
      }

      showFeedback(`${appName} is not available.`, "error");
      return false;
    } catch (err) {
      console.error(`External share error (${appName}):`, err);
      showFeedback(`Could not open ${appName}.`, "error");
      return false;
    } finally {
      setTimeout(() => setLaunchingExternal(false), 350);
    }
  };

  const handleCopyLink = async () => {
    if (!sharePayload.url) {
      showFeedback("No shareable link yet.", "error");
      return;
    }
    if (!ClipboardModule?.setStringAsync) {
      showFeedback("Clipboard unavailable on this build.", "error");
      return;
    }
    await ClipboardModule.setStringAsync(sharePayload.url);
    showFeedback("Link copied.", "success");
  };

  const openWhatsApp = async () => {
    const waText = sharePayload.url || composedText;
    await launchExternal({
      appUrl: `whatsapp://send?text=${encodeURIComponent(waText)}`,
      appUrls: [
        `whatsapp://send?text=${encodeURIComponent(waText)}`,
        "whatsapp://app",
        "whatsapp://",
      ],
      appName: "WhatsApp",
    });
  };

  const openTelegram = async () => {
    const url = sharePayload.url || "";
    const text = sharePayload.message || "";
    await launchExternal({
      appUrl: `tg://msg_url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      appUrls: [
        `tg://msg_url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        "tg://resolve?domain=telegram",
        "tg://",
      ],
      appName: "Telegram",
    });
  };

  const openFacebook = async () => {
    await shareViaSheetForApp("Facebook");
  };

  const openInstagram = async () => {
    await shareViaSheetForApp("Instagram");
  };

  const openMessenger = async () => {
    await shareViaSheetForApp("Messenger");
  };

  const openInstagramStories = async () => {
    await shareViaSheetForApp("Instagram Stories");
  };

  const openTikTokStories = async () => {
    await shareViaSheetForApp("TikTok");
  };

  const openMessages = async () => {
    const body = encodeURIComponent(composedText);
    const smsUrl = Platform.select({
      ios: `sms:&body=${body}`,
      android: `sms:?body=${body}`,
      default: `sms:?body=${body}`,
    });
    await launchExternal({
      appUrl: smsUrl,
      appName: "Messages",
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithDrawerAnimation}>
      <View className="flex-1 justify-end">
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.45)",
            opacity: backdropOpacity,
          }}
        />

        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={closeWithDrawerAnimation} />

        {feedback.visible && (
          <Animated.View
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              bottom: 500,
              opacity: feedbackOpacity,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor:
                  feedback.kind === "success"
                    ? "#064E3B"
                    : feedback.kind === "error"
                      ? "#7F1D1D"
                      : "#1F2937",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                {feedback.text}
              </Text>
            </View>
          </Animated.View>
        )}

        {showSentToast && (
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "flex-end",
              opacity: sentToastOpacity,
              zIndex: 40,
              elevation: 40,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                backgroundColor: "rgba(17,24,39,0.92)",
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 210,
              }}
            >
              <Check size={16} color="#34D399" />
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginLeft: 8 }}>
                Sent
              </Text>
            </View>
          </Animated.View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 14 : 0}
          style={{ width: "100%" }}
        >
        <Animated.View
          style={{ transform: [{ translateY: sheetTranslateY }] }}
          {...panResponder.panHandlers}
          className="bg-white rounded-t-3xl px-5 pt-3 pb-8"
        >
          <View className="w-12 h-1.5 rounded-full bg-gray-300 self-center mb-4" />

          <Text className="text-lg font-bold text-gray-900 mb-3">{heading}</Text>

          <View className="flex-row items-center bg-gray-100 rounded-2xl px-3 py-2 mb-4">
            <Search size={16} color="#6B7280" />
            <TextInput
              placeholder="Search people you follow"
              value={search}
              onChangeText={setSearch}
              className="flex-1 ml-2 text-gray-900"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <Text className="text-sm font-semibold text-gray-700 mb-3">Send in Namzoed</Text>

          {loadingUsers ? (
            <View className="h-20 items-center justify-center">
              <ActivityIndicator color="#094569" />
            </View>
          ) : (
            <View style={{ minHeight: FOLLOW_ROW_HEIGHT * FOLLOW_MIN_ROWS, maxHeight: FOLLOW_ROW_HEIGHT * FOLLOW_MIN_ROWS, marginBottom: 20 }}>
              {!filteredUsers.length ? (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-sm text-gray-400">No followed users found</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 10, columnGap: FOLLOW_ITEM_GAP }}>
                    {filteredUsers.map((user) => (
                      <View key={user.id} style={{ width: FOLLOW_ITEM_WIDTH, alignItems: "center" }}>
                      <TouchableOpacity
                        onPress={() => toggleUserSelection(user.id)}
                        style={{ width: FOLLOW_ITEM_WIDTH, alignItems: "center" }}
                      >
                        <View style={{ position: "relative" }}>
                        {user.avatar_url ? (
                          <Image
                            source={{ uri: user.avatar_url }}
                            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#E5E7EB" }}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(9,69,105,0.1)", alignItems: "center", justifyContent: "center" }}>
                            <UserRound size={24} color="#094569" />
                          </View>
                        )}
                          {selectedUserIds.includes(user.id) && (
                            <View
                              style={{
                                position: "absolute",
                                right: -2,
                                bottom: -2,
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: "#094569",
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: "#fff",
                              }}
                            >
                              <Check size={12} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-gray-700 mt-1 text-center" numberOfLines={1}>
                          {user.name}
                        </Text>
                      </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          <View className="mb-5">
            <TextInput
              placeholder="Add a message (optional)"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={220}
              className="bg-gray-100 rounded-2xl px-3 py-3 text-gray-900"
              placeholderTextColor="#9CA3AF"
              style={{ minHeight: 44, maxHeight: 88 }}
            />

            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-xs text-gray-500">
                {selectedUserIds.length} selected
              </Text>
              <TouchableOpacity
                onPress={() => void sendInAppNow()}
                disabled={!selectedUserIds.length || sendingInApp}
                className={`px-4 py-2 rounded-full ${
                  !selectedUserIds.length || sendingInApp
                    ? "bg-gray-300"
                    : "bg-primary"
                }`}
              >
                {sendingInApp ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white text-sm font-semibold">Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-sm font-semibold text-gray-700 mb-3">Share externally</Text>

          {launchingExternal && (
            <Text className="text-xs text-gray-500 mb-2">Opening app…</Text>
          )}

          <View pointerEvents={launchingExternal ? "none" : "auto"} style={{ opacity: launchingExternal ? 0.55 : 1 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            onScroll={(e) => {
              if (!hasScrolledExternal && e.nativeEvent.contentOffset.x > 8) {
                setHasScrolledExternal(true);
              }
            }}
            scrollEventThrottle={16}
          >
            <TouchableOpacity style={optionStyle} onPress={() => void openWhatsApp()}>
              <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center">
                <MessageCircle size={20} color="#16A34A" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openTelegram()}>
              <View className="w-12 h-12 rounded-full bg-sky-100 items-center justify-center">
                <Send size={20} color="#0284C7" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">Telegram</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openFacebook()}>
              <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                <Facebook size={20} color="#2563EB" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openMessenger()}>
              <View className="w-12 h-12 rounded-full bg-indigo-100 items-center justify-center">
                <MaterialCommunityIcons name="facebook-messenger" size={20} color="#4338CA" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">Messenger</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openInstagram()}>
              <View className="w-12 h-12 rounded-full bg-pink-100 items-center justify-center">
                <Instagram size={20} color="#DB2777" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">IG Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openMessages()}>
              <View className="w-12 h-12 rounded-full bg-indigo-100 items-center justify-center">
                <MessageCircle size={20} color="#4338CA" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={handleCopyLink}>
              <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
                <Copy size={20} color="#374151" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">Copy link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void shareDefault()}>
              <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
                <Share2 size={20} color="#111827" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">Share to…</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openInstagramStories()}>
              <View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center">
                <Link2 size={20} color="#C2410C" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">IG Stories</Text>
            </TouchableOpacity>

            <TouchableOpacity style={optionStyle} onPress={() => void openTikTokStories()}>
              <View className="w-12 h-12 rounded-full bg-neutral-200 items-center justify-center">
                <Link2 size={20} color="#111827" />
              </View>
              <Text className="text-xs text-gray-700 mt-1">TikTok</Text>
            </TouchableOpacity>
          </ScrollView>

          {!hasScrolledExternal && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 4,
                top: 13,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "rgba(9,69,105,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={13} color="#094569" />
            </View>
          )}
          </View>
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
