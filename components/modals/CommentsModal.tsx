import { useUser } from '@/contexts/UserContext';
import {
    addPostComment,
    addReply,
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
import { Ionicons } from '@expo/vector-icons';
import { ChevronDown, ChevronUp, CornerDownRight, Crown, Send, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    Modal,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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
const AMBER = '#f59e0b';

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
      <Crown size={9} color="#fff" />
      <Text style={styles.creatorBadgeText}>Creator</Text>
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
  const inputRef = useRef<TextInput>(null);

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
    if (!text.trim() || !userId || posting) return;
    setPosting(true);

    if (replyTarget) {
      const reply = await addReply(
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
      const comment = await addPostComment(postId, userId, text);
      if (comment) {
        void playSound('comment');
        setComments((prev) => [...prev, comment]);
        onCommentCountChange?.(comments.length + 1);
      }
    }
    setText('');
    setPosting(false);
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
            <Text style={styles.timeText}>{fmt(reply.created_at)}</Text>
          </View>
          <Text style={styles.bodyText}>{reply.text}</Text>
          <View style={styles.actionsRow}>
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
            {reply.creator_liked && <CreatorBadge />}
          </View>
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
              <Text style={styles.timeText}>{fmt(item.created_at)}</Text>
            </View>
            <Text style={styles.bodyText}>{item.text}</Text>

            {/* actions row */}
            <View style={styles.actionsRow}>
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

              {item.creator_liked && <CreatorBadge />}

              {/* reply button */}
              <TouchableOpacity
                onPress={() => handleReplyTap(item)}
                style={styles.replyActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.replyActionText}>Reply</Text>
              </TouchableOpacity>

              {/* expand replies */}
              {item.reply_count > 0 && (
                <TouchableOpacity
                  onPress={() => handleToggleReplies(item.id)}
                  style={styles.replyActionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isLoadingR ? (
                    <ActivityIndicator size="small" color={PRIMARY} style={{ marginLeft: 4 }} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {isExpanded
                        ? <ChevronUp size={12} color={PRIMARY} />
                        : <ChevronDown size={12} color={PRIMARY} />}
                      <Text style={[styles.replyActionText, { color: PRIMARY }]}>
                        {item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
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

          {/* list — description (headerContent) shows first, then comments */}
          <FlatList
            data={loading ? [] : comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={headerContent ? <>{headerContent}</> : null}
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first to comment</Text>
                </View>
              )
            }
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

          {/* input bar – paddingBottom uses real safe-area inset so it works
              for iOS home indicator, Android gesture nav, and button nav */}
          <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 12 : (insets.bottom > 0 ? insets.bottom : 12) }]}>
            <Avatar
              user={{
                id: userId,
                name: currentUser?.name ?? 'U',
                avatar_url: currentUser?.avatar_url,
              }}
              size={32}
            />
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
              disabled={!text.trim() || posting}
              style={{ opacity: text.trim() && !posting ? 1 : 0.35 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {posting ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Send size={20} color={PRIMARY} />
              )}
            </TouchableOpacity>
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
  commentWrapper: { borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  commentRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 13, fontWeight: '600', color: '#111' },
  timeText: { fontSize: 11, color: '#9CA3AF', marginLeft: 6 },
  bodyText: { fontSize: 14, color: '#374151', marginTop: 2, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeCount: { fontSize: 12, color: '#9CA3AF' },
  replyActionBtn: { flexDirection: 'row', alignItems: 'center' },
  replyActionText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  creatorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: AMBER,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  creatorBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  repliesContainer: { paddingLeft: 12, paddingBottom: 6 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, paddingRight: 14 },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  replyBannerText: { fontSize: 12, color: '#6B7280' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  input: {
    flex: 1, marginHorizontal: 10,
    fontSize: 14, color: '#111',
    maxHeight: 80, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#F9FAFB', borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
});
