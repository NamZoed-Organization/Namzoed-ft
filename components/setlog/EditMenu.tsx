/**
 * The editors' options, as an iOS context menu.
 *
 * The same shape the camera's capture menu takes (`OptionSheet` in
 * `app/(users)/setlog/capture.tsx`): blurred, anchored to the control that
 * opened it, screen-aligned. Toggles carry a check on the left; anything
 * with more than two answers is a row with a chevron that swaps the menu
 * for its own list, rather than a sheet stacked on a sheet.
 *
 * It is a menu, not a screen — the scrim is the way out, there is no close
 * button, and every change applies to the thing behind it immediately. You
 * are choosing while looking at the result, which is the only reason to put
 * the options over the picture rather than under it.
 */

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const MENU_W = 268;

export type EditMenuItem =
  | {
      kind: "toggle";
      key: string;
      label: string;
      icon: React.ReactNode;
      value: boolean;
      onToggle: (next: boolean) => void;
    }
  | {
      kind: "submenu";
      key: string;
      label: string;
      icon: React.ReactNode;
      /** Shown on the right, so the current answer is readable without
       *  opening it. */
      value: string;
      options: { value: string; label: string }[];
      selected: string;
      onSelect: (value: string) => void;
    };

export default function EditMenu({
  title = "Edit",
  items,
  onClose,
}: {
  title?: string;
  items: EditMenuItem[];
  onClose: () => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = items.find(
    (i) => i.key === openKey && i.kind === "submenu",
  ) as Extract<EditMenuItem, { kind: "submenu" }> | undefined;

  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  /** Runs the growth backwards before unmounting, so the menu returns to
   *  the button rather than blinking out. */
  const dismiss = () => {
    progress.value = withTiming(
      0,
      { duration: 140, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + 0.5 * progress.value }],
  }));

  const Row = ({
    icon,
    label,
    checked,
    trailing,
    onPress,
    leading,
  }: {
    icon?: React.ReactNode;
    label: string;
    checked?: boolean;
    trailing?: React.ReactNode;
    onPress: () => void;
    leading?: React.ReactNode;
  }) => (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 11,
        gap: 10,
      }}
    >
      {/* The check leads the row and holds its column whether or not it is
          drawn, so every label starts in the same place. */}
      <View style={{ width: 20 }}>
        {leading ?? (checked ? <Check size={17} color="#fff" strokeWidth={2.6} /> : null)}
      </View>
      {icon ? <View style={{ width: 22, alignItems: "center" }}>{icon}</View> : null}
      <Text style={{ flex: 1, fontSize: 16, color: "#fff" }}>{label}</Text>
      {trailing}
    </TouchableOpacity>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Reanimated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={18}
            tint="dark"
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod="dimezisBlurView"
          />
        </TouchableOpacity>
      </Reanimated.View>

      {/* Anchored bottom-right, off the button that opens it. */}
      <Reanimated.View
        style={[
          {
            position: "absolute",
            right: 16,
            bottom: 78,
            width: MENU_W,
            transformOrigin: "bottom right",
          },
          menuStyle,
        ]}
      >
        <BlurView
          intensity={70}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={{
            width: "100%",
            borderRadius: 16,
            borderCurve: "continuous",
            overflow: "hidden",
            paddingVertical: 6,
          }}
        >
          {open ? (
            <>
              <Row
                label={open.label}
                leading={<ChevronLeft size={17} color="rgba(255,255,255,0.6)" strokeWidth={2.4} />}
                onPress={() => setOpenKey(null)}
              />
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  marginHorizontal: 14,
                  marginVertical: 4,
                }}
              />
              {open.options.map((option) => (
                <Row
                  key={option.value}
                  label={option.label}
                  checked={option.value === open.selected}
                  onPress={() => {
                    Haptics.selectionAsync();
                    open.onSelect(option.value);
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: "rgba(255,255,255,0.55)",
                  paddingHorizontal: 14,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                {title}
              </Text>
              {items.map((item) =>
                item.kind === "toggle" ? (
                  <Row
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    checked={item.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      item.onToggle(!item.value);
                    }}
                  />
                ) : (
                  <Row
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    onPress={() => setOpenKey(item.key)}
                    trailing={
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        <Text
                          style={{ fontSize: 15, color: "rgba(255,255,255,0.55)" }}
                        >
                          {item.value}
                        </Text>
                        <ChevronRight
                          size={16}
                          color="rgba(255,255,255,0.55)"
                          strokeWidth={2.4}
                        />
                      </View>
                    }
                  />
                ),
              )}
            </>
          )}
        </BlurView>
      </Reanimated.View>
    </View>
  );
}
