import CircularLoader from '@/components/ui/CircularLoader';
import ProgressiveImage from '@/components/ui/ProgressiveImage';
import { getUserBookmarks } from '@/lib/bookmarkService';
import { Ionicons } from '@expo/vector-icons';
import { useAppRouter } from '@/utils/navigation';
import { ArrowLeft, Bookmark, FileText, Play, ShoppingBag, Store } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface SavedPostsProps {
  onClose?: () => void;
  userId?: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - 48 - 8) / 3;

type Tab = 'posts' | 'products' | 'marketplace';

function isVideo(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.m4v') ||
    lower.includes('post-videos')
  );
}

type PostData = {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  profiles?: { name?: string; avatar_url?: string | null } | null;
};

type ProductData = {
  id: string;
  user_id: string;
  name: string;
  price: number;
  images: string[];
  is_discount_active?: boolean;
  discount_percent?: number;
};

type MarketplaceData = {
  id: string;
  user_id: string;
  title: string;
  price: number;
  images: string[];
  type: string;
};

type Bookmark = {
  id: string;
  created_at: string;
  post_id: string | null;
  product_id: string | null;
  marketplace_id: string | null;
  posts: PostData | null;
  products: ProductData | null;
  marketplace: MarketplaceData | null;
};

const MARKETPLACE_TYPE_LABELS: Record<string, string> = {
  rent: 'Rent',
  swap: 'Swap',
  second_hand: '2nd Hand',
  free: 'Free',
  job_vacancy: 'Job',
};

export default function SavedPosts({ onClose, userId }: SavedPostsProps) {
  const router = useAppRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (!isRefresh) setLoading(true);
    const data = await getUserBookmarks(userId);
    setBookmarks(data as unknown as Bookmark[]);
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const savedPosts = bookmarks.filter((b) => b.posts != null);
  const savedProducts = bookmarks.filter((b) => b.products != null);
  const savedMarketplace = bookmarks.filter((b) => b.marketplace != null);

  const displayPrice = (item: ProductData) => {
    if (item.is_discount_active && item.discount_percent) {
      const discounted = item.price * (1 - item.discount_percent / 100);
      return `Nu. ${Math.round(discounted).toLocaleString()}`;
    }
    return `Nu. ${item.price.toLocaleString()}`;
  };

  const renderPostTile = ({ item }: { item: Bookmark }) => {
    const post = item.posts;
    if (!post) return null;

    const firstMedia = post.images?.[0];
    const hasVideo = firstMedia && isVideo(firstMedia);
    const hasImage = firstMedia && !hasVideo;
    const hasMultiple = post.images?.length > 1;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(users)/post/${post.id}` as any)}
        activeOpacity={0.82}
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          margin: 2,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
        }}
      >
        {hasImage || hasVideo ? (
          <>
            <ProgressiveImage
              uri={firstMedia as string}
              style={{ width: '100%', height: '100%' }}
              showProgress={false}
              recyclingKey={post.id}
              backgroundColor="#f3f4f6"
            />
            {hasVideo && (
              <View style={{
                position: 'absolute', top: 5, left: 5,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 4, padding: 3,
              }}>
                <Play size={10} color="#fff" fill="#fff" />
              </View>
            )}
            {hasMultiple && !hasVideo && (
              <View style={{
                position: 'absolute', top: 5, right: 5,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 4, padding: 3,
              }}>
                <Ionicons name="copy-outline" size={10} color="#fff" />
              </View>
            )}
          </>
        ) : (
          <View style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            padding: 6, backgroundColor: '#e8f0fe',
          }}>
            <FileText size={18} color="#94a3b8" />
            <Text
              numberOfLines={3}
              style={{ fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'center' }}
            >
              {post.content}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderProductTile = ({ item }: { item: Bookmark }) => {
    const product = item.products;
    if (!product) return null;
    const firstImage = product.images?.[0];

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(users)/product/${product.id}` as any)}
        activeOpacity={0.82}
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          margin: 2,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
        }}
      >
        {firstImage ? (
          <>
            <ProgressiveImage
              uri={firstImage}
              style={{ width: '100%', height: '100%' }}
              showProgress={false}
              recyclingKey={product.id}
              backgroundColor="#f3f4f6"
            />
            {/* Price badge */}
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,0,0,0.52)',
              paddingHorizontal: 5, paddingVertical: 3,
            }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                {displayPrice(product)}
              </Text>
            </View>
            {product.images.length > 1 && (
              <View style={{
                position: 'absolute', top: 5, right: 5,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 4, padding: 3,
              }}>
                <Ionicons name="copy-outline" size={10} color="#fff" />
              </View>
            )}
          </>
        ) : (
          <View style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            padding: 6, backgroundColor: '#fef3c7',
          }}>
            <ShoppingBag size={18} color="#d97706" />
            <Text
              numberOfLines={2}
              style={{ fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'center' }}
            >
              {product.name}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMarketplaceTile = ({ item }: { item: Bookmark }) => {
    const listing = item.marketplace;
    if (!listing) return null;
    const firstImage = listing.images?.[0];
    const typeLabel = MARKETPLACE_TYPE_LABELS[listing.type] ?? listing.type;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(users)/marketplace/${listing.id}` as any)}
        activeOpacity={0.82}
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          margin: 2,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
        }}
      >
        {firstImage ? (
          <>
            <ProgressiveImage
              uri={firstImage}
              style={{ width: '100%', height: '100%' }}
              showProgress={false}
              recyclingKey={listing.id}
              backgroundColor="#f3f4f6"
            />
            {/* Type badge */}
            <View style={{
              position: 'absolute', top: 5, left: 5,
              backgroundColor: '#094569cc',
              borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
            }}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                {typeLabel}
              </Text>
            </View>
            {/* Price */}
            {listing.price > 0 && (
              <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: 'rgba(0,0,0,0.52)',
                paddingHorizontal: 5, paddingVertical: 3,
              }}>
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                  Nu. {listing.price.toLocaleString()}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            padding: 6, backgroundColor: '#ede9fe',
          }}>
            <Store size={18} color="#7c3aed" />
            <Text
              numberOfLines={2}
              style={{ fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'center' }}
            >
              {listing.title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const activeData =
    activeTab === 'posts' ? savedPosts :
    activeTab === 'products' ? savedProducts :
    savedMarketplace;

  const activeRender =
    activeTab === 'posts' ? renderPostTile :
    activeTab === 'products' ? renderProductTile :
    renderMarketplaceTile;

  const emptyIcon =
    activeTab === 'posts' ? <Bookmark size={56} color="#d1d5db" /> :
    activeTab === 'products' ? <ShoppingBag size={56} color="#d1d5db" /> :
    <Store size={56} color="#d1d5db" />;

  const emptyMessage =
    activeTab === 'posts' ? 'No saved posts yet' :
    activeTab === 'products' ? 'No saved products yet' :
    'No saved listings yet';

  const emptyHint =
    activeTab === 'posts' ? 'Tap the bookmark icon on any post to save it here' :
    activeTab === 'products' ? 'Tap the bookmark icon on any product to save it here' :
    'Tap the bookmark icon on any marketplace listing to save it here';

  const totalCount = bookmarks.length;

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'posts', label: 'Posts', count: savedPosts.length },
    { key: 'products', label: 'Products', count: savedProducts.length },
    { key: 'marketplace', label: 'Marketplace', count: savedMarketplace.length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
      }}>
        <TouchableOpacity onPress={onClose} style={{ marginRight: 12, padding: 2 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#111', flex: 1 }}>
          Saved
        </Text>
        {!loading && (
          <Text style={{ fontSize: 13, color: '#9ca3af' }}>
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? '#094569' : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: activeTab === tab.key ? '700' : '500',
              color: activeTab === tab.key ? '#094569' : '#6b7280',
            }}>
              {tab.label}
              {tab.count > 0 ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : activeData.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          {emptyIcon}
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#6b7280', marginTop: 16 }}>
            {emptyMessage}
          </Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
            {emptyHint}
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={(item) => item.id}
          renderItem={activeRender as any}
          numColumns={3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#094569" />
          }
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ marginBottom: 0 }}
        />
      )}
    </View>
  );
}

