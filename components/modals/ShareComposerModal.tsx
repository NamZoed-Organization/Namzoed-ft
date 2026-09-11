import BottomSheetModal from "@/components/modals/BottomSheetModal";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import SheetAction, {
    SHEET_ICON,
    SHEET_TILE_GAP,
} from "@/components/ui/SheetAction";
import { MODAL_RADIUS } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { waitForIosModalDismiss } from "@/utils/modal";
import { Image } from "expo-image";
import {
    Check,
    Link2,
    MessageCircle,
    MessageSquare,
    Search,
    Share2,
    UserRound,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Linking,
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

const PERSON_WIDTH = 64;
const PERSON_GAP = 12;
const PRODUCT_META_PREFIX = "[product-meta]";
const PRODUCT_META_SUFFIX = "[/product-meta]";

/**
 * The app's one share surface — profile, post, reel and product all open it.
 *
 * Two jobs, separated by a hairline: send to people inside Namzoed, or hand
 * the link to another app. Both follow UI_STANDARD.md § Sheets — the shell is
 * BottomSheetModal (handle, backdrop, drag-to-dismiss), the external targets
 * are SheetAction tiles in one icon colour, and results are PopupMessage
 * rather than the two hand-rolled dark toasts this used to carry.
 *
 * The external row is deliberately short. It used to hold ten tiles, but five
 * of them (Facebook, Messenger, Instagram, IG Stories, TikTok) did not deep
 * link at all — they all opened the OS share sheet with a hint, which is what
 * "More" does honestly, and the OS sheet already lists whatever the user has
 * installed.
 */
export default function ShareComposerModal({
  visible,
  onClose,
  sharePayload,
  inAppContextParams,
  heading = "Share",
}: ShareComposerModalProps) {
  const { currentUser } = useUser();

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");
  const [sendingInApp, setSendingInApp] = useState(false);
  const [launchingExternal, setLaunchingExternal] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "error" | "white";
    title?: string;
    message: string;
  }>({ visible: false, type: "success", message: "" });
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BottomSheetModal hands its animated close down through the render prop,
  // but the handlers below are defined before that runs — so they call it
  // through here instead of unmounting the sheet flat.
  const closeRef = useRef<() => void>(onClose);

  const composedText = useMemo(
    () => [sharePayload.message, sharePayload.url].filter(Boolean).join("\n"),
    [sharePayload.message, sharePayload.url],
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return followedUsers;
    const q = search.trim().toLowerCase();
    return followedUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [followedUsers, search]);

  const canSend = selectedUserIds.length > 0 && !sendingInApp;

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
    if (!visible) {
      setSelectedUserIds([]);
      setNoteText("");
      setSearch("");
      setSendingInApp(false);
      setLaunchingExternal(false);
      setPopup({ visible: false, type: "success", message: "" });
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  const showPopup = (
    type: "success" | "error" | "white",
    message: string,
    title?: string,
  ) => {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup({ visible: true, type, title, message });
    popupTimerRef.current = setTimeout(
      () => setPopup((p) => ({ ...p, visible: false })),
      1800,
    );
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
      showPopup("error", "Please sign in to send in Namzoed.", "Not signed in");
      return;
    }
    if (!selectedUserIds.length) return;

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

      showPopup("white", "Your message is on its way.", "Sent");
      setTimeout(() => closeRef.current(), 1300);
    } catch (err) {
      console.error("In-app share send error:", err);
      showPopup("error", "Send failed. Please try again.", "Not sent");
    } finally {
      setSendingInApp(false);
    }
  };

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
    appUrls,
    appName,
  }: {
    appUrls: string[];
    appName: string;
  }): Promise<boolean> => {
    if (launchingExternal) return false;

    try {
      setLaunchingExternal(true);

      for (const candidate of appUrls.filter(Boolean)) {
        // Direct open first — this is more reliable in Expo Go/dev clients,
        // where canOpenURL returns false for third-party schemes.
        if (await safeOpenURL(candidate)) {
          closeRef.current();
          return true;
        }
        if (Platform.OS === "ios") {
          if (!(await safeCanOpenURL(candidate))) continue;
          if (await safeOpenURL(candidate)) {
            closeRef.current();
            return true;
          }
        }
      }

      showPopup("error", `${appName} is not available on this device.`);
      return false;
    } catch (err) {
      console.error(`External share error (${appName}):`, err);
      showPopup("error", `Could not open ${appName}.`);
      return false;
    } finally {
      setTimeout(() => setLaunchingExternal(false), 350);
    }
  };

  const handleCopyLink = async () => {
    if (!sharePayload.url) {
      showPopup("error", "There's no shareable link for this yet.");
      return;
    }
    if (!ClipboardModule?.setStringAsync) {
      showPopup("error", "Clipboard is unavailable on this build.");
      return;
    }
    await ClipboardModule.setStringAsync(sharePayload.url);
    showPopup("success", "Link copied to your clipboard.", "Copied");
  };

  const openWhatsApp = async () => {
    const text = encodeURIComponent(sharePayload.url || composedText);
    await launchExternal({
      appUrls: [`whatsapp://send?text=${text}`, "whatsapp://app", "whatsapp://"],
      appName: "WhatsApp",
    });
  };

  const openMessages = async () => {
    const body = encodeURIComponent(composedText);
    const smsUrl = Platform.select({
      ios: `sms:&body=${body}`,
      android: `sms:?body=${body}`,
      default: `sms:?body=${body}`,
    });
    await launchExternal({ appUrls: [smsUrl], appName: "Messages" });
  };

  // The OS share sheet is a native view controller, so it can't be presented
  // while this modal still is — that's the same race that loses an image
  // picker (utils/modal.ts). Close first, wait the dismissal out, then hand
  // over.
  const shareExternally = async () => {
    closeRef.current();
    await waitForIosModalDismiss(400);
    try {
      await Share.share(sharePayload);
    } catch (err) {
      console.error("Default share error:", err);
    }
  };

  if (!visible) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="80%"
      avoidKeyboard
      overlay={
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      }
    >
      {(close) => {
        closeRef.current = close;
        return (
          /* flexShrink so the sheet sizes to its content and only scrolls
             once that content would push past the sheet's maxHeight — without
             it the scroller claims a height of its own and the last section
             ends up below the fold on a sheet that had room to spare. */
          <ScrollView
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="px-4 pb-4 text-[17px] font-semibold text-gray-900">
              {heading}
            </Text>

            {/* ---- Send inside the app ---- */}
            <Text className="px-4 pb-3 text-[13px] font-semibold text-gray-500">
              Send to
            </Text>

            <View
              className="mx-4 flex-row items-center bg-[#F5F5F5] px-3.5 py-2.5"
              style={{ borderRadius: 999, borderCurve: "continuous" }}
            >
              <Search size={16} color="#9CA3AF" />
              <TextInput
                placeholder="Search people you follow"
                value={search}
                onChangeText={setSearch}
                className="ml-2 flex-1 text-base text-gray-900"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {loadingUsers ? (
              <View className="h-24 items-center justify-center">
                <CircularLoader color="#094569" />
              </View>
            ) : !filteredUsers.length ? (
              <View className="h-24 items-center justify-center px-4">
                <Text className="text-[13px] text-gray-400">
                  {search.trim()
                    ? "No one by that name."
                    : "No one to send to yet."}
                </Text>
              </View>
            ) : (
              /* One horizontal row, not a wrapped grid with its own vertical
                 scroll inside a scrolling sheet. */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  gap: PERSON_GAP,
                }}
              >
                {filteredUsers.map((user) => {
                  const selected = selectedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      onPress={() => toggleUserSelection(user.id)}
                      activeOpacity={0.7}
                      style={{ width: PERSON_WIDTH, alignItems: "center" }}
                    >
                      <View style={{ position: "relative" }}>
                        {user.avatar_url ? (
                          <Image
                            source={{ uri: user.avatar_url }}
                            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#E5E7EB" }}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 26,
                              backgroundColor: "#F5F5F5",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <UserRound size={22} color="#9CA3AF" strokeWidth={1.8} />
                          </View>
                        )}
                        {selected && (
                          <View
                            style={{
                              position: "absolute",
                              right: -2,
                              bottom: -2,
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              borderCurve: "continuous",
                              backgroundColor: "#094569",
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 2,
                              borderColor: "#fff",
                            }}
                          >
                            <Check size={11} color="#fff" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text
                        className="mt-2 text-[13px] font-medium text-[#111]"
                        numberOfLines={1}
                      >
                        {user.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* The note and Send only exist once there's someone to send to —
                until then there's nothing to write on or press. */}
            {selectedUserIds.length > 0 && (
              <View className="px-4 pt-4">
                <TextInput
                  placeholder="Add a message (optional)"
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  maxLength={220}
                  className="bg-[#F5F5F5] px-4 py-3 text-base text-gray-900"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    minHeight: 44,
                    maxHeight: 88,
                    borderRadius: MODAL_RADIUS,
                    borderCurve: "continuous",
                    textAlignVertical: "top",
                  }}
                />
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-[13px] text-gray-400">
                    {selectedUserIds.length} selected
                  </Text>
                  <TouchableOpacity
                    onPress={() => void sendInAppNow()}
                    disabled={!canSend}
                    className="py-1"
                  >
                    {sendingInApp ? (
                      <CircularLoader color="#094569" size="small" />
                    ) : (
                      <Text
                        className="text-xl font-medium"
                        style={{ color: canSend ? "#0369A1" : "#93C5FD" }}
                      >
                        Send
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: "#f0f0f0",
                marginHorizontal: 16,
                marginTop: 20,
              }}
            />

            {/* ---- Hand off to another app ---- */}
            <Text className="px-4 pb-3 pt-5 text-[13px] font-semibold text-gray-500">
              Share to
            </Text>
            <View
              className="flex-row px-4"
              style={{ gap: SHEET_TILE_GAP, opacity: launchingExternal ? 0.55 : 1 }}
              pointerEvents={launchingExternal ? "none" : "auto"}
            >
              <SheetAction
                icon={<Link2 size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                label="Copy link"
                onPress={() => void handleCopyLink()}
              />
              <SheetAction
                icon={<MessageSquare size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                label="Messages"
                onPress={() => void openMessages()}
              />
              <SheetAction
                icon={<MessageCircle size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                label="WhatsApp"
                onPress={() => void openWhatsApp()}
              />
              <SheetAction
                icon={<Share2 size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                label="More"
                onPress={() => void shareExternally()}
              />
            </View>
          </ScrollView>
        );
      }}
    </BottomSheetModal>
  );
}
