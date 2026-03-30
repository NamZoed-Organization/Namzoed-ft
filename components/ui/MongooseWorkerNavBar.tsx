import { useUser } from "@/contexts/UserContext";
import { isMongooseUser } from "@/utils/roleCheck";
import { useAppRouter } from "@/utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Extra space to reserve above the bar (bar row only; safe area added inside). */
export const MONGOOSE_WORKER_NAV_BAR_HEIGHT = 52;

function navFocus(pathname: string) {
  const dashboard = pathname.includes("mongoose-dashboard");
  const chats =
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/chat/");
  const ownProfile = pathname === "/profile";
  return { dashboard, chats, ownProfile };
}

/**
 * Bottom navigation for Mongoose (driver) accounts: dashboard, messages, own profile.
 * Renders nothing for non-mongoose users.
 */
export default function MongooseWorkerNavBar() {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!isMongooseUser(currentUser?.email)) {
    return null;
  }

  const { dashboard, chats, ownProfile } = navFocus(pathname);
  const padBottom =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 8)
      : Math.max(insets.bottom, 6);

  const item = (
    key: string,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    active: boolean,
    href: string,
  ) => (
    <Pressable
      key={key}
      onPress={() => router.push(href as any)}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? "#094569" : "#9ca3af"}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: active ? "700" : "500",
          color: active ? "#094569" : "#9ca3af",
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#ede9e2",
        paddingBottom: padBottom,
        paddingTop: 6,
        elevation: Platform.OS === "android" ? 10 : 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
        shadowRadius: 6,
      }}
    >
      <View style={{ flexDirection: "row", minHeight: MONGOOSE_WORKER_NAV_BAR_HEIGHT - 6 }}>
        {item("dash", "Dashboard", "grid-outline", dashboard, "/mongoose-dashboard")}
        {item("chats", "Chats", "chatbubbles-outline", chats, "/messages")}
        {item("profile", "Profile", "person-circle-outline", ownProfile, "/profile")}
      </View>
    </View>
  );
}
