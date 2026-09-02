import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { isFollowing } from '@/lib/followService';
import { getPostViewers } from '@/lib/viewTrackingService';
import { useAppRouter } from '@/utils/navigation';
import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import {
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import BottomSheetModal from './BottomSheetModal';

interface ViewerUser {
  id: string;
  name: string;
  avatar_url?: string | null;
  isFollowing?: boolean;
}

interface PostViewersModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
}

/**
 * Post owner only — "who viewed this post" (mirrors LikesListModal's shape).
 * The underlying getPostViewers() query is RLS-restricted to the post owner,
 * so this naturally returns an empty list for anyone else even if opened.
 */
export default function PostViewersModal({
  visible,
  onClose,
  postId,
}: PostViewersModalProps) {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const [users, setUsers] = useState<ViewerUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadViewers = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const viewers = await getPostViewers(postId);
      const mapped: ViewerUser[] = viewers.map((v: any) => ({
        id: v.profiles?.id || v.viewer_id,
        name: v.profiles?.name || v.profiles?.email?.split('@')[0] || 'User',
        avatar_url: v.profiles?.avatar_url || null,
      }));

      if (currentUser?.id) {
        const withFollowStatus = await Promise.all(
          mapped.map(async (u) => {
            if (u.id === currentUser.id) return { ...u, isFollowing: false };
            try {
              const following = await isFollowing(currentUser.id!, u.id);
              return { ...u, isFollowing: following };
            } catch {
              return { ...u, isFollowing: false };
            }
          })
        );
        setUsers(withFollowStatus);
      } else {
        setUsers(mapped);
      }
    } catch (error) {
      console.error('Error loading viewers:', error);
      setUsers([]);
    }
    setLoading(false);
  }, [postId, currentUser?.id]);

  useEffect(() => {
    if (visible && postId) {
      loadViewers();
    }
  }, [visible, postId, loadViewers]);

  const handleUserPress = (userId: string) => {
    onClose();
    router.push(`/(users)/profile/${userId}` as any);
  };

  const renderUser = ({ item }: { item: ViewerUser }) => {
    const isSelf = item.id === currentUser?.id;
    return (
      <TouchableOpacity
        onPress={() => handleUserPress(item.id)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
        activeOpacity={0.7}
      >
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB' }}
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderCurve: "continuous",
              backgroundColor: '#094569',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>
            {item.name}
          </Text>
          {item.isFollowing && (
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
              Following
            </Text>
          )}
        </View>
        {!isSelf && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 8,
              borderCurve: "continuous",
              backgroundColor: item.isFollowing ? '#F3F4F6' : '#094569',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: item.isFollowing ? '#374151' : '#fff',
              }}
            >
              {item.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {(close) => (
        <>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F3F4F6',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>Viewers</Text>
            <TouchableOpacity onPress={close}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <CircularLoader size="small" color="#094569" />
            </View>
          ) : users.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No views yet</Text>
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </BottomSheetModal>
  );
}
