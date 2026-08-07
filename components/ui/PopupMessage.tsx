import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

type PopupType = 'success' | 'error' | 'warning' | 'white';
type PopupActionStyle = 'default' | 'cancel' | 'destructive';

interface PopupAction {
  label: string;
  onPress?: () => void;
  style?: PopupActionStyle;
}

interface PopupMessageProps {
  visible: boolean;
  type: PopupType;
  title?: string;
  message: string;
  onHide?: () => void;
  actions?: PopupAction[];
}

// Same glassmorphism recipe as the floating tab bar (components/ui/FloatingTabBar.tsx)
// — a frosted, translucent card rather than a flat/solid color block — so every
// popup in the app reads as part of the same visual language.
const BLUR_INTENSITY = 50;
const ANDROID_BACKGROUND = 'rgba(255, 255, 255, 0.85)';

const popupConfig = {
  success: {
    iconColor: '#0A0A0A',
    iconBg: 'rgba(10, 10, 10, 0.08)',
    icon: CheckCircle,
    defaultTitle: 'Done',
  },
  error: {
    iconColor: '#dc2626',
    iconBg: 'rgba(220, 38, 38, 0.12)',
    icon: AlertCircle,
    defaultTitle: 'Something went wrong',
  },
  warning: {
    iconColor: '#d97706',
    iconBg: 'rgba(217, 119, 6, 0.12)',
    icon: AlertTriangle,
    defaultTitle: 'Heads up',
  },
  white: {
    iconColor: '#094569',
    iconBg: 'rgba(9, 69, 105, 0.1)',
    icon: CheckCircle,
    defaultTitle: 'Done',
  },
};

export default function PopupMessage({
  visible,
  type,
  title,
  message,
  onHide,
  actions,
}: PopupMessageProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const config = popupConfig[type];
  const Icon = config.icon;
  const displayTitle = title || config.defaultTitle;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.28)',
        zIndex: 50,
        paddingBottom: insets.bottom + 32,
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
      }}
    >
      <Pressable
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        onPress={onHide}
      />
      <Animated.View
        entering={ZoomIn.duration(240)}
        exiting={ZoomOut.duration(160)}
        style={{
          width: '100%',
          maxWidth: 320,
          borderRadius: 24,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(255, 255, 255, 0.65)',
          borderLeftColor: 'rgba(255, 255, 255, 0.35)',
          borderRightColor: 'rgba(255, 255, 255, 0.35)',
          borderBottomColor: 'rgba(0, 0, 0, 0.08)',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : ANDROID_BACKGROUND,
        }}
      >
        {Platform.OS === 'ios' && (
          <BlurView
            tint="systemChromeMaterial"
            intensity={BLUR_INTENSITY}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Liquid-glass sheen, matching the floating bar's highlight arc. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.6, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={{ paddingHorizontal: 20, paddingVertical: 18, alignItems: 'center' }}>
          <View
            style={{
              backgroundColor: config.iconBg,
              borderRadius: 50,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <Icon size={30} color={config.iconColor} strokeWidth={2.4} />
          </View>

          <Text
            style={{
              color: '#0A0A0A',
              fontSize: 17,
              fontWeight: '700',
              marginBottom: 4,
              letterSpacing: -0.3,
              textAlign: 'center',
            }}
          >
            {displayTitle}
          </Text>

          <Text
            style={{
              color: 'rgba(10, 10, 10, 0.62)',
              fontSize: 13,
              fontWeight: '500',
              textAlign: 'center',
              lineHeight: 17,
            }}
          >
            {message}
          </Text>

          {actions && actions.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 14,
                gap: 10,
                width: '100%',
              }}
            >
              {actions.map((action, index) => {
                const isDestructive = action.style === 'destructive';
                const isCancel = action.style === 'cancel';
                return (
                  <Pressable
                    key={`${action.label}-${index}`}
                    onPress={() => {
                      action.onPress?.();
                      onHide?.();
                    }}
                    style={{
                      minWidth: 96,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 9999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDestructive
                        ? '#dc2626'
                        : isCancel
                        ? 'rgba(9,69,105,0.08)'
                        : '#094569',
                      borderWidth: isCancel ? 1.5 : 0,
                      borderColor: isCancel ? 'rgba(9,69,105,0.28)' : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: isCancel ? '#094569' : '#ffffff',
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
