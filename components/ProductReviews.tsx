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
import StarPicker from "@/components/ui/StarPicker";
import CircularLoader from "@/components/ui/CircularLoader";
import {
  deleteProductReview,
  fetchProductReviews,
  ProductReview,
  upsertProductReview,
  fetchRatingDistribution,
  fetchMyHelpfulVotes,
  toggleReviewHelpful,
  type RatingBucket,
} from "@/lib/productReviewsService";
import { RATING_GOLD } from "@/components/ui/StarRating";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { BadgeCheck, MoreHorizontal, Pencil, Send, Star, ThumbsUp, Trash2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// The app's one star gold, shared with StarRating/StarPicker — this block
// used to carry its own, which is how two surfaces end up with two golds.
const GOLD = RATING_GOLD;

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

/**
 * Star histogram, 5→1.
 *
 * Counted by the database (`product_rating_distribution`), not by reducing
 * over the loaded `reviews` array — that array is one page, so a client-side
 * count is quietly wrong for any product with more reviews than fit in it.
 *
 * Each bar is a filter. Baymard's finding is that shoppers rely on the
 * distribution more than on individual reviews, and that of the sites which
 * show one, 39% don't let you tap it — which is most of its value missing.
 */
function RatingDistribution({
  buckets,
  selected,
  onSelect,
}: {
  buckets: RatingBucket[];
  selected: number | null;
  onSelect: (star: number | null) => void;
}) {
  if (!buckets.length) return null;

  return (
    <View style={{ marginTop: 10, gap: 5 }}>
      {buckets.map((bucket) => {
        const isSelected = selected === bucket.rating;
        return (
          <TouchableOpacity
            key={bucket.rating}
            activeOpacity={0.7}
            // Tapping the selected bar clears the filter, so the way out is
            // the same gesture as the way in.
            onPress={() => onSelect(isSelected ? null : bucket.rating)}
            disabled={bucket.count === 0}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: bucket.count === 0 ? 0.45 : 1,
            }}
          >
            <Text style={{ fontSize: 11, color: isSelected ? "#111" : "#6B7280", width: 10, fontWeight: isSelected ? "700" : "400" }}>
              {bucket.rating}
            </Text>
            <Star size={10} color={GOLD} fill={GOLD} />
            <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
              <View
                style={{
                  width: `${Math.round(bucket.share * 100)}%`,
                  height: "100%",
                  backgroundColor: isSelected ? PRIMARY : GOLD,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: "#9CA3AF", width: 22, textAlign: "right" }}>
              {bucket.count}
            </Text>
          </TouchableOpacity>
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
  /** Fired after a review is successfully saved. The screen above owns the
   *  seller-rating prompt that follows, because the seller block and the
   *  reviews list are two views of the same business and only one of them
   *  should be able to open that sheet. */
  onReviewSubmitted?: () => void;
}

export default function ProductReviews({
  productId,
  productOwnerId,
  averageRating: initialAverage = 0,
  reviewCount: initialCount = 0,
  onReviewCountChange,
  onReviewSubmitted,
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
  // Counted by the database rather than derived from `reviews`, which is one
  // page — see RatingDistribution.
  const [distribution, setDistribution] = useState<RatingBucket[]>([]);
  const [starFilter, setStarFilter] = useState<number | null>(null);
  // Which reviews this user has already found helpful. A Set rather than a
  // flag per review because the votes are fetched in one query for the whole
  // page, not one per row.
  const [myHelpful, setMyHelpful] = useState<Set<string>>(new Set());
  // Optimistic deltas, so the count moves on tap instead of after the round
  // trip. Merged over the server's number, never replacing it.
  const [helpfulDelta, setHelpfulDelta] = useState<Record<string, number>>({});
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
    // Fired together: the histogram is its own query and doesn't depend on
    // the review page, so waiting for one before starting the other would
    // just be slower.
    const [data, buckets] = await Promise.all([
      fetchProductReviews(productId),
      fetchRatingDistribution(productId),
    ]);
    setReviews(data);
    setDistribution(buckets);
    setHelpfulDelta({});
    setMyHelpful(
      userId ? await fetchMyHelpfulVotes(data.map((r) => r.id), userId) : new Set(),
    );
    setLoading(false);
  }, [productId, userId]);

  const handleToggleHelpful = useCallback(
    async (reviewId: string) => {
      if (!userId) return;
      Haptics.selectionAsync();
      const wasHelpful = myHelpful.has(reviewId);

      // Optimistic: flip the mark and nudge the count now, roll back only if
      // the write actually fails.
      setMyHelpful((prev) => {
        const next = new Set(prev);
        if (wasHelpful) next.delete(reviewId);
        else next.add(reviewId);
        return next;
      });
      setHelpfulDelta((prev) => ({
        ...prev,
        [reviewId]: (prev[reviewId] ?? 0) + (wasHelpful ? -1 : 1),
      }));

      const result = await toggleReviewHelpful(reviewId, userId);
      if (result === null) {
        setMyHelpful((prev) => {
          const next = new Set(prev);
          if (wasHelpful) next.add(reviewId);
          else next.delete(reviewId);
          return next;
        });
        setHelpfulDelta((prev) => ({
          ...prev,
          [reviewId]: (prev[reviewId] ?? 0) + (wasHelpful ? 1 : -1),
        }));
      }
    },
    [userId, myHelpful],
  );

  // The filter is applied here rather than re-queried: the histogram already
  // says how many of each star exist, so filtering the loaded page keeps the
  // interaction instant and honest about what it is showing.
  const visibleReviews = useMemo(
    () => (starFilter == null ? reviews : reviews.filter((r) => Math.round(r.rating) === starFilter)),
    [reviews, starFilter],
  );

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
      // After the item, the seller. Asked here rather than on its own screen
      // because this is the one moment the buyer is already thinking about
      // the transaction — see UI_STANDARD § Ratings, reviews and sellers.
      onReviewSubmitted?.();
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
    const marked = myHelpful.has(item.id);
    // Server count plus this session's un-round-tripped taps, floored at 0 so
    // an optimistic un-vote can't render -1.
    const helpfulCount = Math.max(
      0,
      (item.helpful_count ?? 0) + (helpfulDelta[item.id] ?? 0),
    );

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
          <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StarRow rating={item.rating} size={13} />
            {/* Disclosed, not implied: the EU Omnibus Directive requires
                saying whether a review is verified as coming from an actual
                purchaser, and the FTC rule turns on the same distinction.
                Nothing writes orders yet, so this is false everywhere until
                it isn't — which is the honest state, not a missing feature. */}
            {item.verified_purchase && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <BadgeCheck size={12} color="#0369A1" />
                <Text style={{ fontSize: 10, color: "#0369A1", fontWeight: "700" }}>
                  Verified purchase
                </Text>
              </View>
            )}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{fmt(item.created_at)}</Text>
            {/* Not on your own review: marking yourself helpful is noise, and
                every marketplace that allows it regrets it. */}
            {!isOwn && !!userId && (
              <TouchableOpacity
                onPress={() => handleToggleHelpful(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                activeOpacity={0.7}
              >
                <ThumbsUp
                  size={12}
                  color={marked ? PRIMARY : "#9CA3AF"}
                  fill={marked ? PRIMARY : "transparent"}
                  strokeWidth={1.8}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: marked ? PRIMARY : "#9CA3AF",
                    fontWeight: marked ? "700" : "400",
                  }}
                >
                  {helpfulCount > 0 ? `Helpful (${helpfulCount})` : "Helpful"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
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

      {distribution.some((b) => b.count > 0) && (
        <RatingDistribution
          buckets={distribution}
          selected={starFilter}
          onSelect={setStarFilter}
        />
      )}

      {starFilter != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>
            Showing {starFilter}-star reviews
          </Text>
          <TouchableOpacity onPress={() => setStarFilter(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: "600" }}>Show all</Text>
          </TouchableOpacity>
        </View>
      )}

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
      ) : visibleReviews.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          {starFilter != null ? (
            // A filter that matches nothing on this page is a different
            // situation from a product with no reviews, and saying "no
            // reviews yet" here would be untrue.
            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
              No {starFilter}-star reviews on this page
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>No reviews yet</Text>
              <Text style={{ fontSize: 12, color: "#D1D5DB", marginTop: 4 }}>
                Be the first to review this product
              </Text>
            </>
          )}
        </View>
      ) : (
        visibleReviews.map(renderReview)
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
