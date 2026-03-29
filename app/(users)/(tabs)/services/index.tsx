import AddServicesModal from "@/components/modals/AddServicesModal";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { serviceCategories } from "@/data/servicecategory";
import { useAppRouter } from "@/utils/navigation";
import { Href } from "expo-router";
import {
    BedDouble,
    Briefcase,
    Building,
    Car,
    Coffee,
    Gamepad2,
    Goal,
    GraduationCap,
    Grid3x3,
    Home,
    Landmark,
    Package,
    Palette,
    PawPrint,
    Plane,
    Plus,
    ShoppingBasket,
    Sparkles,
    Tent,
    Utensils,
    Wrench,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
    Dimensions,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export default function ServiceScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { numColumns, itemSize, gap } = useMemo(() => {
    const horizontalPadding = 32;
    let cols = SCREEN_WIDTH < 340 ? 2 : 3;
    if (SCREEN_WIDTH > 768) cols = 4;

    const gapSize = 12;
    const availableWidth = SCREEN_WIDTH - horizontalPadding;
    const totalGapSpace = gapSize * (cols - 1);
    const size = (availableWidth - totalGapSpace) / cols;

    return {
      numColumns: cols,
      itemSize: Math.floor(size),
      gap: gapSize,
    };
  }, []);

  const visibleCategories = useMemo(() => serviceCategories, []);

  const handleCategoryPress = (category: any) => {
    router.push(`/services/${category.slug}` as Href);
  };

  const handleGamesPress = () => {
    router.push(`/services/ground-bookings/ground-booking` as Href);
  };

  const handleHotelsPress = () => {
    router.push(`/services/room-booking/room-booking` as Href);
  };

  const getIconComponent = (iconName: string, size: number, color: string) => {
    const iconMap: Record<string, any> = {
      car: Car,
      utensils: Utensils,
      coffee: Coffee,
      building: Building,
      tent: Tent,
      "shopping-basket": ShoppingBasket,
      gamepad: Gamepad2,
      ground: Goal,
      room: BedDouble,
      "paw-print": PawPrint,
      home: Home,
      package: Package,
      briefcase: Briefcase,
      "graduation-cap": GraduationCap,
      palette: Palette,
      sparkles: Sparkles,
      wrench: Wrench,
      plane: Plane,
      grid: Grid3x3,
      landmark: Landmark,
    };
    const IconComponent = iconMap[iconName] || Home;
    return <IconComponent size={size} color={color} />;
  };

  const renderCategoryItem = ({ item }: { item: any }) => {
    const iconSize = itemSize * 0.3;

    return (
      <View
        style={{
          width: itemSize,
          marginBottom: gap,
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          style={{
            width: itemSize * 0.7,
            height: itemSize * 0.7,
            backgroundColor: "#094569",
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
          onPress={() => handleCategoryPress(item)}
          activeOpacity={0.7}
        >
          {getIconComponent(item.icon, iconSize, "#FFFFFF")}
        </TouchableOpacity>

        <Text
          style={{
            fontSize: Math.max(9, itemSize * 0.1),
            fontWeight: "800",
            color: "#000000",
            textAlign: "center",
            paddingHorizontal: 4,
          }}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <View className="flex-1 px-4 pt-4">
        <View className="mb-6 ml-1">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-3xl font-mbold text-primary">Services</Text>

            {currentUser && (
              <TouchableOpacity
                onPress={() => setShowAddModal(true)}
                className="bg-primary px-4 py-2.5 rounded-full flex-row items-center shadow-sm"
                activeOpacity={0.7}
              >
                <Plus size={18} color="white" />
                <Text className="text-white font-msemibold text-sm ml-1">
                  Add Service
                </Text>
              </TouchableOpacity>
            )}
            {!currentUser && (
              <TouchableOpacity
                onPress={() => setShowAuthModal(true)}
                className="bg-primary px-4 py-2.5 rounded-full flex-row items-center shadow-sm"
                activeOpacity={0.7}
              >
                <Plus size={18} color="white" />
                <Text className="text-white font-msemibold text-sm ml-1">
                  Add Service
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text className="text-sm font-regular text-gray-500">
            Professional help at your fingertips
          </Text>
        </View>

        <FlatList
          data={visibleCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={numColumns}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
              <View style={{ marginBottom: 20 }}>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleGamesPress}
                    activeOpacity={0.8}
                    className="flex-1 rounded-2xl px-3 py-2.5 border border-primary bg-transparent"
                  >
                    <View className="flex-row items-center">
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor: "transparent",
                          borderWidth: 1.5,
                          borderColor: "#094569",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}
                      >
                        {getIconComponent("ground", 22, "#094569")}
                      </View>

                      <Text className="text-black text-base font-msemibold flex-1">
                        Ground Bookings
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleHotelsPress}
                    activeOpacity={0.8}
                    className="flex-1 rounded-2xl px-3 py-2.5 border border-primary bg-transparent"
                  >
                    <View className="flex-row items-center">
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor: "transparent",
                          borderWidth: 1.5,
                          borderColor: "#094569",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}
                      >
                        {getIconComponent("room", 22, "#094569")}
                      </View>

                      <Text className="text-black text-base font-msemibold flex-1">
                        Room{"\n"}Booking
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 18,
                  }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: "#D1D5DB" }} />
                  <Text
                    style={{
                      marginHorizontal: 12,
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#6B7280",
                      letterSpacing: 0.5,
                    }}
                  >
                    ALL SERVICES
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#D1D5DB" }} />
                </View>
              </View>
          }
          contentContainerStyle={{
            paddingBottom: 72 + insets.bottom,
          }}
          columnWrapperStyle={{
            gap: gap,
            justifyContent: "flex-start",
          }}
        />
      </View>

      {currentUser?.id && (
        <AddServicesModal
          isVisible={showAddModal}
          onClose={() => setShowAddModal(false)}
          userId={currentUser.id}
          onSuccess={() => {
            setShowAddModal(false);
          }}
        />
      )}

      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Sign in to add a service listing"
      />
    </View>
  );
}

const { StyleSheet } = require("react-native");
