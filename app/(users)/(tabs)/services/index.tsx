import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { serviceCategories } from "@/data/servicecategory";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
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
    Search,
    ShoppingBasket,
    Sparkles,
    Tent,
    Utensils,
    Wrench,
} from "lucide-react-native";
import React, { useMemo } from "react";
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
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.SERVICES);
  const { onTabBarScroll } = useTabBarScroll();

  const { numColumns, itemSize, gap } = useMemo(() => {
    const horizontalPadding = 32;
    let cols = SCREEN_WIDTH < 340 ? 3 : 4;
    if (SCREEN_WIDTH > 768) cols = 5;

    const gapSize = 10;
    const availableWidth = SCREEN_WIDTH - horizontalPadding;
    const totalGapSpace = gapSize * (cols - 1);
    const size = (availableWidth - totalGapSpace) / cols;

    return {
      numColumns: cols,
      itemSize: Math.floor(size),
      gap: gapSize,
    };
  }, []);


  const BETA_USER = "77737314";
  const showBetaBookings =
    String(currentUser?.id ?? "") === BETA_USER ||
    String(currentUser?.phone_number ?? "").replace(/\D/g, "").endsWith(BETA_USER) ||
    String(currentUser?.phone ?? "").replace(/\D/g, "").endsWith(BETA_USER) ||
    String(currentUser?.username ?? "") === BETA_USER;

  const handleCategoryPress = (category: any) => {
    trackTap("service_card", "category_select", { category: category.slug });
    router.push(`/services/${category.slug}` as Href);
  };

  const handleGamesPress = () => {
    trackTap("service_card", "category_select", { category: "ground-bookings" });
    router.push(`/services/ground-bookings/ground-booking` as Href);
  };

  const handleHotelsPress = () => {
    trackTap("service_card", "category_select", { category: "room-booking" });
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
    const iconBox = Math.floor(itemSize * 0.75);
    const iconSize = Math.floor(itemSize * 0.32);

    return (
      <View
        style={{
          width: itemSize,
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          style={{
            width: iconBox,
            height: iconBox,
            backgroundColor: "#094569",
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 6,
          }}
          onPress={() => handleCategoryPress(item)}
          activeOpacity={0.7}
        >
          {getIconComponent(item.icon, iconSize, "#FFFFFF")}
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: "#111827",
            textAlign: "center",
            paddingHorizontal: 2,
            lineHeight: 13,
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

      <FlatList
        data={serviceCategories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={numColumns}
        showsVerticalScrollIndicator={false}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            {/* Compact title */}
            <View style={{ marginTop: 10, marginBottom: 10, paddingHorizontal: 2 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: "#094569",
                  letterSpacing: -0.3,
                }}
              >
                Services
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: "#6B7280",
                  marginTop: 1,
                }}
              >
                Professional help at your fingertips
              </Text>
            </View>

            {/* Compact search trigger */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(users)/services/search" as any)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F1F5F9",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: 14,
              }}
            >
              <Search size={14} color="#94A3B8" />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 12.5,
                  color: "#94A3B8",
                }}
              >
                Search services, providers...
              </Text>
            </TouchableOpacity>

            {/* Beta bookings - compact */}
            {showBetaBookings && (
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={handleGamesPress}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#094569",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      borderWidth: 1.2,
                      borderColor: "#094569",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                    }}
                  >
                    {getIconComponent("ground", 16, "#094569")}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: "#111827",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    Ground Bookings
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleHotelsPress}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#094569",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      borderWidth: 1.2,
                      borderColor: "#094569",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                    }}
                  >
                    {getIconComponent("room", 16, "#094569")}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: "#111827",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    Room Booking
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Section divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
              <Text
                style={{
                  marginHorizontal: 10,
                  fontSize: 10,
                  fontWeight: "700",
                  color: "#6B7280",
                  letterSpacing: 0.5,
                }}
              >
                ALL SERVICES
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
            </View>
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 72 + insets.bottom,
        }}
        columnWrapperStyle={{
          gap: gap,
          justifyContent: "flex-start",
        }}
      />

    </View>
  );
}
