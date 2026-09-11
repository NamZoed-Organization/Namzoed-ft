/**
 * Shared chrome for the settings sub-screens.
 *
 * Every screen under Settings is the same shape: a back-chevron header with
 * a centered title, then white rounded groups of rows on the drawer's grey
 * ground (components/modals/HamburgerMenu.tsx is the reference — black
 * icons, hairline separators, 15.5px semibold labels). These primitives keep
 * that in one place instead of each screen re-deriving it.
 */

import { SWITCH_COLORS } from "@/constants/theme";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The drawer's ground — shared so screens can't drift apart. */
export const SETTINGS_BACKGROUND = "#f5f5f5";
export const SETTINGS_ICON = "#111";
export const SETTINGS_ICON_STROKE = 1.8;

interface SettingsScreenProps {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  /** Pinned below the scroll area — e.g. the root list's Log out button. */
  footer?: React.ReactNode;
}

export function SettingsScreen({ title, onClose, children, footer }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ backgroundColor: SETTINGS_BACKGROUND }}>
      <View className="flex-row items-center justify-between px-3 pb-3 pt-1">
        <TouchableOpacity onPress={onClose} className="p-1">
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>
        <View
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" }}
          pointerEvents="none"
        >
          <Text className="text-[17px] font-semibold text-gray-900">{title}</Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: (insets.bottom || 20) + 16,
        }}
      >
        {children}
      </ScrollView>

      {footer != null && (
        <View style={{ paddingHorizontal: 12, paddingBottom: (insets.bottom || 20) + 8 }}>
          {footer}
        </View>
      )}
    </View>
  );
}

export function SettingsGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-3.5">
      {label != null && (
        <Text className="text-[13px] font-semibold text-gray-500 px-3 pb-2">
          {label}
        </Text>
      )}
      <View
        style={{ borderRadius: 18, borderCurve: "continuous" }}
        className="bg-white overflow-hidden"
      >
        {children}
      </View>
    </View>
  );
}

/** Hairline between rows in a group — omitted above the first row, and
 *  inset to wherever the row's text starts so it reads as a separator
 *  between labels rather than a full-width rule. */
function RowDivider({ first, inset }: { first: boolean; inset: number }) {
  if (first) return null;
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#f0f0f0", marginLeft: inset }} />
  );
}

interface SettingsRowProps {
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  description?: string | null;
  /** Right-aligned value text, e.g. the linked account or current setting. */
  value?: string | null;
  onPress?: () => void;
  /** Trailing content in place of the chevron. */
  right?: React.ReactNode;
  /** Red label, for destructive rows. */
  destructive?: boolean;
  first?: boolean;
}

export function SettingsRow({
  icon: Icon,
  label,
  description,
  value,
  onPress,
  right,
  destructive,
  first = false,
}: SettingsRowProps) {
  const body = (
    <View className="flex-row items-center px-4 py-4">
      {Icon != null && (
        <View style={{ width: 32 }}>
          <Icon size={20} color={SETTINGS_ICON} strokeWidth={SETTINGS_ICON_STROKE} />
        </View>
      )}
      <View className="flex-1">
        <Text
          className="text-[15.5px] font-semibold"
          style={{ color: destructive ? "#DC2626" : "#111" }}
        >
          {label}
        </Text>
        {description != null && (
          <Text className="text-xs text-gray-400 mt-0.5">{description}</Text>
        )}
      </View>
      {value != null && (
        <Text className="text-[15px] text-gray-400 ml-3 max-w-[45%]" numberOfLines={1}>
          {value}
        </Text>
      )}
      {right ?? (onPress != null ? <ChevronRight size={18} color="#C7C7CC" /> : null)}
    </View>
  );

  return (
    <>
      <RowDivider first={first} inset={Icon != null ? 48 : 16} />
      {onPress != null ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {body}
        </TouchableOpacity>
      ) : (
        body
      )}
    </>
  );
}

export function SettingsSwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
  first = false,
}: {
  icon?: SettingsRowProps["icon"];
  label: string;
  description?: string | null;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  first?: boolean;
}) {
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      first={first}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: SWITCH_COLORS.trackOff, true: SWITCH_COLORS.trackOn }}
          thumbColor={SWITCH_COLORS.thumb}
          ios_backgroundColor={SWITCH_COLORS.trackOff}
        />
      }
    />
  );
}
