import React, { useMemo, useRef, useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, RefreshControl, Modal } from "react-native";
import { Plus, Radio } from "lucide-react-native";
import FeedPost from "@/components/FeedPost";
import CreatePost from "@/components/CreatePost";
import LiveScreen from "@/components/Live";
import { posts, PostData } from "@/data/postdata";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "expo-router";
import { feedEvents } from "@/utils/feedEvents";

// Wrapper component for Live with onClose prop
function LiveWrapper({ onClose }: { onClose: () => void }) {
  return <LiveScreen onClose={onClose} />;
}

export default function FeedScreen() {
  const { currentUser } = useUser();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showLive, setShowLive] = useState(false);

  // Listen for double-tap events from the feed tab button
  useEffect(() => {
    const handleScrollToTop = () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      // Also trigger refresh
      onRefresh();
    };

    feedEvents.on('scrollToTop', handleScrollToTop);

    return () => {
      feedEvents.off('scrollToTop', handleScrollToTop);
    };
  }, []);

  // Handle pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
      console.log('Feed refreshed!');
    }, 1000);
  };

  // Sort posts by date in descending order (latest first)
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, []);

  const renderPost = ({ item }: { item: PostData }) => {
    return <FeedPost post={item} />;
  };

  const renderHeader = () => (
    <View className="bg-white border-b border-gray-200 p-4">
      {/* Action Buttons */}
      <View className="flex-row">
        <TouchableOpacity 
          className="flex-1 flex-row items-center justify-center py-3"
          onPress={() => setShowCreatePost(true)}
        >
          <Plus size={20} color="#1877F2" strokeWidth={1.5} />
          <Text className="ml-2 text-gray-700 font-medium">Create Post</Text>
        </TouchableOpacity>
        
        <View className="w-px bg-gray-200 mx-2" />
        
        <TouchableOpacity 
          className="flex-1 flex-row items-center justify-center py-3"
          onPress={() => setShowLive(true)}
        >
          <Radio size={20} color="#DC2626" strokeWidth={1.5} />
          <Text className="ml-2 text-gray-700 font-medium">Go Live</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />
        
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-semibold text-gray-700 mb-2">
            Welcome to Feed
          </Text>
          <Text className="text-base text-gray-500 text-center">
            Please log in to see your personalized feed
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />
      
      
      {/* Feed Content */}
      <FlatList
        ref={flatListRef}
        data={sortedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1877F2"
            colors={["#1877F2"]}
          />
        }
      />

      {/* Create Post Modal */}
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View className="flex-1 bg-white">
          <CreatePost onClose={() => setShowCreatePost(false)} />
        </View>
      </Modal>

      {/* Live Modal */}
      <Modal
        visible={showLive}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowLive(false)}
      >
        <LiveWrapper onClose={() => setShowLive(false)} />
      </Modal>
    </View>
  );
}