import CommentMediaGallery from '@/components/comments/CommentMediaGallery';
import CommentMediaMessage from '@/components/comments/CommentMediaMessage';
import CommentMediaPicker, { PendingCommentMedia } from '@/components/comments/CommentMediaPicker';
import CommentVoiceRecorder from '@/components/comments/CommentVoiceRecorder';
import PendingMediaStrip, { PendingMediaItem } from '@/components/comments/PendingMediaStrip';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
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
} from '@/lib/commentsService';
import { playSound } from '@/lib/soundUtils';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CornerDownRight, Send, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    LayoutAnimation,
    Modal,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// Animates the pill growing/shrinking as media is added/removed — same
// spring feel as the pill's own open/close animations elsewhere in this file.
const animateMediaLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postOwnerId: string;
  onCommentCountChange?: (count: number) => void;
  /** Reels mode: no dimming backdrop so the (shrunken) video stays visible above. */
  embedded?: boolean;
  /** Fraction of screen height where the sheet top sits (embedded mode). */
  sheetTopRatio?: number;
  /** Rendered above the comment list — used to show the post description first. */
  headerContent?: React.ReactNode;
}

const PRIMARY = '#094569';

function fmt(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

function Avatar({ user, size = 36 }: { user?: PostComment['user']; size?: number }) {
  const radius = size / 2;
  if (user?.avatar_url) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#E5E7EB' }}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '700' }}>
        {(user?.name || 'U').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function CreatorBadge() {
  return (
    <View style={styles.creatorBadge}>
      <Text style={styles.creatorBadgeText}>Author liked</Text>
    </View>
  );
}

export default function CommentsModal({
  visible,
  onClose,
  postId,
  postOwnerId,
  onCommentCountChange,
  embedded = false,
  sheetTopRatio,
  headerContent,
}: CommentsModalProps) {
  const { currentUser } = useUser();
  const userId = currentUser?.id ?? '';

  const [comments, setComments]       = useState<PostComment[]>([]);
  const [replies, setReplies]         = useState<Record<string, CommentReply[]>>({});
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    commentOwnerId: string;
    name: string;
  } | null>(null);
  const [text, setText]     = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // 'voice' swaps the text input for CommentVoiceRecorder's hold-to-talk area —
  // mirrors chat's composerInputKind toggle.
  const [composerInputKind, setComposerInputKind] = useState<'text' | 'voice'>('text');
  const [isHoldRecording, setIsHoldRecording] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Measured height of the floating input pill — the backdrop behind it only
  // needs to reach up through half that height (same cutoff rule as the
  // post-detail bottom bar / chat composer).
  const [pillHeight, setPillHeight] = useState(52);
  // Images/videos picked for the comment currently being composed — staged
  // inline (see PendingMediaStrip) instead of in a separate modal, so the
  // keyboard/caption stay live the whole time. Uploads happen in the
  // background as soon as they're picked; sending just attaches whichever
  // have finished by the time the user taps send.
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);

  const SCREEN_H = Dimensions.get('window').height;
  const insets   = useSafeAreaInsets();
  const POS_70   = embedded
    ? SCREEN_H * (sheetTopRatio ?? 0.46)     // reels: leave the top for the video
    : SCREEN_H * 0.30;                        // top = 30% → sheet is 70% tall
  const POS_100  = insets.top + 8;            // just below Dynamic Island / status bar
  const POS_CLOSED = SCREEN_H;        // off-screen

  const sheetTop    = useRef(new Animated.Value(POS_CLOSED)).current;
  const keyboardPad = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const currentPos  = useRef(POS_70);
  const onCloseRef  = useRef(onClose);
  onCloseRef.current = onClose;

  // ── keyboard tracking ─────────────────────────────────────────────
  // On iOS: animate the sheet's `bottom` via keyboardPad so the input
  // sits above the keyboard. On Android with edgeToEdgeEnabled + adjustResize,
  // the window already resizes when the keyboard opens so we only track
  // keyboard visibility (to hide redundant bottom padding).
  useEffect(() => {
    if (!visible) {
      keyboardPad.setValue(0);
      setKeyboardVisible(false);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number }; duration: number }) => {
      setKeyboardVisible(true);
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardPad, {
          toValue: e.endCoordinates.height,
          duration: e.duration,
          useNativeDriver: false,
        }).start();
      }
    };
    const onHide = (e: { duration: number }) => {
      setKeyboardVisible(false);
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardPad, {
          toValue: 0,
          duration: e.duration,
          useNativeDriver: false,
        }).start();
      }
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, [visible, keyboardPad]);

  const snapTo = (toValue: number, cb?: () => void) => {
    Animated.spring(sheetTop, {
      toValue,
      useNativeDriver: false,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
    }).start(() => cb?.());
  };

  const animateIn = () => {
    sheetTop.setValue(POS_CLOSED);
    backdropAnim.setValue(0);
    currentPos.current = POS_70;
    Animated.parallel([
      Animated.spring(sheetTop, { toValue: POS_70, useNativeDriver: false, damping: 22, stiffness: 200, mass: 0.9 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
    ]).start();
  };

  const animateOut = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(sheetTop,     { toValue: POS_CLOSED, duration: 260, useNativeDriver: false }),
      Animated.timing(backdropAnim, { toValue: 0,          duration: 220, useNativeDriver: false }),
    ]).start(() => cb());
  };

  const handleClose = () => animateOut(() => onCloseRef.current());

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const next = currentPos.current + g.dy;
        sheetTop.setValue(Math.max(POS_100, next));
        // fade backdrop when dragging down from 70%
        if (currentPos.current >= POS_70 - 2 && g.dy > 0) {
          const opacity = Math.max(0, 1 - g.dy / (SCREEN_H * 0.5));
          backdropAnim.setValue(opacity);
        }
      },
      onPanResponderRelease: (_, g) => {
        const { dy, vy } = g;
        if (currentPos.current <= POS_100 + 2) {
          // currently full-screen: drag down snaps to 70%
          if (dy > 60 || vy > 0.4) {
            currentPos.current = POS_70;
            snapTo(POS_70);
            Animated.timing(backdropAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
          } else {
            snapTo(POS_100);
          }
        } else {
          // currently at 70%
          if (dy < -60 || vy < -0.4) {
            // drag up → full screen
            currentPos.current = POS_100;
            snapTo(POS_100);
            Animated.timing(backdropAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
          } else if (dy > 60 || vy > 0.4) {
            // drag down → close
            animateOut(() => onCloseRef.current());
          } else {
            // didn't move enough → snap back
            snapTo(POS_70);
            Animated.timing(backdropAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
          }
        }
      },
    })
  ).current;

  // ── load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!postId || !userId) return;
    setLoading(true);
    const data = await getPostComments(postId, userId, postOwnerId);
    setComments(data);
    setLoading(false);
  }, [postId, userId, postOwnerId]);

  useEffect(() => {
    if (visible && postId) {
      animateIn();
      load();
    }
    if (!visible) {
      setReplyTarget(null);
      setText('');
      setExpanded(new Set());
      setReplies({});
    }
  }, [visible, postId, load]);

  // ── post comment or reply ─────────────────────────────────────────
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
        void playSound('comment');
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
      }
      setReplyTarget(null);
    } else {
      const comment = hasMedia
        ? await addPostCommentWithGallery(postId, userId, text, media)
        : await addPostComment(postId, userId, text);
      if (comment) {
        void playSound('comment');
        setComments((prev) => [...prev, comment]);
        onCommentCountChange?.(comments.length + 1);
      }
    }
    setText('');
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
  };

  const handleMediaUploadSuccess = (
    item: PostComment | CommentReply,
    optimisticId: string,
    isReply: boolean,
  ) => {
    void playSound('comment');
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
    result: { url: string; type: 'image' | 'video'; duration?: number },
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

  // ── delete comment ────────────────────────────────────────────────
  const handleDeleteComment = async (commentId: string) => {
    const ok = await deletePostComment(commentId, userId);
    if (ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange?.(comments.length - 1);
    }
  };

  // ── delete reply ──────────────────────────────────────────────────
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

  // ── like comment (optimistic) ─────────────────────────────────────
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

  // ── like reply (optimistic) ───────────────────────────────────────
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

  // ── expand / collapse replies ─────────────────────────────────────
  const handleToggleReplies = async (commentId: string) => {
    if (expanded.has(commentId)) {
      setExpanded((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
      return;
    }
    setExpanded((prev) => new Set(prev).add(commentId));
    if (replies[commentId]) return; // already loaded

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    const data = await getRepliesForComment(commentId, userId, postOwnerId);
    setReplies((prev) => ({ ...prev, [commentId]: data }));
    setLoadingReplies((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
  };

  // ── tap Reply ─────────────────────────────────────────────────────
  const handleReplyTap = (comment: PostComment) => {
    setReplyTarget({
      commentId: comment.id,
      commentOwnerId: comment.user_id,
      name: comment.user?.name ?? 'User',
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── render reply row ──────────────────────────────────────────────
  const renderReply = (reply: CommentReply, commentId: string) => {
    const isOwn = reply.user_id === userId;
    return (
      <View key={reply.id} style={styles.replyRow}>
        <CornerDownRight size={14} color="#D1D5DB" style={{ marginTop: 10, marginRight: 6 }} />
        <Avatar user={reply.user} size={28} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>{reply.user?.name ?? 'Unknown'}</Text>
          </View>
          {!!reply.text && <Text style={styles.bodyText}>{reply.text}</Text>}
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
          <View style={styles.actionsRow}>
            <Text style={styles.timeText}>{fmt(reply.created_at)}</Text>
            <TouchableOpacity
              onPress={() => handleReplyLike(reply.id, commentId)}
              style={styles.likeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={reply.is_liked_by_me ? 'heart' : 'heart-outline'}
                size={13}
                color={reply.is_liked_by_me ? '#ef4444' : '#9CA3AF'}
              />
              {reply.like_count > 0 && (
                <Text style={[styles.likeCount, reply.is_liked_by_me && { color: '#ef4444' }]}>
                  {reply.like_count}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {reply.creator_liked && (
            <View style={{ marginTop: 6 }}>
              <CreatorBadge />
            </View>
          )}
        </View>
        {isOwn && (
          <TouchableOpacity
            onPress={() => handleDeleteReply(reply.id, commentId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
          >
            <Trash2 size={12} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── render comment row ────────────────────────────────────────────
  const renderComment = ({ item }: { item: PostComment }) => {
    const isOwn       = item.user_id === userId;
    const isExpanded  = expanded.has(item.id);
    const isLoadingR  = loadingReplies.has(item.id);
    const commentReplies = replies[item.id] ?? [];

    return (
      <View style={styles.commentWrapper}>
        <View style={styles.commentRow}>
          <Avatar user={item.user} size={36} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{item.user?.name ?? 'Unknown'}</Text>
            </View>
            {!!item.text && <Text style={styles.bodyText}>{item.text}</Text>}
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

            {/* actions row */}
            <View style={styles.actionsRow}>
              <Text style={styles.timeText}>{fmt(item.created_at)}</Text>

              {/* like */}
              <TouchableOpacity
                onPress={() => handleCommentLike(item.id)}
                style={styles.likeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={item.is_liked_by_me ? 'heart' : 'heart-outline'}
                  size={14}
                  color={item.is_liked_by_me ? '#ef4444' : '#9CA3AF'}
                />
                {item.like_count > 0 && (
                  <Text style={[styles.likeCount, item.is_liked_by_me && { color: '#ef4444' }]}>
                    {item.like_count}
                  </Text>
                )}
              </TouchableOpacity>

              {/* reply button */}
              <TouchableOpacity
                onPress={() => handleReplyTap(item)}
                style={styles.replyActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.replyActionText}>Reply</Text>
              </TouchableOpacity>
            </View>

            {item.creator_liked && (
              <View style={{ marginTop: 6 }}>
                <CreatorBadge />
              </View>
            )}

            {/* expand replies */}
            {item.reply_count > 0 && (
              <TouchableOpacity
                onPress={() => handleToggleReplies(item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={{ width: 24, height: 1, backgroundColor: '#D1D5DB' }} />
                {isLoadingR ? (
                  <CircularLoader size="small" color={PRIMARY} />
                ) : (
                  <Text style={styles.replyActionText}>
                    {isExpanded ? 'Hide replies' : `View ${item.reply_count} ${item.reply_count === 1 ? 'reply' : 'replies'}`}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {isOwn && (
            <TouchableOpacity
              onPress={() => handleDeleteComment(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 4 }}
            >
              <Trash2 size={13} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* replies list */}
        {isExpanded && (
          <View style={styles.repliesContainer}>
            {commentReplies.map((r) => renderReply(r, item.id))}
          </View>
        )}
      </View>
    );
  };

  const sendDisabled =
    (!text.trim() && pendingMedia.length === 0) || posting || pendingMedia.some((m) => m.uploading);

  // ── modal ─────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Animated backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: embedded ? 'transparent' : 'rgba(0,0,0,0.4)', opacity: embedded ? 1 : backdropAnim },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      {/* Bottom sheet – bottom is driven by keyboard offset so the input bar
          always sits right above the keyboard on both iOS and Android */}
      <Animated.View style={[styles.sheet, { top: sheetTop, bottom: keyboardPad }]}>
        {/* Draggable handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={{ flex: 1 }}>
          {/* header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* list — description (headerContent) shows first, then comments.
              Bottom padding clears the floating input pill (below), which
              overlays the list rather than pushing it up, so the last
              comment can still scroll fully into view above the pill. */}
          <FlatList
            data={loading ? [] : comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: pillHeight + (replyTarget ? 44 : 0) + (pendingMedia.length > 0 ? 66 : 0) + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={headerContent ? <>{headerContent}</> : null}
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <CircularLoader size="small" color={PRIMARY} />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first to comment</Text>
                </View>
              )
            }
          />

          {/* Floating input pill — overlays the list rather than sitting in
              normal flex flow below it, same rounded/blurred/clipped
              treatment (and half-pill backdrop cutoff) as the post-detail
              fixed bottom bar and the chat composer's own input pill. */}
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {/* Backdrop — reaches from the true bottom edge up through only
                the bottom HALF of the pill, so list content scrolling
                underneath fades away starting at the pill's midpoint rather
                than only right at its very top edge. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: (keyboardVisible ? 12 : (insets.bottom > 0 ? insets.bottom : 12)) + pillHeight / 2,
                backgroundColor: '#fff',
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
              }}
            />

            {/* reply-to banner */}
            {replyTarget && (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText}>
                  Replying to{' '}
                  <Text style={{ fontWeight: '700' }}>@{replyTarget.name}</Text>
                </Text>
                <TouchableOpacity onPress={() => setReplyTarget(null)}>
                  <X size={14} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}

            <View
              style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: keyboardVisible ? 12 : (insets.bottom > 0 ? insets.bottom : 12) }}
            >
              <View
                style={{ borderRadius: 26 }}
                onLayout={(e) => {
                  const measured = Math.round(e.nativeEvent.layout.height);
                  if (measured > 0 && Math.abs(measured - pillHeight) > 2) {
                    setPillHeight(measured);
                  }
                }}
              >
                {/* Background clipped separately from the content, so the
                    blur/tint's rounded corners stay crisp without also
                    clipping anything the content row might need to overflow. */}
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: 26,
                      overflow: 'hidden',
                      backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255,255,255,0.85)',
                    },
                  ]}
                >
                  {Platform.OS === 'ios' && (
                    <BlurView tint="systemChromeMaterial" intensity={50} style={StyleSheet.absoluteFill} />
                  )}
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(209,213,219,0.2)' }]} />
                </View>

                {/* Staged image/video attachments — the pill grows to fit
                    this row in place, no separate modal, keyboard stays up. */}
                <PendingMediaStrip items={pendingMedia} onRemove={removePendingMedia} />

                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
                  {composerInputKind === 'text' && (
                    <CommentMediaPicker
                      postId={postId}
                      replyTarget={replyTarget ? { commentId: replyTarget.commentId, commentOwnerId: replyTarget.commentOwnerId } : null}
                      existingCount={pendingMedia.length}
                      onPicked={handleMediaPicked}
                      onUploaded={handlePendingMediaUploaded}
                      onFailed={handlePendingMediaFailed}
                    />
                  )}

                  {isHoldRecording ? null : composerInputKind === 'text' ? (
                    <TouchableOpacity
                      onPress={() => setComposerInputKind('voice')}
                      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="mic-outline" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setComposerInputKind('text')}
                      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="keyboard" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  )}

                  {composerInputKind === 'voice' && !text.trim() ? (
                    <View style={{ flex: 1, minHeight: 38, justifyContent: 'center' }}>
                      <CommentVoiceRecorder
                        currentUser={{ id: userId, name: currentUser?.name ?? 'U', avatar_url: currentUser?.avatar_url }}
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
                        placeholder={replyTarget ? `Reply to ${replyTarget.name}…` : 'Add a comment…'}
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={500}
                        style={styles.input}
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
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    // bottom is set dynamically via keyboardPad Animated.Value
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 14, color: '#9CA3AF' },
  emptySubtitle: { fontSize: 12, color: '#D1D5DB', marginTop: 4 },
  commentWrapper: {},
  commentRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  timeText: { fontSize: 11, color: '#9CA3AF' },
  bodyText: { fontSize: 14, color: '#374151', marginTop: 2, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeCount: { fontSize: 12, color: '#9CA3AF' },
  replyActionBtn: { flexDirection: 'row', alignItems: 'center' },
  replyActionText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  creatorBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  creatorBadgeText: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  repliesContainer: { paddingLeft: 12, paddingBottom: 6 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, paddingRight: 14 },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  replyBannerText: { fontSize: 12, color: '#6B7280' },
  input: {
    flex: 1, marginHorizontal: 10,
    fontSize: 14, color: '#111',
    maxHeight: 80, paddingVertical: 8, paddingHorizontal: 4,
  },
  avatarFallback: {
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
});
