import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { X, Package, ShoppingBag, Edit, Trash2, Eye } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { fetchUserProducts, Product } from '@/lib/productsService';
import { fetchUserMarketplaceItems, MarketplaceItem } from '@/lib/postMarketPlace';
import ImageWithFallback from '@/components/ui/ImageWithFallback';

interface ManageListingsOverlayProps {
  onClose: () => void;
  userId: string;
}

export default function ManageListingsOverlay({ onClose, userId }: ManageListingsOverlayProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'products' | 'marketplace'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, marketplaceData] = await Promise.all([
        fetchUserProducts(userId),
        fetchUserMarketplaceItems(userId)
      ]);
      setProducts(productsData);
      setMarketplaceItems(marketplaceData);
    } catch (error) {
      console.error('Error loading listings:', error);
      Alert.alert('Error', 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProduct = (id: string) => {
    onClose();
    router.push(`/(users)/product/${id}` as any);
  };

  const handleViewMarketplace = (id: string) => {
    onClose();
    router.push(`/marketplace/${id}` as any);
  };

  const handleEditProduct = (id: string) => {
    // TODO: Implement edit functionality
    Alert.alert('Edit', 'Edit functionality coming soon!');
  };

  const handleEditMarketplace = (id: string) => {
    // TODO: Implement edit functionality
    Alert.alert('Edit', 'Edit functionality coming soon!');
  };

  const handleDeleteProduct = (id: string) => {
    // TODO: Implement delete functionality
    Alert.alert('Delete', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        // Delete logic here
        Alert.alert('Delete', 'Delete functionality coming soon!');
      }}
    ]);
  };

  const handleDeleteMarketplace = (id: string) => {
    // TODO: Implement delete functionality
    Alert.alert('Delete', 'Are you sure you want to delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        // Delete logic here
        Alert.alert('Delete', 'Delete functionality coming soon!');
      }}
    ]);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
        <View>
          <Text className="text-2xl font-bold text-gray-900">My Listings</Text>
          <Text className="text-sm text-gray-600 mt-1">
            {products.length} products • {marketplaceItems.length} marketplace items
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
          <X size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row border-b border-gray-200 px-4">
        <TouchableOpacity
          onPress={() => setActiveTab('products')}
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === 'products' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <View className="flex-row items-center gap-2">
            <Package size={20} color={activeTab === 'products' ? '#094569' : '#666'} />
            <Text className={`font-semibold ${
              activeTab === 'products' ? 'text-primary' : 'text-gray-600'
            }`}>
              Products ({products.length})
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('marketplace')}
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === 'marketplace' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <View className="flex-row items-center gap-2">
            <ShoppingBag size={20} color={activeTab === 'marketplace' ? '#094569' : '#666'} />
            <Text className={`font-semibold ${
              activeTab === 'marketplace' ? 'text-primary' : 'text-gray-600'
            }`}>
              Marketplace ({marketplaceItems.length})
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#094569" />
          <Text className="text-sm text-gray-600 mt-2">Loading listings...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {activeTab === 'products' ? (
            products.length === 0 ? (
              <View className="items-center justify-center py-20">
                <Package size={48} color="#ccc" />
                <Text className="text-gray-500 text-base mt-4">No products yet</Text>
                <Text className="text-gray-400 text-sm mt-2">Start adding products to see them here</Text>
              </View>
            ) : (
              <View className="py-4 gap-4">
                {products.map((product) => (
                  <View key={product.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <View className="flex-row">
                      {/* Image */}
                      <ImageWithFallback
                        source={{ uri: product.images?.[0] || '' }}
                        className="w-24 h-24"
                        resizeMode="cover"
                      />

                      {/* Content */}
                      <View className="flex-1 p-3">
                        <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>
                          {product.description}
                        </Text>
                        <Text className="text-lg font-bold text-primary mt-2">
                          Nu. {product.price.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row border-t border-gray-200">
                      <TouchableOpacity
                        onPress={() => handleViewProduct(product.id)}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2 border-r border-gray-200"
                      >
                        <Eye size={16} color="#666" />
                        <Text className="text-sm text-gray-700 font-medium">View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleEditProduct(product.id)}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2 border-r border-gray-200"
                      >
                        <Edit size={16} color="#666" />
                        <Text className="text-sm text-gray-700 font-medium">Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteProduct(product.id)}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2"
                      >
                        <Trash2 size={16} color="#ef4444" />
                        <Text className="text-sm text-red-500 font-medium">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : (
            marketplaceItems.length === 0 ? (
              <View className="items-center justify-center py-20">
                <ShoppingBag size={48} color="#ccc" />
                <Text className="text-gray-500 text-base mt-4">No marketplace listings yet</Text>
                <Text className="text-gray-400 text-sm mt-2">Start listing items to see them here</Text>
              </View>
            ) : (
              <View className="py-4 gap-4">
                {marketplaceItems.map((item) => (
                  <View key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <View className="flex-row">
                      {/* Image */}
                      <ImageWithFallback
                        source={{ uri: item.images?.[0] || '' }}
                        className="w-24 h-24"
                        resizeMode="cover"
                      />

                      {/* Content */}
                      <View className="flex-1 p-3">
                        <View className="flex-row items-center gap-2 mb-1">
                          <View className="bg-primary/10 px-2 py-1 rounded">
                            <Text className="text-primary text-xs font-semibold uppercase">
                              {item.type}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>
                          {item.description}
                        </Text>
                        {(item.type === 'rent' || item.type === 'secondhand') && item.price > 0 && (
                          <Text className="text-lg font-bold text-primary mt-2">
                            Nu. {item.price.toLocaleString()}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row border-t border-gray-200">
                      <TouchableOpacity
                        onPress={() => handleViewMarketplace(item.id)}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2 border-r border-gray-200"
                      >
                        <Eye size={16} color="#666" />
                        <Text className="text-sm text-gray-700 font-medium">View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleEditMarketplace(item.id)}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2 border-r border-gray-200"
                      >
                        <Edit size={16} color="#666" />
                        <Text className="text-sm text-gray-700 font-medium">Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteMarketplace(item.id)}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2"
                      >
                        <Trash2 size={16} color="#ef4444" />
                        <Text className="text-sm text-red-500 font-medium">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}
          <View className="h-20" />
        </ScrollView>
      )}
    </View>
  );
}
