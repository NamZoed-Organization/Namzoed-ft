// app/_layout.tsx

import CustomFlashMessage from "@/components/CustomFlashMessage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InAppChatBanner from "@/components/chat/InAppChatBanner";
import InAppNotificationBanner from "@/components/notifications/InAppNotificationBanner";
import OneSignalBootstrap from "@/components/notifications/OneSignalBootstrap";
import { UnreadMessagesProvider } from "@/contexts/UnreadMessagesContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import "@/utils/silenceLogs";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { setVideoCacheSizeAsync } from "expo-video";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform, StatusBar, View } from "react-native";
import FlashMessage from "react-native-flash-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

// 1. import your Dzongkhag provider
import { AppearanceProvider } from "@/contexts/AppearanceContext";
import { SafetyProvider } from "@/contexts/SafetyContext";
import { DzongkhagProvider } from "@/contexts/DzongkhagContext";
import { LiveSessionProvider } from "@/contexts/LiveSessionProvider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { UserProvider } from "@/contexts/UserContext";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { VideoCacheProvider } from "@/contexts/VideoCacheContext";
import { VideoPlaybackProvider } from "@/contexts/VideoPlaybackContext";

// Keep the splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const lastHandledUrlRef = useRef<string | null>(null);
  const shouldMountOneSignalBootstrap = !(__DEV__ && Platform.OS === "android");

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

  // Bound the persistent on-disk video cache (default is 1GB). Used by players
  // created with `{ uri, useCaching: true }` so reels/feed clips aren't re-downloaded.
  useEffect(() => {
    setVideoCacheSizeAsync(512 * 1024 * 1024).catch(() => {});
  }, []);

  useEffect(() => {
    const resolveDestination = (
      rawUrl: string,
      depth = 0,
    ):
      | string
      | {
          pathname: string;
          params: Record<string, string>;
        }
      | null => {
      if (!rawUrl || depth > 2) return null;

      try {
        const parsed = new URL(rawUrl);
        const query = Object.fromEntries(parsed.searchParams.entries());

        if (query.deep_link) {
          return resolveDestination(decodeURIComponent(query.deep_link), depth + 1);
        }

        const pathParts = parsed.pathname.split("/").filter(Boolean);
        const isCustomScheme = parsed.protocol === "namzoed:";
        const segments = isCustomScheme
          ? parsed.host
            ? [parsed.host, ...pathParts]
            : pathParts
          : pathParts;

        if (segments.length < 2) return null;

        const [resource, id] = segments;
        if (!id) return null;

        switch (resource.toLowerCase()) {
          case "post":
            return `/(users)/post/${id}`;
          case "product":
            return `/(users)/product/${id}`;
          case "marketplace":
            return `/(users)/marketplace/${id}`;
          case "service":
          case "servicedetail":
            return `/(users)/servicedetail/${id}`;
          case "profile":
            return `/(users)/profile/${id}`;
          case "chat": {
            const params: Record<string, string> = { id };
            if (query.context_product_id) params.context_product_id = query.context_product_id;
            if (query.context_product_title) params.context_product_title = query.context_product_title;
            if (query.context_product_price) params.context_product_price = query.context_product_price;
            if (query.context_product_image) params.context_product_image = query.context_product_image;
            if (query.context_source) params.context_source = query.context_source;
            return {
              pathname: "/(users)/chat/[id]",
              params,
            };
          }
          default:
            return null;
        }
      } catch {
        return null;
      }
    };

    const handleIncomingUrl = (url: string | null) => {
      if (!url) return;
      if (lastHandledUrlRef.current === url) return;

      const destination = resolveDestination(url);
      if (!destination) return;

      lastHandledUrlRef.current = url;
      router.replace(destination as any);
    };

    Linking.getInitialURL().then((url) => {
      handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, [router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider
          value={
            Platform.OS === "android"
              ? DefaultTheme
              : colorScheme === "dark"
                ? DarkTheme
                : DefaultTheme
          }
        >
          {/* 2. wrap your entire app in the provider */}
          <UserProvider>
            <NetworkProvider>
            <AppearanceProvider>
            <SafetyProvider>
            <UnreadMessagesProvider>
              <NotificationsProvider>
              <DzongkhagProvider>
                <VideoPlaybackProvider>
                  <VideoCacheProvider>
                    <LiveSessionProvider>
                      {shouldMountOneSignalBootstrap ? <OneSignalBootstrap /> : null}
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
                        {/* Transparent status bar with dark icons on Android;
                            iOS continues to follow the current appearance. */}
                        <StatusBar
                          barStyle={
                            Platform.OS === "android"
                              ? "dark-content"
                              : colorScheme === "dark"
                                ? "light-content"
                                : "dark-content"
                          }
                          translucent={Platform.OS === "android"}
                          backgroundColor="transparent"
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
            </SafetyProvider>
            </AppearanceProvider>
            </NetworkProvider>
          </UserProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
