// app/_layout.tsx
import { enableScreens } from "react-native-screens";
enableScreens(true);

import "@/utils/silenceLogs";
import CustomFlashMessage from "@/components/CustomFlashMessage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InAppChatBanner from "@/components/chat/InAppChatBanner";
import InAppNotificationBanner from "@/components/notifications/InAppNotificationBanner";
import OneSignalBootstrap from "@/components/notifications/OneSignalBootstrap";
import { UnreadMessagesProvider } from "@/contexts/UnreadMessagesContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import FlashMessage from "react-native-flash-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

// 1. import your Dzongkhag provider
import { AppearanceProvider } from "@/contexts/AppearanceContext";
import { DzongkhagProvider } from "@/contexts/DzongkhagContext";
import { LiveSessionProvider } from "@/contexts/LiveSessionProvider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { UserProvider } from "@/contexts/UserContext";
import { VideoCacheProvider } from "@/contexts/VideoCacheContext";
import { VideoPlaybackProvider } from "@/contexts/VideoPlaybackContext";

// Keep the splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const fontMap = {
    // Load icon fonts directly from assets/fonts/ — node_modules requires fail in release builds
    "ionicons": require("../assets/fonts/ionicons.ttf"),
    "material": require("../assets/fonts/material.ttf"),
    "entypo": require("../assets/fonts/entypo.ttf"),
    "feather": require("../assets/fonts/feather.ttf"),
    // FontAwesome5Free uses "FontAwesome5Free-Regular/Solid/Brand" as family names
    "FontAwesome5Free-Regular": require("../assets/fonts/FontAwesome5_Regular.ttf"),
    "FontAwesome5Free-Solid": require("../assets/fonts/FontAwesome5_Solid.ttf"),
    "FontAwesome5Free-Brand": require("../assets/fonts/FontAwesome5_Brands.ttf"),
    "Montserrat-Regular": require("../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-Light": require("../assets/fonts/Montserrat-Light.ttf"),
    "Montserrat-Medium": require("../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-SemiBold": require("../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-Bold": require("../assets/fonts/Montserrat-Bold.ttf"),
    "Montserrat-ExtraBold": require("../assets/fonts/Montserrat-ExtraBold.ttf"),
  };

  const [fontsLoaded, fontError] = useFonts(fontMap);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Light app shell behind edge-to-edge status bar when the OS draws a light strip.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#f8f9fa");
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          {/* 2. wrap your entire app in the provider */}
          <UserProvider>
            <AppearanceProvider>
            <UnreadMessagesProvider>
              <NotificationsProvider>
              <DzongkhagProvider>
                <VideoPlaybackProvider>
                  <VideoCacheProvider>
                    <LiveSessionProvider>
                      <OneSignalBootstrap />
                    <View className="flex-1 bg-background">
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            // Keep native-stack swipe navigation enabled globally.
                            gestureEnabled: true,
                            fullScreenGestureEnabled: true,
                            gestureDirection: "horizontal",
                            animation: "none",
                          }}
                        />
                        <InAppChatBanner />
                        <InAppNotificationBanner />
                        {/* Android: many devices paint a dark status bar under edge-to-edge; `dark` here
                            means dark *icons* (RN dark-content) → invisible on black. Use `light` =
                            light-content (white icons). iOS: follow system appearance. */}
                        <StatusBar
                          style={
                            Platform.OS === "android"
                              ? "light"
                              : colorScheme === "dark"
                                ? "light"
                                : "dark"
                          }
                        />
                        <FlashMessage
                          position="top"
                          renderCustomContent={(msg) => (
                            <CustomFlashMessage message={msg} />
                          )}
                        />
                      </View>
                    </LiveSessionProvider>
                  </VideoCacheProvider>
                </VideoPlaybackProvider>
              </DzongkhagProvider>
              </NotificationsProvider>
            </UnreadMessagesProvider>
            </AppearanceProvider>
          </UserProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
