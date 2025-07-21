import { Text, View } from "react-native";
import type { Message } from "react-native-flash-message";

type Props = {
  message: Message;
};

export default function CustomFlashMessage({ message }: Props) {
  return (
    <View className="bg-primary px-4 py-3 mx-4 rounded-xl shadow-lg">
      <Text className="text-secondary font-mbold text-base">
        {message.message}
      </Text>

      {message.description && (
        <Text className="text-white font-regular text-sm mt-1">
          {message.description}
        </Text>
      )}
    </View>
  );
}
