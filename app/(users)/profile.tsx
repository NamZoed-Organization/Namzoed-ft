import { Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background  px-4">
      <Text className="text-2xl font-mbold text-primary mb-2">Home</Text>
      <Text className="text-base font-regular text-gray-500 text-center">
        Welcome to NamZoed. This is the home screen placeholder.
      </Text>
    </View>
  );
}
