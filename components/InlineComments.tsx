/**
 * InlineComments
 *
 * Plain (non-modal) comments list + composer, used by the post-detail
 * screen (FeedPost in onBack mode) so comments render directly in the
 * scrollable page instead of requiring the CommentsModal bottom sheet.
 *
 * Deliberately a separate, self-contained component rather than an
 * extraction from CommentsModal.tsx: CommentsModal's state is entangled
 * with its bottom-sheet drag/keyboard-offset animation, and it's also used
 * by ReelsViewer — duplicating the (fairly mechanical) fetch/like/reply
 * wiring here keeps this change from touching that shared, higher-risk file.
 */

import { useUser } from "@/contexts/UserContext";
import CommentActionSheet from "@/components/modals/CommentActionSheet";
import CommentMediaGallery from "@/components/comments/CommentMediaGallery";
import CommentMediaMessage from "@/components/comments/CommentMediaMessage";
import CommentMediaPicker, { PendingCommentMedia } from "@/components/comments/CommentMediaPicker";
import CommentVoiceRecorder from "@/components/comments/CommentVoiceRecorder";
import PendingMediaStrip, { PendingMediaItem } from "@/components/comments/PendingMediaStrip";
import ReportCommentModal from "@/components/modals/ReportCommentModal";
import CircularLoader from "@/components/ui/CircularLoader";
import {
  addPostComment,
  addPostCommentWithGallery,
  addReply,
  addReplyWithGallery,
  CommentReply,
  deletePostComment,
  deleteReply,
  getPostComments,
  getRepliesForComment,
  PostComment,
  toggleCommentLike,
  toggleReplyLike,
} from "@/lib/commentsService";
import { playSound } from "@/lib/soundUtils";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CornerDownRight, Send, X } from "lucide-react-native";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// Animates the pill growing/shrinking as media is added/removed — same
// spring feel as the pill's own open/close animations elsewhere in this file.
const animateMediaLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

function fmt(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

function Avatar({ user, size = 36 }: { user?: PostComment["user"]; size?: number }) {
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

/** Marks a comment/reply written by the post's own author — no icon, brand blue. */
function AuthorBadge() {
  return (
    <View
      style={{
        backgroundColor: "rgba(9,69,105,0.08)",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: "700" }}>Author</Text>
    </View>
  );
}

/** Marks a comment/reply the post's own author has liked. */
function AuthorLikedBadge() {
  return (
    <View
      style={{
        backgroundColor: "#F3F4F6",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 10, color: "#6B7280", fontWeight: "600" }}>Author liked</Text>
    </View>
  );
}

export interface InlineCommentsProps {
  postId: string;
  postOwnerId: string;
  onCommentCountChange?: (count: number) => void;
  /** Owner-only "Likes"/"Saves" tabs next to "Comments" — see onPressLikes/onPressSaves. */
  isOwnPost?: boolean;
  likesCount?: number;
  saveCount?: number;
  /** Opens the likers list (replaces the old below-image "X likes" modal trigger). */
  onPressLikes?: () => void;
  /** Opens the saver list. */
  onPressSaves?: () => void;
}

/** Imperative handle so a sibling (e.g. FeedPost's fixed bottom bar) can open
 * this same composer instead of duplicating the modal/posting logic. */
export interface InlineCommentsHandle {
  open: () => void;
}

function InlineComments(
  {
    postId,
    postOwnerId,
    onCommentCountChange,
    isOwnPost,
    likesCount = 0,
    saveCount = 0,
    onPressLikes,
    onPressSaves,
  }: InlineCommentsProps,
  ref: React.ForwardedRef<InlineCommentsHandle>,
) {
  const { currentUser } = useUser();
  const userId = currentUser?.id ?? "";
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<PostComment[]>([]);
  const [replies, setReplies] = useState<Record<string, CommentReply[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    commentOwnerId: string;
    name: string;
  } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  // Reply/Delete or Reply/Report action sheet — shared by comment and reply
  // rows (parentCommentId set only for replies, so delete/reply route correctly).
  const [actionSheetTarget, setActionSheetTarget] = useState<{
    type: "comment" | "reply";
    id: string;
    parentCommentId?: string;
    ownerId: string;
    authorName: string;
  } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; ownerId: string } | null>(null);
  // The composer opens as its own Modal (see bottom of render) so typing a
  // comment never has to scroll the whole post — it just floats above the
  // keyboard like a chat input, independent of the post's own scroll position.
  const [composerOpen, setComposerOpen] = useState(false);
  // 'voice' swaps the text input for CommentVoiceRecorder's hold-to-talk area.
  const [composerInputKind, setComposerInputKind] = useState<"text" | "voice">("text");
  const [isHoldRecording, setIsHoldRecording] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Images/videos picked for the comment currently being composed — staged
  // inline (see PendingMediaStrip) instead of in a separate modal, so the
  // keyboard/caption stay live the whole time. Uploads happen in the
  // background as soon as they're picked; sending just attaches whichever
  // have finished by the time the user taps send.
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  // Grey backdrop fades via opacity while the input bar itself slides up —
  // two separate Animated.Values since Modal's own animationType would
  // otherwise move both together (same reasoning as BottomSheetModal).
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(150)).current;

  const openComposer = () => {
    setComposerOpen(true);
    backdropOpacity.setValue(0);
    sheetY.setValue(150);
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
    }).start();
    setTimeout(() => inputRef.current?.focus(), 150);
  };
  const closeComposer = () => {
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(sheetY, {
      toValue: 150,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setComposerOpen(false);
        setReplyTarget(null);
      }
    });
  };

  useImperativeHandle(ref, () => ({ open: openComposer }));

  const load = useCallback(async () => {
    if (!postId || !userId) return;
    setLoading(true);
    const data = await getPostComments(postId, userId, postOwnerId);
    setComments(data);
    setLoading(false);
  }, [postId, userId, postOwnerId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tracks real keyboard visibility so the pill's bottom padding can drop
  // the extra home-indicator safe-area gap while the keyboard already fills
  // that space — without this the pill floats with a large, keyboard-sized
  // gap of empty space beneath it.
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

  const handlePost = async () => {
    const hasMedia = pendingMedia.length > 0;
    const hasPendingUploads = pendingMedia.some((m) => m.uploading);
    if ((!text.trim() && !hasMedia) || !userId || posting || hasPendingUploads) return;
    setPosting(true);

    const media = pendingMedia
      .filter((m) => m.uploadedUrl)
      .map((m) => ({ url: m.uploadedUrl!, type: m.type, duration: m.duration }));

    if (replyTarget) {
      const reply = hasMedia
        ? await addReplyWithGallery(
            replyTarget.commentId,
            userId,
            text,
            postOwnerId,
            replyTarget.commentOwnerId,
            postId,
            media,
          )
        : await addReply(
            replyTarget.commentId,
            userId,
            text,
            postOwnerId,
            replyTarget.commentOwnerId,
            postId,
          );
      if (reply) {
        void playSound("comment");
        setReplies((prev) => ({
          ...prev,
          [replyTarget.commentId]: [...(prev[replyTarget.commentId] ?? []), reply],
        }));
        setExpanded((prev) => new Set(prev).add(replyTarget.commentId));
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTarget.commentId
              ? { ...c, reply_count: c.reply_count + 1 }
              : c,
          ),
        );
        closeComposer();
      }
      setReplyTarget(null);
    } else {
      const comment = hasMedia
        ? await addPostCommentWithGallery(postId, userId, text, media)
        : await addPostComment(postId, userId, text);
      if (comment) {
        void playSound("comment");
        setComments((prev) => [...prev, comment]);
        onCommentCountChange?.(comments.length + 1);
        closeComposer();
      }
    }
    setText("");
    animateMediaLayout();
    setPendingMedia([]);
    setPosting(false);
  };

  // ── voice comment ────────────────────────────────────────────────
  // CommentVoiceRecorder posts immediately on release (hold-to-talk has no
  // separate "caption" step the way picking media does), so these mirror
  // handlePost's reply-vs-top-level branching but keyed off the isReply flag
  // the recorder already resolved internally.
  const handleMediaOptimistic = (item: PostComment | CommentReply, isReply: boolean) => {
    if (isReply) {
      const reply = item as CommentReply;
      setReplies((prev) => ({
        ...prev,
        [reply.comment_id]: [...(prev[reply.comment_id] ?? []), reply],
      }));
      setExpanded((prev) => new Set(prev).add(reply.comment_id));
    } else {
      setComments((prev) => [...prev, item as PostComment]);
    }
    // Media/voice comments post immediately (optimistic), so close the
    // composer right away too — same moment text comments close it.
    closeComposer();
  };

  const handleMediaUploadSuccess = (
    item: PostComment | CommentReply,
    optimisticId: string,
    isReply: boolean,
  ) => {
    void playSound("comment");
    if (isReply) {
      const reply = item as CommentReply;
      setReplies((prev) => ({
        ...prev,
        [reply.comment_id]: (prev[reply.comment_id] ?? []).map((r) =>
          r.id === optimisticId ? reply : r,
        ),
      }));
      setComments((prev) =>
        prev.map((c) => (c.id === reply.comment_id ? { ...c, reply_count: c.reply_count + 1 } : c)),
      );
    } else {
      setComments((prev) => prev.map((c) => (c.id === optimisticId ? (item as PostComment) : c)));
      onCommentCountChange?.(comments.length + 1);
    }
  };

  const handleMediaUploadError = (optimisticId: string, isReply: boolean) => {
    if (isReply) {
      setReplies((prev) => {
        const next: Record<string, CommentReply[]> = {};
        for (const [commentId, list] of Object.entries(prev)) {
          next[commentId] = list.filter((r) => r.id !== optimisticId);
        }
        return next;
      });
    } else {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
    }
  };

  // ── staged image/video attachments ──────────────────────────────────
  const handleMediaPicked = (items: PendingCommentMedia[]) => {
    animateMediaLayout();
    setPendingMedia((prev) => [...prev, ...items.map((m) => ({ ...m, uploading: true }))]);
    // The native picker backgrounds the app briefly, which drops keyboard
    // focus — bring it back so the caption stays readily typeable.
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handlePendingMediaUploaded = (
    id: string,
    result: { url: string; type: "image" | "video"; duration?: number },
  ) => {
    setPendingMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, uploading: false, uploadedUrl: result.url } : m)),
    );
  };

  const handlePendingMediaFailed = (id: string) => {
    setPendingMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, failed: true } : m)));
  };

  const removePendingMedia = (id: string) => {
    animateMediaLayout();
    setPendingMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await deletePostComment(commentId, userId);
    if (ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange?.(comments.length - 1);
    }
  };

  const handleDeleteReply = async (replyId: string, commentId: string) => {
    const ok = await deleteReply(replyId, userId);
    if (ok) {
      setReplies((prev) => ({
        ...prev,
        [commentId]: (prev[commentId] ?? []).filter((r) => r.id !== replyId),
      }));
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, reply_count: Math.max(0, c.reply_count - 1) } : c,
        ),
      );
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!userId) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              is_liked_by_me: !c.is_liked_by_me,
              like_count: c.is_liked_by_me ? c.like_count - 1 : c.like_count + 1,
            }
          : c,
      ),
    );
    const result = await toggleCommentLike(commentId, userId, postOwnerId);
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              is_liked_by_me: result.liked,
              like_count: result.count,
              creator_liked: result.creatorLiked,
            }
          : c,
      ),
    );
  };

  const handleReplyLike = async (replyId: string, commentId: string) => {
    if (!userId) return;
    setReplies((prev) => ({
      ...prev,
      [commentId]: (prev[commentId] ?? []).map((r) =>
        r.id === replyId
          ? {
              ...r,
              is_liked_by_me: !r.is_liked_by_me,
              like_count: r.is_liked_by_me ? r.like_count - 1 : r.like_count + 1,
            }
          : r,
      ),
    }));
    const result = await toggleReplyLike(replyId, userId, postOwnerId);
    setReplies((prev) => ({
      ...prev,
      [commentId]: (prev[commentId] ?? []).map((r) =>
        r.id === replyId
          ? {
              ...r,
              is_liked_by_me: result.liked,
              like_count: result.count,
              creator_liked: result.creatorLiked,
            }
          : r,
      ),
    }));
  };

  const handleToggleReplies = async (commentId: string) => {
    if (expanded.has(commentId)) {
      setExpanded((prev) => {
        const s = new Set(prev);
        s.delete(commentId);
        return s;
      });
      return;
    }
    setExpanded((prev) => new Set(prev).add(commentId));
    if (replies[commentId]) return;

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    const data = await getRepliesForComment(commentId, userId, postOwnerId);
    setReplies((prev) => ({ ...prev, [commentId]: data }));
    setLoadingReplies((prev) => {
      const s = new Set(prev);
      s.delete(commentId);
      return s;
    });
  };

  const startReplyTo = (commentId: string, commentOwnerId: string, name: string) => {
    setReplyTarget({ commentId, commentOwnerId, name });
    openComposer();
  };

  // ── Reply/Delete/Report action sheet handlers ──────────────────────
  const handleActionSheetReply = () => {
    if (!actionSheetTarget) return;
    startReplyTo(
      actionSheetTarget.parentCommentId ?? actionSheetTarget.id,
      actionSheetTarget.ownerId,
      actionSheetTarget.authorName,
    );
    setActionSheetTarget(null);
  };

  const handleActionSheetDelete = () => {
    if (!actionSheetTarget) return;
    if (actionSheetTarget.type === "comment") {
      handleDeleteComment(actionSheetTarget.id);
    } else if (actionSheetTarget.parentCommentId) {
      handleDeleteReply(actionSheetTarget.id, actionSheetTarget.parentCommentId);
    }
    setActionSheetTarget(null);
  };

  const handleActionSheetReport = () => {
    if (!actionSheetTarget) return;
    setReportTarget({ id: actionSheetTarget.id, ownerId: actionSheetTarget.ownerId });
    setActionSheetTarget(null);
  };

  const renderReply = (reply: CommentReply, commentId: string) => {
    const isOwn = reply.user_id === userId;
    const authorName = reply.user?.name ?? "User";

    const openReplyActionSheet = () =>
      setActionSheetTarget({
        type: "reply",
        id: reply.id,
        parentCommentId: commentId,
        ownerId: reply.user_id,
        authorName,
      });

    return (
      <View key={reply.id} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, paddingRight: 14 }}>
        <CornerDownRight size={14} color="#D1D5DB" style={{ marginTop: 10, marginRight: 6 }} />
        <Avatar user={reply.user} size={28} />
        <TouchableOpacity
          activeOpacity={0.7}
          delayLongPress={350}
          onPress={() => {
            if (isOwn) {
              openReplyActionSheet();
            } else {
              startReplyTo(commentId, reply.user_id, authorName);
            }
          }}
          onLongPress={() => {
            if (!isOwn) openReplyActionSheet();
          }}
          style={{ flex: 1, marginLeft: 8 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#9ca3af" }}>
              {authorName}
            </Text>
            {reply.user_id === postOwnerId && <AuthorBadge />}
          </View>
          {!!reply.text && (
            <Text style={{ fontSize: 15, color: "#374151", marginTop: 2, lineHeight: 21 }}>
              {reply.text}
            </Text>
          )}
          {reply.media_url && reply.media_type && (
            <View style={{ marginTop: 6 }}>
              <CommentMediaMessage
                url={reply.media_url}
                duration={reply.media_duration}
                isOptimistic={reply.isOptimistic}
              />
            </View>
          )}
          {reply.media && reply.media.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <CommentMediaGallery items={reply.media} />
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
              {fmt(reply.created_at)}
            </Text>
            <TouchableOpacity
              onPress={() => startReplyTo(commentId, reply.user_id, authorName)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "500" }}>Reply</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleReplyLike(reply.id, commentId)}
          style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={reply.is_liked_by_me ? "heart" : "heart-outline"}
            size={13}
            color={reply.is_liked_by_me ? "#ef4444" : "#9CA3AF"}
          />
          {reply.like_count > 0 && (
            <Text style={{ fontSize: 12, color: reply.is_liked_by_me ? "#ef4444" : "#9CA3AF" }}>
              {reply.like_count}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderComment = (item: PostComment) => {
    const isExpanded = expanded.has(item.id);
    const isLoadingR = loadingReplies.has(item.id);
    const commentReplies = replies[item.id] ?? [];
    const isOwn = item.user_id === userId;
    const authorName = item.user?.name ?? "User";

    const openCommentActionSheet = () =>
      setActionSheetTarget({
        type: "comment",
        id: item.id,
        ownerId: item.user_id,
        authorName,
      });

    return (
      <View key={item.id}>
        <View style={{ flexDirection: "row", paddingVertical: 14 }}>
          <Avatar user={item.user} size={36} />
          <TouchableOpacity
            activeOpacity={0.7}
            delayLongPress={350}
            onPress={() => {
              if (isOwn) {
                openCommentActionSheet();
              } else {
                startReplyTo(item.id, item.user_id, authorName);
              }
            }}
            onLongPress={() => {
              if (!isOwn) openCommentActionSheet();
            }}
            style={{ flex: 1, marginLeft: 10 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#9ca3af" }}>
                {authorName}
              </Text>
              {item.user_id === postOwnerId && <AuthorBadge />}
            </View>
            {!!item.text && (
              <Text style={{ fontSize: 15, color: "#374151", marginTop: 2, lineHeight: 21 }}>
                {item.text}
              </Text>
            )}
            {item.media_url && item.media_type && (
              <View style={{ marginTop: 6 }}>
                <CommentMediaMessage
                  url={item.media_url}
                  duration={item.media_duration}
                  isOptimistic={item.isOptimistic}
                />
              </View>
            )}
            {item.media && item.media.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <CommentMediaGallery items={item.media} />
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 }}>
              <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                {fmt(item.created_at)}
              </Text>
              <TouchableOpacity
                onPress={() => startReplyTo(item.id, item.user_id, authorName)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "500" }}>Reply</Text>
              </TouchableOpacity>
            </View>

            {item.creator_liked && (
              <View style={{ marginTop: 6 }}>
                <AuthorLikedBadge />
              </View>
            )}

            {item.reply_count > 0 && (
              <TouchableOpacity
                onPress={() => handleToggleReplies(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}
              >
                <View style={{ width: 24, height: 1, backgroundColor: "#D1D5DB" }} />
                {isLoadingR ? (
                  <CircularLoader size="small" color={PRIMARY} />
                ) : (
                  <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "500" }}>
                    {isExpanded ? "Hide replies" : `View ${item.reply_count} ${item.reply_count === 1 ? "reply" : "replies"}`}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleCommentLike(item.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={item.is_liked_by_me ? "heart" : "heart-outline"}
              size={14}
              color={item.is_liked_by_me ? "#ef4444" : "#9CA3AF"}
            />
            {item.like_count > 0 && (
              <Text style={{ fontSize: 12, color: item.is_liked_by_me ? "#ef4444" : "#9CA3AF" }}>
                {item.like_count}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={{ paddingLeft: 12, paddingBottom: 6 }}>
            {commentReplies.map((r) => renderReply(r, item.id))}
          </View>
        )}
      </View>
    );
  };

  // Floating input pill — same rounded/blurred/clipped treatment (and
  // half-pill backdrop cutoff, added by the caller below) as the post-detail
  // fixed bottom bar and CommentsModal's own composer.
  const renderComposerBar = (paddingBottom: number) => {
    const sendDisabled =
      (!text.trim() && pendingMedia.length === 0) || posting || pendingMedia.some((m) => m.uploading);

    return (
    <View>
      {replyTarget && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: "#F9FAFB",
          }}
        >
          <Text style={{ fontSize: 12, color: "#6B7280" }}>
            Replying to <Text style={{ fontWeight: "700" }}>@{replyTarget.name}</Text>
          </Text>
          <TouchableOpacity onPress={() => setReplyTarget(null)}>
            <X size={14} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom }}>
        <View style={{ borderRadius: 26 }}>
          {/* Background clipped separately from the content, so the
              blur/tint's rounded corners stay crisp without also clipping
              anything the content row might need to overflow. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 26,
                overflow: "hidden",
                backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(255,255,255,0.85)",
              },
            ]}
          >
            {Platform.OS === "ios" && (
              <BlurView tint="systemChromeMaterial" intensity={50} style={StyleSheet.absoluteFill} />
            )}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(209,213,219,0.2)" }]} />
          </View>

          {/* Staged image/video attachments — the pill grows to fit this
              row in place, no separate modal, keyboard stays up. */}
          <PendingMediaStrip items={pendingMedia} onRemove={removePendingMedia} />

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 }}>
            {composerInputKind === "text" && (
              <CommentMediaPicker
                postId={postId}
                replyTarget={replyTarget ? { commentId: replyTarget.commentId, commentOwnerId: replyTarget.commentOwnerId } : null}
                existingCount={pendingMedia.length}
                onPicked={handleMediaPicked}
                onUploaded={handlePendingMediaUploaded}
                onFailed={handlePendingMediaFailed}
              />
            )}

            {isHoldRecording ? null : composerInputKind === "text" ? (
              <TouchableOpacity
                onPress={() => setComposerInputKind("voice")}
                style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="mic-outline" size={22} color="#6B7280" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setComposerInputKind("text")}
                style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="keyboard" size={22} color="#6B7280" />
              </TouchableOpacity>
            )}

            {composerInputKind === "voice" && !text.trim() ? (
              <View style={{ flex: 1, marginHorizontal: 10, minHeight: 38, justifyContent: "center" }}>
                <CommentVoiceRecorder
                  currentUser={{ id: userId, name: currentUser?.name ?? "U", avatar_url: currentUser?.avatar_url }}
                  postId={postId}
                  postOwnerId={postOwnerId}
                  replyTarget={replyTarget ? { commentId: replyTarget.commentId, commentOwnerId: replyTarget.commentOwnerId } : null}
                  onOptimistic={handleMediaOptimistic}
                  onUploadSuccess={handleMediaUploadSuccess}
                  onUploadError={handleMediaUploadError}
                  onRecordingStateChange={setIsHoldRecording}
                />
              </View>
            ) : (
              <>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder={replyTarget ? `Reply to ${replyTarget.name}…` : "Add a comment…"}
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
                  onPress={handlePost}
                  disabled={sendDisabled}
                  style={{ opacity: sendDisabled ? 0.35 : 1 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {posting || pendingMedia.some((m) => m.uploading) ? (
                    <CircularLoader size="small" color={PRIMARY} />
                  ) : (
                    <Send size={20} color={PRIMARY} />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
    );
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#111" }}>
          Comments {comments.length}
        </Text>
        {isOwnPost && (
          <>
            <TouchableOpacity onPress={onPressLikes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#6B7280" }}>
                Likes {likesCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPressSaves} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#6B7280" }}>
                Saves {saveCount}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Trigger row — first, right under the header. Tapping opens the
          composer modal instead of focusing an inline input, so typing
          never has to scroll the whole post. */}
      <TouchableOpacity
        onPress={openComposer}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: 14,
        }}
      >
        <Avatar
          user={{ id: userId, name: currentUser?.name ?? "U", avatar_url: currentUser?.avatar_url }}
          size={32}
        />
        <View
          style={{
            flex: 1,
            marginHorizontal: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: "#F9FAFB",
            borderRadius: 20,
          }}
        >
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>Add a comment…</Text>
        </View>
      </TouchableOpacity>

      {/* Actual comments — only rendered when the post has any. */}
      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <CircularLoader size="small" color={PRIMARY} />
        </View>
      ) : comments.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>No comments yet</Text>
          <Text style={{ fontSize: 12, color: "#D1D5DB", marginTop: 4 }}>
            Be the first to comment
          </Text>
        </View>
      ) : (
        comments.map((c) => renderComment(c))
      )}

      {/* Composer — a lightweight modal pinned above the keyboard, separate
          from the post's own scroll so it can't drag the whole page around.
          Grey backdrop fades via opacity, input bar slides up like a drawer.
          (Tried docking the bar to an iOS InputAccessoryView instead, so it
          would track the keyboard's real top edge with no gap — reverted:
          the linked TextInput wasn't reliably focusing inside it, so both
          the bar and the keyboard failed to show at all. Not worth a broken
          composer for a cosmetic win — back to the manual KeyboardAvoidingView
          track on both platforms.) */}
      <Modal visible={composerOpen} transparent animationType="none" onRequestClose={closeComposer}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.4)", opacity: backdropOpacity },
            ]}
          >
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeComposer} />
          </Animated.View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, justifyContent: "flex-end" }}
            pointerEvents="box-none"
          >
              <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
                {/* No content scrolls behind this composer (unlike the
                    post-detail bottom bar / CommentsModal, which float over
                    a list) — it's just the pill over a dimmed backdrop, so
                    it doesn't need their half-pill white cutoff layer. Once
                    the keyboard is up it already fills the safe-area gap,
                    so only add that inset when the keyboard is closed —
                    otherwise the pill floats with a large empty gap above
                    the keyboard. */}
                {renderComposerBar(keyboardVisible ? 12 : Math.max(insets.bottom, 12))}
              </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CommentActionSheet
        visible={!!actionSheetTarget}
        onClose={() => setActionSheetTarget(null)}
        isOwnComment={actionSheetTarget?.ownerId === userId}
        onReply={handleActionSheetReply}
        onDelete={handleActionSheetDelete}
        onReport={handleActionSheetReport}
      />

      {reportTarget && (
        <ReportCommentModal
          visible={!!reportTarget}
          onClose={() => setReportTarget(null)}
          commentId={reportTarget.id}
          commentOwnerId={reportTarget.ownerId}
          currentUserId={userId}
          onReportSuccess={() => setReportTarget(null)}
        />
      )}
    </View>
  );
}

export default React.forwardRef(InlineComments);
