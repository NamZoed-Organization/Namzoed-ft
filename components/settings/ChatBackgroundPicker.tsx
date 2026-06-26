import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ChatBackgroundOption = {
  id: string;
  name: string;
  type: 'default' | 'solid' | 'gradient';
  colors?: [string, string]; // For gradients
  color?: string; // For solid
};

export const CHAT_BACKGROUNDS: ChatBackgroundOption[] = [
  { id: 'default', name: 'Default', type: 'default' },
  
  // Solid Colors
  { id: '#000000', name: 'Dark Mode', type: 'solid', color: '#000000' },
  { id: '#1e293b', name: 'Slate', type: 'solid', color: '#1e293b' },
  { id: '#0f172a', name: 'Navy', type: 'solid', color: '#0f172a' },
  { id: '#312e81', name: 'Indigo', type: 'solid', color: '#312e81' },
  { id: '#4c1d95', name: 'Deep Purple', type: 'solid', color: '#4c1d95' },
  { id: '#701a75', name: 'Violet', type: 'solid', color: '#701a75' },
  { id: '#831843', name: 'Fuchsia', type: 'solid', color: '#831843' },
  { id: '#1c1917', name: 'Zinc', type: 'solid', color: '#1c1917' },
  { id: '#ef4444', name: 'Red Solid', type: 'solid', color: '#ef4444' },
  { id: '#3b82f6', name: 'Blue Solid', type: 'solid', color: '#3b82f6' },
  
  // Gradients
  { id: 'grad:#1e293b,#0f172a', name: 'Midnight', type: 'gradient', colors: ['#1e293b', '#0f172a'] },
  { id: 'grad:#312e81,#1e1b4b', name: 'Deep Space', type: 'gradient', colors: ['#312e81', '#1e1b4b'] },
  { id: 'grad:#4c1d95,#3b0764', name: 'Nebula', type: 'gradient', colors: ['#4c1d95', '#3b0764'] },
  { id: 'grad:#9d174d,#500724', name: 'Crimson Night', type: 'gradient', colors: ['#9d174d', '#500724'] },
  { id: 'grad:#be185d,#831843', name: 'Magenta Glow', type: 'gradient', colors: ['#be185d', '#831843'] },
  { id: 'grad:#f43f5e,#9f1239', name: 'Rose Dark', type: 'gradient', colors: ['#f43f5e', '#9f1239'] },
  { id: 'grad:#0369a1,#082f49', name: 'Ocean Depth', type: 'gradient', colors: ['#0369a1', '#082f49'] },
  { id: 'grad:#b45309,#451a03', name: 'Autumn', type: 'gradient', colors: ['#b45309', '#451a03'] },
  { id: 'grad:#047857,#064e3b', name: 'Forest', type: 'gradient', colors: ['#047857', '#064e3b'] },
];

export function parseBackground(bgId: string) {
  return CHAT_BACKGROUNDS.find(b => b.id === bgId) || CHAT_BACKGROUNDS[0];
}

interface ChatBackgroundPickerProps {
  selectedBgId: string;
  onSelectBg: (bgId: string) => void;
  allowClear?: boolean; // If true, hitting selected clears it
  onClear?: () => void;
}

export default function ChatBackgroundPicker({ 
  selectedBgId, 
  onSelectBg, 
  allowClear = false,
  onClear
}: ChatBackgroundPickerProps) {

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {allowClear && (
        <TouchableOpacity
          style={styles.clearOption}
          onPress={() => onClear?.()}
        >
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      )}

      {CHAT_BACKGROUNDS.map((bg) => {
        const isSelected = selectedBgId === bg.id;

        return (
          <TouchableOpacity
            key={bg.id}
            activeOpacity={0.8}
            onPress={() => {
              if (isSelected && allowClear && onClear) {
                onClear();
              } else {
                onSelectBg(bg.id);
              }
            }}
            style={[
              styles.optionContainer,
              isSelected && styles.optionSelected
            ]}
          >
            <View style={styles.previewBox}>
              {bg.type === 'default' && (
                <ImageBackground
                  source={require('@/assets/chatbackground/chatbg.png')}
                  style={styles.previewFill}
                  resizeMode="cover"
                />
              )}
              {bg.type === 'solid' && (
                <View style={[styles.previewFill, { backgroundColor: bg.color }]} />
              )}
              {bg.type === 'gradient' && bg.colors && (
                <LinearGradient
                  colors={bg.colors}
                  style={styles.previewFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              
              {isSelected && (
                <View style={styles.checkOverlay}>
                  <Check size={20} color="white" />
                </View>
              )}
            </View>
            <Text style={styles.bgLabel} numberOfLines={1}>
              {bg.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  optionContainer: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  optionSelected: {
    opacity: 1,
  },
  previewBox: {
    width: 64,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  previewFill: {
    width: '100%',
    height: '100%',
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgLabel: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '500',
    textAlign: 'center',
  },
  clearOption: {
    width: 72,
    height: 96,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clearText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  }
});