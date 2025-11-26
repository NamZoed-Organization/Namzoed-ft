// app/index.tsx
import { useUser } from "@/contexts/UserContext";
import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { currentUser, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (currentUser) {
    return <Redirect href="/(users)" />;
  } else {
    return <Redirect href="/login" />;
  }
}
