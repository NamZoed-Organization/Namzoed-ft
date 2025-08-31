import { useUser } from "@/contexts/UserContext";
import {
  Filter,
  Heart,
  MapPin,
  Search,
  ShoppingBag,
  Star
} from "lucide-react-native";
import React from "react";
import {
  FlatList,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// Sample marketplace data
const featuredItems = [
  {
    id: '1',
    title: 'Traditional Bhutanese Gho',
    price: 2500,
    location: 'Thimphu',
    rating: 4.8,
    reviews: 24,
    image: require('@/assets/images/all.png'),
    seller: 'Karma Tshering'
  },
  {
    id: '2',
    title: 'Handwoven Kira Set',
    price: 3200,
    location: 'Paro',
    rating: 4.9,
    reviews: 31,
    image: require('@/assets/images/all.png'),
    seller: 'Pema Lhamo'
  },
  {
    id: '3',
    title: 'Yak Wool Blanket',
    price: 1800,
    location: 'Bumthang',
    rating: 4.7,
    reviews: 18,
    image: require('@/assets/images/all.png'),
    seller: 'Sonam Dorji'
  },
  {
    id: '4',
    title: 'Bamboo Handicrafts',
    price: 650,
    location: 'Samtse',
    rating: 4.6,
    reviews: 12,
    image: require('@/assets/images/all.png'),
    seller: 'Deki Choden'
  }
];

const categories = [
  { name: 'Fashion', icon: '', count: 234 },
  { name: 'Electronics', icon: '', count: 156 },
  { name: 'Home & Living', icon: '', count: 189 },
  { name: 'Beauty', icon: '', count: 98 },
  { name: 'Food', icon: '', count: 145 },
  { name: 'Books', icon: '', count: 76 }
];

export default function MarketplaceScreen() {
  const { currentUser } = useUser();

  const renderFeaturedItem = ({ item }: { item: typeof featuredItems[0] }) => (
    <TouchableOpacity className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3 overflow-hidden">
      <Image 
        source={item.image}
        className="w-full h-48"
        resizeMode="cover"
      />
      <View className="p-4">
        <Text className="text-lg font-semibold text-gray-900 mb-1">
          {item.title}
        </Text>
        <Text className="text-xl font-bold text-primary mb-2">
          BTN {item.price.toLocaleString()}
        </Text>
        
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <MapPin size={14} color="#666" />
            <Text className="text-sm text-gray-600 ml-1">{item.location}</Text>
          </View>
          <View className="flex-row items-center">
            <Star size={14} color="#FFA500" fill="#FFA500" />
            <Text className="text-sm text-gray-600 ml-1">
              {item.rating} ({item.reviews})
            </Text>
          </View>
        </View>
        
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-500">
            by {item.seller}
          </Text>
          <TouchableOpacity className="p-1">
            <Heart size={20} color="#666" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategory = (category: typeof categories[0], index: number) => (
    <TouchableOpacity 
      key={index}
      className="bg-white rounded-lg p-4 mr-3 items-center shadow-sm border border-gray-200"
      style={{ width: 100 }}
    >
      <Text className="text-2xl mb-2">{category.icon}</Text>
      <Text className="text-sm font-medium text-gray-900 text-center mb-1">
        {category.name}
      </Text>
      <Text className="text-xs text-gray-500">
        {category.count} items
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />
      
      {/* Header */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-bold text-gray-900">Marketplace</Text>
          <View className="flex-row items-center space-x-3">
            <TouchableOpacity className="p-2">
              <Search size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity className="p-2">
              <Filter size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Quick Stats */}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600">
            {featuredItems.length * 50}+ items available
          </Text>
          <TouchableOpacity className="flex-row items-center bg-primary px-3 py-1 rounded-full">
            <ShoppingBag size={16} color="white" />
            <Text className="text-white text-sm font-medium ml-1">Sell Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <View className="py-4">
          <Text className="text-lg font-semibold text-gray-900 px-4 mb-3">
            Categories
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {categories.map(renderCategory)}
          </ScrollView>
        </View>

        {/* Featured Items */}
        <View className="px-4 pb-24">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Featured Items
          </Text>
          <FlatList
            data={featuredItems}
            renderItem={renderFeaturedItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ScrollView>
    </View>
  );
}