// app/index.tsx
import { useUser } from "@/contexts/UserContext";
import { isMongooseUser } from "@/utils/roleCheck";
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

  if (currentUser && isMongooseUser(currentUser.email)) {
    return <Redirect href="/mongoose-dashboard" />;
  }

  // Guests and normal users — browse via main tabs; login prompts as needed.
  return <Redirect href="/(users)/(tabs)" />;
}
