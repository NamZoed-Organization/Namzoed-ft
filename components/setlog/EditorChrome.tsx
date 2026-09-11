/**
 * The chrome both export editors wear.
 *
 * Not the app's standard header (§ Header): this is a screen where the
 * *thing being made* is the whole point, so the controls float over it as
 * circles rather than sitting in a bar that takes a strip off the top. Close
 * on the left, the actions on the right, and everything that shapes the
 * output behind one button in the bottom corner.
 *
 * **The options live behind the sliders button** rather than under the
 * stage. A row of steppers below the preview competes with the preview for
 * the same glance; a sheet you open, change and dismiss does not — and it
 * leaves the stage as tall as the screen allows, which is what you are
 * actually judging.
 *
 * The one filled button is the primary action, and there is at most one
 * (§ People lists' rule, applied to a screen).
 */

import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORB = 44;

export interface EditorAction {
  key: string;
  icon: React.ReactNode;
  onPress: () => void;
  /** The one that carries the accent. At most one per screen. */
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

/** A circle on the ground, dark-on-light so it reads over a white page and
 *  a black stage alike. */
export function EditorOrb({
  children,
  onPress,
  primary,
  disabled,
  size = ORB,
}: {
  children: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderCurve: "continuous",
        backgroundColor: primary ? "#0369A1" : "#fff",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

export function EditorTopBar({
  onClose,
  closeIcon,
  actions = [],
}: {
  onClose: () => void;
  closeIcon: React.ReactNode;
  actions?: EditorAction[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: insets.top + 6,
        paddingBottom: 12,
      }}
    >
      <EditorOrb onPress={onClose}>{closeIcon}</EditorOrb>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {actions.map((action) => (
          <EditorOrb
            key={action.key}
            onPress={action.onPress}
            primary={action.primary}
            disabled={action.disabled || action.busy}
          >
            {action.icon}
          </EditorOrb>
        ))}
      </View>
    </View>
  );
}

/**
 * The foot: the named apps on the left, the options button on the right.
 *
 * The apps are a pill of their own so the three read as one group — where
 * this is going — rather than three loose circles competing with the one on
 * the other side, which is about what it looks like.
 *
 * Only Instagram can be handed an image directly (through the pasteboard,
 * on iOS); the others open the OS sheet with the file attached. That is
 * honest and it is also what happens if the app is not installed, so the
 * button never does nothing — see `lib/setlogShare.ts`.
 */
export function EditorFootBar({
  caption,
  targets,
  onOptions,
  optionsIcon,
  disabled,
}: {
  caption?: string;
  targets?: { key: string; icon: React.ReactNode; onPress: () => void }[];
  onOptions: () => void;
  optionsIcon: React.ReactNode;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: insets.bottom + 10,
        gap: 12,
      }}
    >
      {targets && targets.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 18,
            paddingHorizontal: 20,
            paddingVertical: 11,
            borderRadius: 999,
            borderCurve: "continuous",
            backgroundColor: "#fff",
            opacity: disabled ? 0.4 : 1,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
          }}
        >
          {targets.map((target) => (
            <TouchableOpacity
              key={target.key}
              activeOpacity={0.7}
              onPress={target.onPress}
              disabled={disabled}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              {target.icon}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: "#9CA3AF" }}>
          {caption}
        </Text>
      )}
      <EditorOrb onPress={onOptions}>{optionsIcon}</EditorOrb>
    </View>
  );
}
