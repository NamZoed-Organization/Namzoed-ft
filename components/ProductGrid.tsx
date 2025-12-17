// components/ProductGrid.tsx
import { ProductWithUser } from '@/lib/productsService';
import React from 'react';
import { Text, View } from 'react-native';
import ProductCard from './ProductCard';
import ProductCardSkeleton from './ProductCardSkeleton';

interface Props {
  products: ProductWithUser[];
  loading?: boolean;
  skeletonCount?: number;
}

export default function ProductGrid({ products, loading = false, skeletonCount = 6 }: Props) {
  if (loading) {
    const skeletons = Array.from({ length: skeletonCount }, (_, i) => i);
    return (
      <View className="flex-row flex-wrap">
        {skeletons.map((_, index) => (
          <View key={index} style={{ width: '50%' }}>
            <ProductCardSkeleton isLeftColumn={index % 2 === 0} />
          </View>
        ))}
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View className="py-20 items-center">
        <Text className="text-gray-400">No products found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap">
      {products.map((product, index) => (
        <View key={product.id} style={{ width: '50%' }}>
          <ProductCard product={product} isLeftColumn={index % 2 === 0} />
        </View>
      ))}
    </View>
  );
}