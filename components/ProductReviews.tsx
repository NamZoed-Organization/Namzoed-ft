/**
 * ProductReviews
 *
 * Inline star-rating + comment reviews list, shown on the product-detail
 * screen the same way InlineComments.tsx is shown on the post-detail screen
 * (components/InlineComments.tsx) — same "Comments N" header shape, same
 * avatar-trigger-row-opens-a-floating-composer-pill interaction, same
 * relative-time/empty/loading treatment, and (as of the media picker below)
 * the same staged-image/video-attachment flow. Deliberately simpler than
 * that component in two ways: no replies, no likes — a review is just a 1-5
 * star rating plus optional text plus optional photos/videos, one per user
 * per product (editable/deletable). Voice notes are intentionally excluded
 * (unlike comments) — not a review's job.
 */

import CommentMediaGallery from "@/components/comments/CommentMediaGallery";
import CommentMediaMessage from "@/components/comments/CommentMediaMessage";
import PendingMediaStrip, { PendingMediaItem } from "@/components/comments/PendingMediaStrip";
import ReviewMediaPicker, { PendingReviewMedia } from "@/components/ReviewMediaPicker";
import ReviewVoiceRecorder, { RecordedReviewVoice } from "@/components/ReviewVoiceRecorder";
import { useUser } from "@/contexts/UserContext";
import ActionSheetModal from "@/components/ui/ActionSheetModal";
import CircularLoader from "@/components/ui/CircularLoader";
import {
  deleteProductReview,
  fetchProductReviews,
  ProductReview,
  upsertProductReview,
} from "@/lib/productReviewsService";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { MoreHorizontal, Pencil, Send, Star, Trash2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const animateMediaLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));

const PRIMARY = "#094569";
const GOLD = "#FBBF24";

function fmt(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

function Avatar({ user, size = 36 }: { user?: ProductReview["user"]; size?: number }) {
  const radius = size / 2;
  if (user?.avatar_url) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#E5E7EB" }}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderCurve: "continuous",
        backgroundColor: PRIMARY,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.38, fontWeight: "700" }}>
        {(user?.name || "U").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Read-only star row — supports fractional ratings (e.g. 4.6) via a
 * clipped-width overlay of a filled row on top of an outline row. */
function StarRow({ rating, size = 14, gap = 2 }: { rating: number; size?: number; gap?: number }) {
  const totalWidth = size * 5 + gap * 4;
  const fillWidth = Math.max(0, Math.min(1, rating / 5)) * totalWidth;
  return (
    <View style={{ width: totalWidth, height: size }}>
      <View style={{ flexDirection: "row", gap }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={size} color="#D1D5DB" fill="#D1D5DB" />
        ))}
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, width: fillWidth, height: size, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", gap, width: totalWidth }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={size} color={GOLD} fill={GOLD} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Tappable 1-5 star picker for the composer. */
function StarPicker({ value, onChange, size = 34 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        // Plain View + the raw responder API, not TouchableOpacity — with
        // the text input below focused, TouchableOpacity's onPress AND
        // onPressIn both still lost their first tap here to the keyboard's
        // dismiss (something upstream — Modal/KeyboardAvoidingView/the
        // gesture-handler root this whole app is wrapped in — was resolving
        // the touch as a blur before Touchable's own JS-side responder
        // negotiation got a turn). onStartShouldSetResponderCapture claims
        // the responder in the CAPTURE phase, before any ancestor (or the
        // keyboard-dismiss logic racing it) gets a chance to react, and
        // onResponderGrant fires immediately once claimed — no negotiation
        // delay, no dependency on keyboardShouldPersistTaps working.
        <View
          key={n}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          onStartShouldSetResponderCapture={() => true}
          onStartShouldSetResponder={() => true}
          onResponderGrant={() => {
            void Haptics.selectionAsync();
            onChange(n);
          }}
        >
          <Star size={size} color={n <= value ? GOLD : "#D1D5DB"} fill={n <= value ? GOLD : "transparent"} />
        </View>
      ))}
    </View>
  );
}

/** Percentage bar per star count (5→1), used under the summary header. */
function RatingDistribution({ reviews }: { reviews: ProductReview[] }) {
  const total = reviews.length;
  if (total === 0) return null;
  const counts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => Math.round(r.rating) === star).length);

  return (
    <View style={{ marginTop: 10, gap: 5 }}>
      {[5, 4, 3, 2, 1].map((star, i) => {
        const pct = total > 0 ? (counts[i] / total) * 100 : 0;
        return (
          <View key={star} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 11, color: "#6B7280", width: 10 }}>{star}</Text>
            <Star size={10} color={GOLD} fill={GOLD} />
            <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: GOLD, borderRadius: 3 }} />
            </View>
            <Text style={{ fontSize: 11, color: "#9CA3AF", width: 22, textAlign: "right" }}>{counts[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewActionSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <ActionSheetModal visible={visible} onClose={onClose}>
      <View
        style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="bg-white">
        <View className="p-4">
          <TouchableOpacity
            className="flex-row items-center py-4 px-2"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onEdit();
            }}
          >
            <Pencil size={20} color="#374151" />
            <Text className="ml-4 text-base text-gray-800 font-medium">Edit review</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center py-4 px-2"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onDelete();
            }}
          >
            <Trash2 size={20} color="#EF4444" />
            <Text className="ml-4 text-base text-red-600 font-medium">Delete review</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center justify-center py-4 px-2 border-t border-gray-100 mt-2"
            onPress={onClose}
          >
            <Text className="text-base text-gray-500 font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ActionSheetModal>
  );
}

export interface ProductReviewsProps {
  productId: string;
  productOwnerId: string;
  averageRating?: number;
  reviewCount?: number;
  onReviewCountChange?: (count: number) => void;
}

export default function ProductReviews({
  productId,
  productOwnerId,
  averageRating: initialAverage = 0,
  reviewCount: initialCount = 0,
  onReviewCountChange,
}: ProductReviewsProps) {
  const { currentUser } = useUser();
  const userId = currentUser?.id ?? "";
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [actionSheetReview, setActionSheetReview] = useState<ProductReview | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Mirrors InlineComments' own composer mode toggle (text vs hold-to-talk
  // voice) — the review composer now uses the exact same bar shape.
  const [composerInputKind, setComposerInputKind] = useState<"text" | "voice">("text");
  const [isHoldRecording, setIsHoldRecording] = useState(false);
  const [showStarPicker, setShowStarPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Images/videos staged for the review being composed — same "pick now,
  // upload in the background, attach whichever finished by send time" flow
  // as InlineComments' own pendingMedia (see components/InlineComments.tsx).
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  // One optional voice note, separate from the image/video gallery above —
  // mirrors post_comments' own singular voice-note columns.
  const [voiceNote, setVoiceNote] = useState<RecordedReviewVoice | null>(null);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(150)).current;

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const data = await fetchProductReviews(productId);
    setReviews(data);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const myReview = reviews.find((r) => r.user_id === userId) ?? null;
  const average =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : initialAverage;
  const count = reviews.length || initialCount;

  const openComposer = (prefill?: ProductReview) => {
    const source = prefill ?? myReview;
    setDraftRating(source?.rating ?? 0);
    setDraftText(source?.text ?? "");
    // Pre-existing media shows up as already-uploaded pending items (their
    // hosted URL doubles as both `uri` for the thumbnail and `uploadedUrl`
    // for submit) so editing a review lets you remove/add photos the same
    // way composing a new one does.
    setPendingMedia(
      (source?.media ?? []).map((m) => ({
        id: m.id,
        uri: m.url,
        type: m.type,
        duration: m.duration ?? undefined,
        uploadedUrl: m.url,
        uploading: false,
      })),
    );
    setVoiceNote(source?.media_url ? { url: source.media_url, duration: source.media_duration ?? 0 } : null);
    setComposerInputKind("text");
    setShowStarPicker(false);
    setComposerOpen(true);
    backdropOpacity.setValue(0);
    sheetY.setValue(150);
    Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200, mass: 0.9 }).start();
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const closeComposer = () => {
    Keyboard.dismiss();
    Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(sheetY, { toValue: 150, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setComposerOpen(false);
    });
  };

  const handleMediaPicked = (items: PendingReviewMedia[]) => {
    animateMediaLayout();
    setPendingMedia((prev) => [...prev, ...items.map((m) => ({ ...m, uploading: true }))]);
    // The native picker backgrounds the app briefly, which drops keyboard
    // focus — bring it back so the caption stays readily typeable.
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handlePendingMediaUploaded = (id: string, result: { url: string; type: "image" | "video"; duration?: number }) => {
    setPendingMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, uploadedUrl: result.url } : m)));
  };

  const handlePendingMediaFailed = (id: string) => {
    setPendingMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, failed: true } : m)));
  };

  const removePendingMedia = (id: string) => {
    animateMediaLayout();
    setPendingMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = async () => {
    const hasPendingUploads = pendingMedia.some((m) => m.uploading);
    if (!draftRating || !userId || posting || hasPendingUploads) return;
    setPosting(true);
    const media = pendingMedia
      .filter((m) => m.uploadedUrl)
      .map((m) => ({ url: m.uploadedUrl!, type: m.type, duration: m.duration }));
    const result = await upsertProductReview(productId, userId, draftRating, draftText, media, voiceNote);
    if (result) {
      setReviews((prev) => {
        const next = prev.filter((r) => r.id !== result.id && r.user_id !== userId);
        return [result, ...next];
      });
      onReviewCountChange?.(reviews.some((r) => r.user_id === userId) ? reviews.length : reviews.length + 1);
      closeComposer();
    }
    setPosting(false);
  };

  const handleDelete = async () => {
    if (!actionSheetReview || !userId) return;
    const id = actionSheetReview.id;
    setActionSheetReview(null);
    const ok = await deleteProductReview(id, userId);
    if (ok) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
      onReviewCountChange?.(Math.max(0, reviews.length - 1));
    }
  };

  const renderReview = (item: ProductReview) => {
    const isOwn = item.user_id === userId;
    const authorName = item.user?.name ?? "User";

    return (
      <View key={item.id} style={{ flexDirection: "row", paddingVertical: 14 }}>
        <Avatar user={item.user} size={36} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#9ca3af" }}>{authorName}</Text>
            {item.user_id === productOwnerId && (
              <View style={{ backgroundColor: "rgba(9,69,105,0.08)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: "700" }}>Seller</Text>
              </View>
            )}
          </View>
          <View style={{ marginTop: 4 }}>
            <StarRow rating={item.rating} size={13} />
          </View>
          {!!item.text && (
            <Text style={{ fontSize: 15, color: "#374151", marginTop: 6, lineHeight: 21 }}>{item.text}</Text>
          )}
          {item.media && item.media.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <CommentMediaGallery items={item.media} />
            </View>
          )}
          {item.media_url && item.media_type === "audio" && (
            <View style={{ marginTop: 8 }}>
              <CommentMediaMessage url={item.media_url} duration={item.media_duration} />
            </View>
          )}
          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{fmt(item.created_at)}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity
            onPress={() => setActionSheetReview(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingLeft: 8, paddingTop: 2 }}
          >
            <MoreHorizontal size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const sendDisabled = draftRating === 0 || posting || pendingMedia.some((m) => m.uploading);

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#111" }}>Reviews {count}</Text>
        {count > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StarRow rating={average} size={14} />
            <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600" }}>{average.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {reviews.length > 0 && <RatingDistribution reviews={reviews} />}

      {/* Trigger row — mirrors InlineComments' own "Add a comment…" row. */}
      <TouchableOpacity
        onPress={() => openComposer()}
        activeOpacity={0.7}
        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14 }}
      >
        <Avatar user={{ id: userId, name: currentUser?.name ?? "U", avatar_url: currentUser?.avatar_url }} size={32} />
        <View
          style={{
            flex: 1,
            marginHorizontal: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: "#F9FAFB",
            borderRadius: 20,
            borderCurve: "continuous",
          }}
        >
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
            {myReview ? "Edit your review…" : "Write a review…"}
          </Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <CircularLoader size="small" color={PRIMARY} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>No reviews yet</Text>
          <Text style={{ fontSize: 12, color: "#D1D5DB", marginTop: 4 }}>Be the first to review this product</Text>
        </View>
      ) : (
        reviews.map(renderReview)
      )}

      {/* Composer — same backdrop-fade + slide-up-pill treatment as
          InlineComments.openComposer/closeComposer. */}
      <Modal visible={composerOpen} transparent animationType="none" onRequestClose={closeComposer}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", opacity: backdropOpacity }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeComposer} />
          </Animated.View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, justifyContent: "flex-end" }}
            pointerEvents="box-none"
          >
            <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
              <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) }}>
                <View style={{ borderRadius: 26 }}>
                  {/* Background clipped separately from the content, so the
                      blur/tint's rounded corners stay crisp without also
                      clipping the hold-to-talk recorder's dome, which
                      extends well past its own row (see ReviewVoiceRecorder
                      and InlineComments' identical composer bar). */}
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: 26,
                        borderCurve: "continuous",
                        overflow: "hidden",
                        backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(255,255,255,0.95)",
                      },
                    ]}
                  >
                    {Platform.OS === "ios" && (
                      <BlurView tint="systemChromeMaterial" intensity={80} style={StyleSheet.absoluteFill} />
                    )}
                  </View>

                  {/* Staged photos/videos — the pill grows to fit this row
                      in place, no separate modal, keyboard stays up. */}
                  <PendingMediaStrip items={pendingMedia} onRemove={removePendingMedia} />

                  {voiceNote && (
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 10, gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <CommentMediaMessage url={voiceNote.url} duration={voiceNote.duration} />
                      </View>
                      <TouchableOpacity onPress={() => setVoiceNote(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {composerInputKind === "voice" && !voiceNote ? (
                    // Voice mode — no rating button here (a review's rating
                    // isn't part of the hold-to-talk flow), and deliberately
                    // NOT wrapped in a ScrollView: the recorder's dome
                    // extends well past this row via absolute positioning
                    // and a ScrollView would clip it.
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 }}>
                      {!isHoldRecording && (
                        <TouchableOpacity
                          onPress={() => setComposerInputKind("text")}
                          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="keyboard" size={22} color="#6B7280" />
                        </TouchableOpacity>
                      )}
                      <View style={{ flex: 1, marginHorizontal: 10, minHeight: 38, justifyContent: "center" }}>
                        <ReviewVoiceRecorder
                          productId={productId}
                          userId={userId}
                          onRecorded={(v) => {
                            setVoiceNote(v);
                            setComposerInputKind("text");
                          }}
                          onRecordingStateChange={setIsHoldRecording}
                        />
                      </View>
                    </View>
                  ) : (
                    // Text mode (also covers "voice note already staged") —
                    // wrapped in a non-scrolling ScrollView purely for
                    // keyboardShouldPersistTaps="always": without a
                    // ScrollView ancestor, the first tap on any of these
                    // buttons while the text input is focused only dismisses
                    // the keyboard instead of reaching the button, requiring
                    // a second tap. Safe here — the recorder never renders in
                    // this branch, so there's no dome to clip.
                    <ScrollView
                      keyboardShouldPersistTaps="always"
                      scrollEnabled={false}
                      contentContainerStyle={{ paddingHorizontal: 14 }}
                    >
                      {showStarPicker && (
                        <View style={{ paddingTop: 12, alignItems: "center" }}>
                          <StarPicker
                            value={draftRating}
                            onChange={(n) => {
                              setDraftRating(n);
                              setShowStarPicker(false);
                            }}
                            size={28}
                          />
                        </View>
                      )}

                      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                        {/* Star rating toggle — the review-specific addition
                            to InlineComments' own row shape. Raw responder
                            capture, same as StarPicker's own stars just
                            above: the text input can be focused, and a plain
                            TouchableOpacity's first tap here got eaten by the
                            keyboard-dismiss racing it. */}
                        <View
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                          onStartShouldSetResponderCapture={() => true}
                          onStartShouldSetResponder={() => true}
                          onResponderGrant={() => {
                            void Haptics.selectionAsync();
                            setShowStarPicker((s) => !s);
                          }}
                        >
                          <Star size={20} color={draftRating > 0 ? GOLD : "#6B7280"} fill={draftRating > 0 ? GOLD : "transparent"} />
                        </View>

                        <ReviewMediaPicker
                          productId={productId}
                          userId={userId}
                          existingCount={pendingMedia.length}
                          onPicked={handleMediaPicked}
                          onUploaded={handlePendingMediaUploaded}
                          onFailed={handlePendingMediaFailed}
                        />

                        {!voiceNote && (
                          <TouchableOpacity
                            onPress={() => setComposerInputKind("voice")}
                            style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="mic-outline" size={22} color="#6B7280" />
                          </TouchableOpacity>
                        )}

                        <TextInput
                          ref={inputRef}
                          value={draftText}
                          onChangeText={setDraftText}
                          placeholder="Share your thoughts"
                          placeholderTextColor="#9CA3AF"
                          multiline
                          maxLength={500}
                          style={{
                            flex: 1,
                            marginHorizontal: 10,
                            fontSize: 14,
                            color: "#111",
                            maxHeight: 80,
                            paddingVertical: 8,
                            paddingHorizontal: 4,
                          }}
                        />
                        <TouchableOpacity
                          onPress={handleSubmit}
                          disabled={sendDisabled}
                          style={{ opacity: sendDisabled ? 0.35 : 1 }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {posting ? (
                            <CircularLoader size="small" color={PRIMARY} />
                          ) : (
                            <Send size={20} color={PRIMARY} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  )}
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ReviewActionSheet
        visible={!!actionSheetReview}
        onClose={() => setActionSheetReview(null)}
        onEdit={() => {
          const target = actionSheetReview;
          setActionSheetReview(null);
          if (target) openComposer(target);
        }}
        onDelete={handleDelete}
      />
    </View>
  );
}
