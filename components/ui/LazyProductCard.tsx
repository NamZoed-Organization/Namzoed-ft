import React, { memo, useState, useRef, useEffect } from "react";
import { View, Text, Animated, TouchableOpacity, Image } from "react-native";
import { Product } from "@/data/products";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import CountdownTimer from "../CountdownTimer";

interface LazyProductCardProps {
  product: Product;
  index: number;
  isVisible: boolean;
  estimatedHeight?: number;
}

// Skeleton component for product cards
const ProductSkeleton = memo(({ height }: { height: number }) => {
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerOpacity]);

  return (
    <View
      style={{ height }}
      className="rounded-lg bg-white overflow-hidden shadow-sm max-w-[48%] mb-4"
    >
      <Animated.View
        className="w-full h-36 bg-gray-200"
        style={{ opacity: shimmerOpacity }}
      />
      <View className="p-2">
        <Animated.View
          className="bg-gray-200 h-4 w-full rounded mb-2"
          style={{ opacity: shimmerOpacity }}
        />
        <Animated.View
          className="bg-gray-200 h-3 w-3/4 rounded mb-2"
          style={{ opacity: shimmerOpacity }}
        />
        <Animated.View
          className="bg-gray-200 h-4 w-1/2 rounded mb-1"
          style={{ opacity: shimmerOpacity }}
        />
        <Animated.View
          className="bg-gray-200 h-8 w-full rounded mt-2"
          style={{ opacity: shimmerOpacity }}
        />
      </View>
    </View>
  );
});

// Lazy-loaded product card
const LazyProductCard = memo(({
  product,
  index,
  isVisible,
  estimatedHeight = 200
}: LazyProductCardProps) => {
  const [hasRendered, setHasRendered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Only render full component when visible or has been rendered before
  if (!isVisible && !hasRendered) {
    return <ProductSkeleton height={estimatedHeight} />;
  }

  // Mark as rendered once visible
  if (isVisible && !hasRendered) {
    setHasRendered(true);
  }


  const handleMessagePress = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    // Handle message functionality
    console.log(`Message seller for product: ${product.name}`);
  };

  return (
    <Link
      href={{ pathname: "/product/[id]", params: { id: product.id } }}
      asChild
    >
      <TouchableOpacity
        className="rounded-lg bg-white overflow-hidden shadow-sm max-w-[48%] mb-4"
        activeOpacity={0.7}
      >
        <View className="w-full h-36 bg-gray-200 relative">
          {!imageLoaded && (
            <View className="absolute inset-0 bg-gray-200 items-center justify-center">
              <Ionicons name="image-outline" size={28} color="#999" />
            </View>
          )}
          <Image
            source={product.image}
            className="w-full h-full"
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
        </View>

        <View className="p-3">
          <Text
            className="text-base font-semibold text-gray-800 mb-1"
            numberOfLines={1}
          >
            {product.name}
          </Text>

          <Text className="text-sm text-gray-500 mb-3" numberOfLines={2}>
            {product.description}
          </Text>

          <View className="flex-row items-center justify-between mb-4">
            {/* Price with Discount Support */}
            {(product as any).is_currently_active ? (
              <View className="gap-1 flex-1">
                {/* Original price struck */}
                <Text className="text-xs text-gray-400 line-through">
                  Nu. {product.price}
                </Text>

                {/* Discounted price, badge, and timer */}
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-base font-bold text-black">
                    Nu. {(product as any).current_price?.toLocaleString()}
                  </Text>

                  {/* Discount badge */}
                  <View className="bg-red-500 px-1.5 py-0.5 rounded">
                    <Text className="text-white text-[10px] font-bold">
                      -{(product as any).discount_percent}%
                    </Text>
                  </View>

                  {/* Countdown (compact) */}
                  <CountdownTimer endsAt={(product as any).discount_ends_at} compact={true} />
                </View>
              </View>
            ) : (
              <Text className="text-lg font-bold text-black">
                Nu. {product.price}
              </Text>
            )}

            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text className="text-sm text-gray-500">{product.dzongkhag}</Text>
            </View>
          </View>

          <TouchableOpacity
            className="bg-blue-50 border border-blue-200 rounded-lg py-3 px-4 flex-row items-center justify-center"
            onPress={handleMessagePress}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#2563eb" />
            <Text className="text-blue-600 font-semibold text-sm ml-2">
              Message Seller
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Link>
  );
});

LazyProductCard.displayName = 'LazyProductCard';
ProductSkeleton.displayName = 'ProductSkeleton';

export default LazyProductCard;