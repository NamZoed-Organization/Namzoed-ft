import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';

interface CountdownTimerProps {
  endsAt?: string;  // ISO timestamp
  compact?: boolean;  // Compact mode for cards
}

export default function CountdownTimer({ endsAt, compact = false }: CountdownTimerProps) {
  const timeLeft = useMemo(() => {
    if (!endsAt) return '';

    const now = new Date().getTime();
    const end = new Date(endsAt).getTime();
    const diff = end - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  }, [endsAt]);

  if (!endsAt || !timeLeft) return null;

  if (compact) {
    // Compact version for cards
    return (
      <View className="flex-row items-center gap-1">
        <Clock size={10} color="#F59E0B" />
        <Text className="text-[10px] text-amber-600 font-medium">
          {timeLeft}
        </Text>
      </View>
    );
  }

  // Full version for detail page
  return (
    <View className="flex-row items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-md">
      <Clock size={14} color="#F59E0B" />
      <Text className="text-xs text-amber-700 font-semibold">
        {timeLeft}
      </Text>
    </View>
  );
}
