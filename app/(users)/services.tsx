// Path: app/(tabs)/services.tsx

import TopNavbar from "@/components/ui/TopNavbar";
import { serviceCategories } from "@/data/servicecategory";
import { router } from "expo-router";
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  Car,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Palette,
  Plane,
  Shield,
  Sparkles,
  Wrench
} from "lucide-react-native";
import React, { useMemo } from "react";
import { Dimensions, FlatList, Image, Text, TouchableOpacity, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ServiceScreen() {
  // Calculate responsive columns and sizes
  const { numColumns, itemSize, gap } = useMemo(() => {
    const padding = 32; // 16px on each side
    const availableWidth = SCREEN_WIDTH - padding;

    let cols = 3; // Default for medium screens
    let gapSize = 16;

    if (SCREEN_WIDTH < 360) {
      cols = 2;
      gapSize = 12;
    } else if (SCREEN_WIDTH >= 768) {
      cols = 4;
      gapSize = 20;
    }

    const totalGapSpace = gapSize * (cols - 1);
    const size = (availableWidth - totalGapSpace) / cols;

    return {
      numColumns: cols,
      itemSize: Math.floor(size),
      gap: gapSize
    };
  }, []);

  const handleCategoryPress = (category: any) => {
    router.push(`/(users)/servicedetail/${category.slug}`);
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'taxi': Car,
      'home': Home,
      'hotel': Building2,
      'spa': Sparkles,
      'tools': Wrench,
      'graduation-cap': GraduationCap,
      'palette': Palette,
      'briefcase': Briefcase,
      'map-pin': MapPin,
      'heart': Heart,
      'activity': Activity,
      'calendar': Calendar,
      'shield': Shield,
      'plane': Plane,
    };

    const IconComponent = iconMap[iconName] || Home;
    return <IconComponent size={Math.min(48, itemSize * 0.5)} color="black" />;
  };

  const renderCategoryItem = ({ item, index }: { item: any, index: number }) => {
    const columnIndex = index % numColumns;
    const isFirstInRow = columnIndex === 0;
    const hasLocalImage = typeof item.image === 'number';

    return (
      <TouchableOpacity
        className="bg-white rounded-xl shadow-sm border border-gray-100 items-center justify-center"
        style={{
          width: itemSize,
          height: itemSize,
          marginLeft: isFirstInRow ? 0 : gap,
          marginBottom: gap
        }}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.7}
      >
        <View className="items-center justify-center mb-2">
          {hasLocalImage ? (
            <Image
              source={item.image}
              style={{
                width: Math.min(56, itemSize * 0.55),
                height: Math.min(56, itemSize * 0.55)
              }}
              resizeMode="contain"
            />
          ) : (
            getIconComponent(item.icon)
          )}
        </View>
        <Text
          className="text-xs font-medium text-gray-900 text-center px-1"
          numberOfLines={2}
          style={{ fontSize: Math.max(10, itemSize * 0.11) }}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-mbold text-primary mb-2">
            Services
          </Text>
          <Text className="text-base font-regular text-gray-500">
            Choose from our wide range of professional services
          </Text>
        </View>

        {/* Service Categories Grid */}
        <FlatList
          data={serviceCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 120,
            paddingTop: 20,
            paddingHorizontal: 16
          }}
          columnWrapperStyle={{
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            flexDirection: 'row'
          }}
          key={numColumns} // Force re-render when columns change
        />
      </View>
    </View>
  );
}
