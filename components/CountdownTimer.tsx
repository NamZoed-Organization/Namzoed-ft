import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { getCurrentTimeWindow, getCountdownSeconds, formatCompactCountdown } from '@/utils/timeHelpers';

interface CountdownTimerProps {
  endsAt?: string;  // ISO timestamp (deprecated - now uses daily 3pm-10pm window)
  compact?: boolean;  // Compact mode for cards
}

export default function CountdownTimer({ endsAt, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const timeWindow = getCurrentTimeWindow();
    const seconds = getCountdownSeconds();

    if (timeWindow === 'before') {
      return 'Opens at 3pm';
    } else if (timeWindow === 'after') {
      return 'Closed';
    } else {
      // During sale (3pm-10pm)
      return formatCompactCountdown(seconds) + ' left';
    }
  });

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timeWindow = getCurrentTimeWindow();
      const seconds = getCountdownSeconds();

      if (timeWindow === 'before') {
        setTimeLeft('Opens at 3pm');
      } else if (timeWindow === 'after') {
        setTimeLeft('Closed');
      } else {
        // During sale (3pm-10pm)
        setTimeLeft(formatCompactCountdown(seconds) + ' left');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
