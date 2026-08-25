import { useUser } from '@/contexts/UserContext';
import { isFollowing } from '@/lib/followService';
import { getPostLikes } from '@/lib/likesService';
import { useAppRouter } from '@/utils/navigation';
import { X } from 'lucide-react-native';
import CircularLoader from '@/components/ui/CircularLoader';
import React, { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import {
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import BottomSheetModal from './BottomSheetModal';

interface LikeUser {
  id: string;
  name: string;
  avatar_url?: string | null;
  isFollowing?: boolean;
}

interface LikesListModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
}

export default function LikesListModal({
  visible,
  onClose,
  postId,
}: LikesListModalProps) {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLikes = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const likes = await getPostLikes(postId);
      const mapped: LikeUser[] = likes.map((like: any) => ({
        id: like.profiles?.id || like.user_id,
        name: like.profiles?.name || like.profiles?.email?.split('@')[0] || 'User',
        avatar_url: like.profiles?.avatar_url || null,
      }));

      // Check follow status for each user
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
      console.error('Error loading likes:', error);
      setUsers([]);
    }
    setLoading(false);
  }, [postId, currentUser?.id]);

  useEffect(() => {
    if (visible && postId) {
      loadLikes();
    }
  }, [visible, postId, loadLikes]);

  const handleUserPress = (userId: string) => {
    onClose();
    router.push(`/(users)/profile/${userId}` as any);
  };

  const renderUser = ({ item }: { item: LikeUser }) => {
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>Likes</Text>
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
              <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No likes yet</Text>
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
