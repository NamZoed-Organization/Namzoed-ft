/**
 * SingleLocationPicker
 * Full-screen modal that lets the user place a single pin on the map and confirm it.
 * The address is reverse-geocoded via OpenStreetMap Nominatim.
 */
import MapPinMarker from "@/components/maps/MapPinMarker";
import CircularLoader from "@/components/ui/CircularLoader";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    Dimensions,
    Modal,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { androidMapProvider } from "@/utils/mapProvider";
import MapView from "react-native-maps";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
  initialLocation?: PickedLocation | null;
  title?: string;
}

export default function SingleLocationPicker({
  visible,
  onClose,
  onConfirm,
  initialLocation,
  title = "Pick Your Location",
}: Props) {
  const [selected, setSelected] = useState<PickedLocation | null>(
    initialLocation ?? null,
  );
  const [geocoding, setGeocoding] = useState(false);

  // Sync initialLocation whenever the modal opens
  useEffect(() => {
    if (visible) {
      setSelected(initialLocation ?? null);
    }
  }, [visible]);

  const initialRegion = initialLocation
    ? {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 27.4728,
        longitude: 89.6393,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setGeocoding(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=17`,
        { headers: { "User-Agent": "NamzoedApp/1.0" } },
      );
      const data = await resp.json();
      setSelected({
        latitude,
        longitude,
        address: data?.display_name ?? undefined,
      });
    } catch {
      setSelected({ latitude, longitude });
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelected({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleMarkerDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    void reverseGeocode(latitude, longitude);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "white" }}>
        {/* Header */}
        <View
          style={{
            paddingTop: Platform.OS === "ios" ? 54 : 20,
            paddingHorizontal: 16,
            paddingBottom: 12,
            backgroundColor: "white",
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{ padding: 4 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#374151" />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 17,
              fontWeight: "600",
              color: "#111827",
            }}
          >
            {title}
          </Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!selected || geocoding}
            style={{ padding: 4 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {geocoding ? (
              <CircularLoader size="small" color="#2563eb" />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: selected ? "#2563eb" : "#9ca3af",
                }}
              >
                Done
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Address strip */}
        <View
          style={{
            backgroundColor: "#f9fafb",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
            minHeight: 42,
            justifyContent: "center",
          }}
        >
          {selected ? (
            <Text
              style={{ fontSize: 13, color: "#374151", lineHeight: 18 }}
              numberOfLines={2}
            >
              📍{" "}
              {selected.address ??
                `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: "#9ca3af" }}>
              Tap or long-press the map to place your pin (you can drag the pin after)
            </Text>
          )}
        </View>

        {/* Map — avoid controlled region; remount on Android; explicit min height avoids blank map */}
        <View
          style={{ flex: 1, minHeight: Platform.OS === "android" ? Math.max(280, Dimensions.get("window").height * 0.42) : 0 }}
          collapsable={false}
        >
          <MapView
            key={Platform.OS === "android" ? `single-loc-${visible}` : "single-loc"}
            style={{ flex: 1 }}
            provider={androidMapProvider()}
            initialRegion={initialRegion}
            onPress={handleMapPress}
            onLongPress={handleMapPress}
            moveOnMarkerPress={false}
            toolbarEnabled={false}
          >
            {selected && (
              <MapPinMarker
                coordinate={{
                  latitude: selected.latitude,
                  longitude: selected.longitude,
                }}
                preset="selected"
                size={46}
                title="Selected location"
                description={selected.address}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            )}
          </MapView>
        </View>

        {/* Bottom confirm bar */}
        {selected && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Platform.OS === "ios" ? 34 : 16,
              backgroundColor: "white",
              borderTopWidth: 1,
              borderTopColor: "#e5e7eb",
            }}
          >
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={geocoding}
              style={{
                backgroundColor: "#2563eb",
                borderRadius: 14,
                borderCurve: "continuous",
                paddingVertical: 15,
                alignItems: "center",
              }}
            >
              {geocoding ? (
                <CircularLoader color="white" />
              ) : (
                <Text
                  style={{ color: "white", fontSize: 16, fontWeight: "700" }}
                >
                  Confirm This Location
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
