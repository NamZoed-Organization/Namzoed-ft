import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { showMessage } from "react-native-flash-message";

export default function NotifCounter() {
  const [count, setCount] = useState(0);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleChange = (change: number) => {
    const newCount = count + change;
    setCount(newCount);

    // Clear previous timer
    if (timer) clearTimeout(timer);

    // Set new delay
    const newTimer = setTimeout(() => {
      showMessage({
        message: "Increased to 5",
        description: "This is your current count",
        type: "success",
      });
    }, 1000);

    setTimer(newTimer);
  };

  return (
    <View className="flex-1 items-center justify-center bg-white gap-10">
      <Text className="text-4xl font-mbold text-primary">Counter: {count}</Text>

      <View className="flex-row gap-6">
        <TouchableOpacity
          className="bg-green-600 px-6 py-3 rounded-2xl"
          onPress={() => handleChange(1)}
        >
          <Text className="text-white font-semibold text-lg">+1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-blue-600 px-6 py-3 rounded-2xl"
          onPress={() => handleChange(-1)}
        >
          <Text className="text-white font-semibold text-lg">-1</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
