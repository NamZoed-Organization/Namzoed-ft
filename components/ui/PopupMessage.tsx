import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

type PopupType = 'success' | 'error' | 'warning' | 'white';

interface PopupMessageProps {
  visible: boolean;
  type: PopupType;
  title?: string;
  message: string;
}

const popupConfig = {
  success: {
    colors: ['#094569', '#0a5a8a', '#0b7dba'] as [string, string, string],
    icon: CheckCircle,
    defaultTitle: 'Awesome!',
    textColor: 'white',
  },
  error: {
    colors: ['#dc2626', '#b91c1c', '#991b1b'] as [string, string, string],
    icon: AlertCircle,
    defaultTitle: 'Oops!',
    textColor: 'white',
  },
  warning: {
    colors: ['#d97706', '#b45309', '#92400e'] as [string, string, string],
    icon: AlertTriangle,
    defaultTitle: 'Warning',
    textColor: 'white',
  },
  white: {
    colors: ['#ffffff', '#f9fafb', '#f3f4f6'] as [string, string, string],
    icon: CheckCircle,
    defaultTitle: 'Done!',
    textColor: '#094569',
  },
};

export default function PopupMessage({ visible, type, title, message }: PopupMessageProps) {
  if (!visible) return null;

  const config = popupConfig[type];
  const Icon = config.icon;
  const displayTitle = title || config.defaultTitle;
  const isWhite = type === 'white';
  const iconColor = isWhite ? config.textColor : 'white';
  const iconBgColor = isWhite ? 'rgba(9,69,105,0.1)' : 'rgba(255,255,255,0.2)';
  const iconInnerBgColor = isWhite ? 'rgba(9,69,105,0.15)' : 'rgba(255,255,255,0.3)';

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      className="absolute inset-0 items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      <Animated.View
        entering={FadeIn.duration(400)}
        className="mx-4 rounded-3xl overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 20,
        }}
      >
        <LinearGradient
          colors={config.colors}
          start={[0, 0]}
          end={[1, 1]}
          style={{ padding: 32, alignItems: 'center' }}
        >
          {/* Icon with glow effect */}
          <View
            style={{
              backgroundColor: iconBgColor,
              borderRadius: 50,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <View
              style={{
                backgroundColor: iconInnerBgColor,
                borderRadius: 40,
                padding: 12,
              }}
            >
              <Icon size={48} color={iconColor} strokeWidth={2.5} />
            </View>
          </View>

          {/* Title */}
          <Text
            style={{
              color: config.textColor,
              fontSize: 22,
              fontWeight: '700',
              marginBottom: 8,
              letterSpacing: -0.5,
            }}
          >
            {displayTitle}
          </Text>

          {/* Message */}
          <Text
            style={{
              color: isWhite ? 'rgba(9,69,105,0.8)' : 'rgba(255,255,255,0.9)',
              fontSize: 15,
              fontWeight: '500',
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            {message}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}
