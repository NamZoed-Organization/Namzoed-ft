// components/DetectDzongkhag.tsx

import { useDzongkhag } from "@/contexts/DzongkhagContext";
import { MapPin } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function DetectDzongkhag() {
  const { name: dzongkhag, loading, accessDenied, refresh } = useDzongkhag();
  const [dotCount, setDotCount] = useState(0);
  const throttleRef = useRef(false);

  // animate loading dots when loading is true
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      interval = setInterval(() => {
        setDotCount(prev => (prev + 1) % 4);
      }, 400);
    } else {
      setDotCount(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleLocation = () => {
    // delegate to context — context itself handles throttle & loading state
    refresh();
  };

  return (
    <TouchableOpacity
      onPress={handleLocation}
      activeOpacity={0.8}
      className="flex-row items-center justify-end min-w-[100px]"
    >
      <View className="justify-center items-end">
        {loading ? (
          <Text className="text-lg font-medium text-gray-600 text-right">
            {"•".repeat(dotCount).padEnd(3, " ")}
          </Text>
        ) : (
          <View className="flex-row items-center">
            <MapPin size={20} stroke="#666" />
            <Text className="text-sm font-regular text-gray-600 ml-1">
              {accessDenied ? "location off" : dzongkhag ?? "Dzongkhag"}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
