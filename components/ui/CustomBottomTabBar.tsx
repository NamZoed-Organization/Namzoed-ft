import { HomeIcon, ShoppingIcon } from "@/components/icons/index";
import { useRouter } from "expo-router";
import { Plus, Store, Wrench } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVE = "#094569";
const INACTIVE = "#9ca3af";

// Same formula as MongooseWorkerNavBar — full insets.bottom with platform minimum.
// Use this in any screen that needs to pad content above this bar.
export function getTabBarBottomPad(insetsBottom: number): number {
  return Platform.OS === "android"
    ? Math.max(insetsBottom, 8)
    : Math.max(insetsBottom, 6);
}

interface CustomBottomTabBarProps {
  activeRoute?: string;
  onHeightChange?: (height: number) => void;
}

export default function CustomBottomTabBar({ activeRoute, onHeightChange }: CustomBottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bottomPad = getTabBarBottomPad(insets.bottom);

  const isActive = (route: string) => activeRoute === route;

  return (
    <View
      style={[styles.container, { paddingBottom: bottomPad, paddingTop: 5 }]}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      {/* Home */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push("/(users)/(tabs)/index" as any)}
        activeOpacity={0.7}
      >
        <HomeIcon focused={isActive("home")} size={24} />
      </TouchableOpacity>

      {/* Categories */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push("/(users)/(tabs)/categories")}
        activeOpacity={0.7}
      >
        <ShoppingIcon focused={isActive("categories")} size={24} />
      </TouchableOpacity>

      {/* Feed — FAB style */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push("/(users)/(tabs)/feed")}
        activeOpacity={0.7}
      >
        <View style={styles.fab}>
          <Plus size={24} color={isActive("feed") ? ACTIVE : INACTIVE} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      {/* Marketplace */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push("/(users)/(tabs)/marketplace")}
        activeOpacity={0.7}
      >
        <Store size={24} color={isActive("marketplace") ? ACTIVE : INACTIVE} strokeWidth={1.75} />
      </TouchableOpacity>

      {/* Services */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push("/(users)/(tabs)/services")}
        activeOpacity={0.7}
      >
        <Wrench size={24} color={isActive("services") ? ACTIVE : INACTIVE} strokeWidth={1.75} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    elevation: Platform.OS === "android" ? 8 : 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 49,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
});
