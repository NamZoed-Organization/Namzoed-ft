// app/_layout.tsx

import AppUpdateGate from "@/components/AppUpdateGate";
import WhatsNewGate from "@/components/WhatsNewGate";
import CustomFlashMessage from "@/components/CustomFlashMessage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InAppChatBanner from "@/components/chat/InAppChatBanner";
import InAppNotificationBanner from "@/components/notifications/InAppNotificationBanner";
import OneSignalBootstrap from "@/components/notifications/OneSignalBootstrap";
import NavHandoffOverlay from "@/components/ui/NavHandoffOverlay";
import { UnreadMessagesProvider } from "@/contexts/UnreadMessagesContext";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
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
import { pruneQueryCache } from "@/lib/queryCache";
import { applyStorageLimits } from "@/lib/storageManager";
import { pruneMediaCache } from "@/lib/setlogMediaCache";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { InteractionManager, Platform, StatusBar, View } from "react-native";
import FlashMessage from "react-native-flash-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

// 1. import your Dzongkhag provider
import { AppearanceProvider } from "@/contexts/AppearanceContext";
import { SafetyProvider } from "@/contexts/SafetyContext";
import { DzongkhagProvider } from "@/contexts/DzongkhagContext";
import { LiveSessionProvider } from "@/contexts/LiveSessionProvider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ProfilePreviewProvider } from "@/contexts/ProfilePreviewContext";
import { ProductPeekProvider } from "@/contexts/ProductPeekContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
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
  const appUpdate = useAppUpdateCheck();

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

  // Bound both media caches to whatever Settings › Storage says, defaults
  // included. The video one was already capped here; the *image* cache was
  // not capped at all — expo-image defaults to unlimited, which in a mostly
  // -pictures app means it grows until iOS decides the phone is full, and iOS
  // only trims caches under real pressure. Re-applied every launch because
  // `Image.configureCache` configures this process, not the device
  // (lib/storageManager.ts).
  useEffect(() => {
    applyStorageLimits().catch(() => {});
  }, []);

  // Housekeeping for the query cache: drop anything a week old, then evict
  // back under budget. Once, at startup, off the interaction thread —
  // AsyncStorage on Android is one SQLite table with a ~6MB ceiling, and a
  // cache that only grows starts losing writes silently long before anyone
  // notices (lib/queryCache.ts).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      pruneQueryCache().catch(() => {});
      // The same sweep for the clips the export editors download — that
      // folder is disposable by design, so anything a week old goes.
      pruneMediaCache().catch(() => {});
    });
    return () => task.cancel();
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
          // A Namzoed QR code (namzoed://add/<namzoed_id>). `id` here is a
          // namzoed_id, not a UUID, so it can't route straight to a
          // profile — Add Friends resolves it and asks for the same
          // confirmation the scanner does.
          case "add":
            return {
              pathname: "/(users)/add-friends",
              params: { connect: id },
            };
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
                    {/* Only coordinates one-open-at-a-time; the preview itself
                        expands inside each avatar, not here. */}
                    <ProfilePreviewProvider>
                    {/* The tours are taught on the real screens, so the
                        engine has to sit above the navigator and outside
                        every screen — see components/tutorial/. */}
                    <TutorialProvider>
                    {/* A tagged product previews in one sheet wherever the
                        tag is — see contexts/ProductPeekContext.tsx. */}
                    <ProductPeekProvider>
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
                        {/* The wait between a push and the screen it
                            pushes to — see utils/navHandoff.ts. Above the
                            Stack and outside every screen, because the one
                            that starts the wait is usually gone before it
                            ends. */}
                        <NavHandoffOverlay />
                        {/* Above the screens, below the banners: a tip must
                            not cover a message arriving. */}
                        <TutorialOverlay />
                        <InAppChatBanner />
                        <InAppNotificationBanner />
                        <AppUpdateGate
                          status={appUpdate.status}
                          message={appUpdate.message}
                        />
                        <WhatsNewGate updateStatus={appUpdate.status} />
                        {/* Transparent status bar with dark icons on both
                            platforms — the app has no real dark-mode theme,
                            so tab screens are always light-background and
                            need dark icons regardless of OS appearance. */}
                        <StatusBar
                          barStyle="dark-content"
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
                    </ProductPeekProvider>
                    </TutorialProvider>
                    </ProfilePreviewProvider>
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
