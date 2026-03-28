import { TaggedAccount, TaggedProduct } from '@/types/post';
import { useAppRouter } from '@/utils/navigation';
import { ShoppingBag, User, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Image,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface TaggedItemsModalProps {
  visible: boolean;
  onClose: () => void;
  products?: TaggedProduct[];
  accounts?: TaggedAccount[];
}

export default function TaggedItemsModal({
  visible,
  onClose,
  products = [],
  accounts = [],
}: TaggedItemsModalProps) {
  const router = useAppRouter();
  const hasProducts = products.length > 0;
  const hasAccounts = accounts.length > 0;
  const hasBoth = hasProducts && hasAccounts;
  const [activeTab, setActiveTab] = useState<'products' | 'accounts'>(
    hasProducts ? 'products' : 'accounts'
  );

  const handleProductPress = (productId: string) => {
    onClose();
    router.push(`/(users)/product/${productId}` as any);
  };

  const handleAccountPress = (accountId: string) => {
    onClose();
    router.push(`/(users)/profile/${accountId}` as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: 'white',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 40,
          maxHeight: '60%',
        }}
      >
        {/* Handle */}
        <View
          style={{
            width: 40,
            height: 4,
            backgroundColor: '#D1D5DB',
            borderRadius: 2,
            alignSelf: 'center',
            marginTop: 12,
            marginBottom: 12,
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>
            Tagged in this Post
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Tabs (only if both products and accounts) */}
        {hasBoth && (
          <View
            style={{
              flexDirection: 'row',
              marginHorizontal: 16,
              marginBottom: 16,
              backgroundColor: '#F3F4F6',
              borderRadius: 10,
              padding: 3,
            }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab('products')}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: activeTab === 'products' ? '#fff' : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ShoppingBag size={14} color={activeTab === 'products' ? '#094569' : '#9CA3AF'} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 13,
                    fontWeight: '600',
                    color: activeTab === 'products' ? '#094569' : '#9CA3AF',
                  }}
                >
                  Products ({products.length})
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('accounts')}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: activeTab === 'accounts' ? '#fff' : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <User size={14} color={activeTab === 'accounts' ? '#094569' : '#9CA3AF'} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 13,
                    fontWeight: '600',
                    color: activeTab === 'accounts' ? '#094569' : '#9CA3AF',
                  }}
                >
                  People ({accounts.length})
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={{ paddingHorizontal: 16 }}>
          {/* Products Tab */}
          {(activeTab === 'products' || !hasBoth) && hasProducts && (
            <>
              {!hasBoth && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <ShoppingBag size={16} color="#094569" />
                  <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#374151' }}>
                    Products ({products.length})
                  </Text>
                </View>
              )}
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => handleProductPress(product.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 16,
                    marginBottom: 8,
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  {product.image ? (
                    <Image
                      source={{ uri: product.image }}
                      style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#E5E7EB' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        backgroundColor: '#F3F4F6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShoppingBag size={20} color="#D1D5DB" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#094569', marginTop: 2 }}>
                      Nu. {(product.current_price ?? product.price).toLocaleString()}
                    </Text>
                    {product.is_currently_active && product.discount_percent ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' }}>
                          Nu. {product.price.toLocaleString()}
                        </Text>
                        <View
                          style={{
                            marginLeft: 6,
                            backgroundColor: '#FEE2E2',
                            borderRadius: 4,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#EF4444' }}>
                            -{product.discount_percent}%
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>View →</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Accounts Tab */}
          {(activeTab === 'accounts' || !hasBoth) && hasAccounts && (
            <>
              {!hasBoth && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <User size={16} color="#094569" />
                  <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#374151' }}>
                    People ({accounts.length})
                  </Text>
                </View>
              )}
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => handleAccountPress(account.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 16,
                    marginBottom: 8,
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  {account.avatar_url ? (
                    <Image
                      source={{ uri: account.avatar_url }}
                      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB' }}
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
                        {account.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>
                      {account.name}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>View →</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
