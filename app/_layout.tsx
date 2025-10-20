// app/_layout.tsx

import CustomFlashMessage from "@/components/CustomFlashMessage";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import FlashMessage from "react-native-flash-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

// 1. import your Dzongkhag provider
import { DzongkhagProvider } from "@/contexts/DzongkhagContext";
import { UserProvider } from "@/contexts/UserContext";
import { VideoPlaybackProvider } from "@/contexts/VideoPlaybackContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    "Montserrat-Regular": require("../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-Light": require("../assets/fonts/Montserrat-Light.ttf"),
    "Montserrat-Medium": require("../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-SemiBold": require("../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-Bold": require("../assets/fonts/Montserrat-Bold.ttf"),
    "Montserrat-ExtraBold": require("../assets/fonts/Montserrat-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      (Text as any).defaultProps = (Text as any).defaultProps || {};
      (Text as any).defaultProps.style = [
        { fontFamily: "Montserrat-Regular" },
        ...(Array.isArray((Text as any).defaultProps.style)
          ? (Text as any).defaultProps.style
          : [(Text as any).defaultProps.style]),
      ];
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        {/* 2. wrap your entire app in the provider */}
        <UserProvider>
          <DzongkhagProvider>
            <VideoPlaybackProvider>
              <View className="flex-1 bg-background">
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style="dark" />
                <FlashMessage
                  position="top"
                  renderCustomContent={(msg) => (
                    <CustomFlashMessage message={msg} />
                  )}
                />
              </View>
            </VideoPlaybackProvider>
          </DzongkhagProvider>
        </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
