import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function forgot() {
  return (
    <View className="flex-1 justify-center items-center">
      <View className="flex-row justify-between items-center ">
        <View>
          <Text className="text-4xl text-primary/90 font-mbold">Forgot</Text>
          <Text className="text-4xl text-secondary/90 font-mbold">Password?</Text>
        </View>
        <Image
          source={require("../assets/images/logo.png")}
          className="w-28 h-28"
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({});
