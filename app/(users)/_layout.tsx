import { Stack } from "expo-router";
import React from "react";

export default function UsersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: "horizontal",
        animation: "none",
        freezeOnBlur: true,
      }}
      {...({ detachInactiveScreens: true } as any)}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
