import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Marker, type MarkerProps } from "react-native-maps";

export type MapPinPreset =
  | "pickup"
  | "delivery"
  | "driver"
  | "shared"
  | "selected";

const PRESET: Record<
  MapPinPreset,
  { color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pickup: { color: "#1C1614", icon: "cube-outline" },
  delivery: { color: "#094569", icon: "navigate-circle-outline" },
  driver: { color: "#EA580C", icon: "bicycle" },
  shared: { color: "#0D9488", icon: "chatbubbles-outline" },
  selected: { color: "#6366F1", icon: "location-sharp" },
};

export type MapPinMarkerProps = {
  coordinate: { latitude: number; longitude: number };
  preset: MapPinPreset;
  title?: string;
  description?: string;
  size?: number;
  tracksViewChanges?: boolean;
  onPress?: MarkerProps["onPress"];
  /** Android/Google Maps in modals often needs drag as well as map tap. */
  draggable?: boolean;
  onDragEnd?: MarkerProps["onDragEnd"];
};

/**
 * Map pin with soft shadow, white ring, icon disc, and bottom point — reads clearly on any basemap.
 */
export default function MapPinMarker({
  coordinate,
  preset,
  title,
  description,
  size = 44,
  tracksViewChanges = false,
  onPress,
  draggable = false,
  onDragEnd,
}: MapPinMarkerProps) {
  const { color, icon } = PRESET[preset];
  return (
    <Marker
      coordinate={coordinate}
      title={title}
      description={description}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      draggable={draggable}
      onDragEnd={onDragEnd}
    >
      <MapPinVisual color={color} icon={icon} size={size} />
    </Marker>
  );
}

export function MapPinVisual({
  color,
  icon,
  size = 44,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
}) {
  const half = size / 2;
  const triW = Math.max(8, Math.round(size * 0.2));
  const triH = Math.max(9, Math.round(size * 0.22));
  return (
    <View style={styles.column} pointerEvents="none">
      <View style={styles.shadowLift}>
        <View
          style={[
            styles.disk,
            {
              width: size,
              height: size,
              borderRadius: half,
              borderCurve: "continuous",
              backgroundColor: color,
            },
          ]}
        >
          <Ionicons name={icon} size={Math.round(size * 0.38)} color="#FFFFFF" />
        </View>
      </View>
      <View
        style={[
          styles.tail,
          {
            borderLeftWidth: triW,
            borderRightWidth: triW,
            borderTopWidth: triH,
            borderTopColor: color,
            marginTop: -3,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
  },
  shadowLift: {
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  disk: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  tail: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
