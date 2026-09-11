/**
 * QR scanner
 *
 * Opened by the ScanLine button in the personal profile's top bar, which
 * was a "Coming Soon" alert until this screen existed.
 *
 * Reads Namzoed codes (lib/qrConnectService.ts) and hands what it finds to
 * `useQrConnectFlow`, which puts up `ScanConfirmSheet`. Scanning writes
 * nothing on its own — the confirmation in that sheet is the scanner's half
 * of the handshake, and the other person's acceptance is the other half.
 *
 * Chrome is the standard's three-part header (§ Header), in white rather
 * than `#374151` because it sits over the camera: chevron, centred title,
 * one text action. The torch is a control on the viewfinder, next to the
 * frame it affects, rather than a second icon in the header.
 */

import ScanConfirmSheet from "@/components/qr/ScanConfirmSheet";
import { useUser } from "@/contexts/UserContext";
import { useQrConnectFlow } from "@/hooks/useQrConnectFlow";
import { useAppRouter } from "@/utils/navigation";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Flashlight, FlashlightOff } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
/** The reticle. Big enough that a phone held across a table fills it. */
const FRAME = Math.min(SCREEN_WIDTH * 0.68, 280);
const CORNER = 30;
const CORNER_WIDTH = 3;

/** One L-shaped corner of the reticle. Four rotations of the same piece —
 *  a full border would read as a viewfinder you have to fill exactly, which
 *  isn't how the scanner works. */
function FrameCorner({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const top = corner === "tl" || corner === "tr";
  const left = corner === "tl" || corner === "bl";
  return (
    <View
      style={{
        position: "absolute",
        width: CORNER,
        height: CORNER,
        top: top ? 0 : undefined,
        bottom: top ? undefined : 0,
        left: left ? 0 : undefined,
        right: left ? undefined : 0,
        borderColor: "#fff",
        borderTopWidth: top ? CORNER_WIDTH : 0,
        borderBottomWidth: top ? 0 : CORNER_WIDTH,
        borderLeftWidth: left ? CORNER_WIDTH : 0,
        borderRightWidth: left ? 0 : CORNER_WIDTH,
        borderTopLeftRadius: corner === "tl" ? 12 : 0,
        borderTopRightRadius: corner === "tr" ? 12 : 0,
        borderBottomLeftRadius: corner === "bl" ? 12 : 0,
        borderBottomRightRadius: corner === "br" ? 12 : 0,
        borderCurve: "continuous",
      }}
    />
  );
}

export default function QrScannerScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { currentUser } = useUser();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  const flow = useQrConnectFlow(currentUser?.id);

  // Ask once, on arrival. Someone who opened a scanner wants the camera —
  // making them press a button first only adds a screen in front of the
  // system prompt.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Depends on `begin` (stable per user) rather than the flow object, which
  // is a fresh literal every render — swapping CameraView's handler on each
  // one is churn the native view doesn't need. `begin` ignores repeat
  // payloads itself, so the status check here is only an early out.
  const { begin, status: flowStatus } = flow;
  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      begin(data);
    },
    [begin],
  );

  const header = (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 4,
        paddingHorizontal: 8,
        paddingBottom: 8,
        zIndex: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <ChevronLeft size={28} color="#fff" />
        </TouchableOpacity>

        {/* Absolutely centred against the row's full height — a bare
            absolutely-positioned Text doesn't centre reliably against
            sibling buttons (§ Header). */}
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#fff" }}>Scan</Text>
        </View>

        {/* Going back rather than pushing when Add Friends is what opened
            the camera: the two screens send you to each other, so pushing
            both ways stacks a copy per round trip. */}
        <TouchableOpacity
          onPress={() =>
            from === "add-friends" ? router.back() : router.replace("/add-friends" as any)
          }
          style={{ padding: 6 }}
        >
          <Text style={{ fontSize: 17, fontWeight: "500", color: "#fff" }}>My code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Permission refused for good: a plain screen that says what's missing
  // and opens the one place it can be changed. Never a camera view that
  // silently shows nothing.
  const denied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />

      {permission?.granted && isFocused && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          // Stops firing while a result is up: the camera reports a code
          // once per frame for as long as it is in view.
          onBarcodeScanned={flowStatus === null ? handleBarcode : undefined}
        />
      )}

      {header}

      {denied ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={{ fontSize: 17, fontWeight: "600", color: "#fff", textAlign: "center" }}
          >
            Camera access is off
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 16,
              lineHeight: 22,
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
            }}
          >
            Namzoed needs the camera to read a friend&apos;s code. You can turn it back on in
            Settings.
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()} style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: "500", color: "#7DD3FC" }}>
              Open Settings
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
          }}
          pointerEvents="box-none"
        >
          <View style={{ width: FRAME, height: FRAME }} pointerEvents="none">
            <FrameCorner corner="tl" />
            <FrameCorner corner="tr" />
            <FrameCorner corner="bl" />
            <FrameCorner corner="br" />
          </View>

          <Text
            style={{
              marginTop: 20,
              fontSize: 15,
              color: "rgba(255,255,255,0.7)",
              textAlign: "center",
              paddingHorizontal: 32,
            }}
            pointerEvents="none"
          >
            Point at the code on someone&apos;s Add Friends screen
          </Text>

          <TouchableOpacity
            onPress={() => setTorch((t) => !t)}
            activeOpacity={0.8}
            style={{
              marginTop: 24,
              width: 52,
              height: 52,
              borderRadius: 26,
              borderCurve: "continuous",
              backgroundColor: torch ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {torch ? (
              <Flashlight size={22} strokeWidth={1.8} color="#111" />
            ) : (
              <FlashlightOff size={22} strokeWidth={1.8} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScanConfirmSheet
        visible={flow.status !== null}
        onClose={flow.reset}
        status={flow.status ?? "loading"}
        person={flow.person}
        message={flow.message}
        submitting={flow.submitting}
        onPrimary={() =>
          flow.primary((person) => {
            flow.reset();
            router.push(`/(users)/profile/${person.id}` as any);
          })
        }
      />
    </View>
  );
}
