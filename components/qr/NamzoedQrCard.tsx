/**
 * NamzoedQrCard
 *
 * Somebody's Namzoed code, as a card. Purely presentational — every value
 * it draws is a prop — so `components/dev/AddFriendsPreview.tsx` can render
 * the real card on fixtures and the Add Friends screen keeps one call site.
 *
 * It wears the person's own cover identity (the `useCoverPalette` gradient
 * behind the whole block, white type over it) for the same reason the
 * profile header and the profile peek do: a code with your colour and your
 * face on it is recognisably yours across a table, which is the entire
 * moment this screen exists for.
 *
 * The code itself sits on a white tile rather than straight on the
 * gradient. That is not decoration — a scanner needs the quiet zone and the
 * dark-on-light contrast, and a QR painted onto a mid-tone gradient reads
 * slowly or not at all in poor light.
 */

import { MODAL_RADIUS } from "@/constants/theme";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import { buildNamzoedQrPayload } from "@/lib/qrPayload";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { LinearGradient } from "expo-linear-gradient";
import { QrCode, User } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

/** The screen's one accent, on the one thing the screen is for. Dark enough
 *  (L≈22%) that scanners read it exactly as they read black. */
export const QR_INK = "#094569";

const GROUP_RADIUS = 18;
const AVATAR = 72;

interface NamzoedQrCardProps {
  /** Stable per-user id — only ever feeds the fallback hue. */
  userId?: string;
  name: string;
  namzoedId: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  coverHue?: number | null;
  /** Side of the QR module block, before the white tile's padding. */
  size?: number;
  /** One line under the code. Absent renders nothing rather than a gap. */
  caption?: string;
}

export default function NamzoedQrCard({
  userId,
  name,
  namzoedId,
  avatarUrl,
  coverImageUrl,
  coverHue,
  size = 200,
  caption,
}: NamzoedQrCardProps) {
  const palette = useCoverPalette(userId, coverImageUrl, coverHue);

  return (
    <View
      style={{
        borderRadius: GROUP_RADIUS,
        borderCurve: "continuous",
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <LinearGradient
        colors={palette.cover}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 24, paddingHorizontal: 20, alignItems: "center" }}
      >
        <View
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: AVATAR / 2,
            borderCurve: "continuous",
            backgroundColor: "rgba(255,255,255,0.18)",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <ProgressiveImage
              uri={avatarUrl}
              style={{ width: "100%", height: "100%" }}
              showProgress={false}
            />
          ) : (
            <User size={30} strokeWidth={1.5} color="#fff" />
          )}
        </View>

        <Text
          numberOfLines={1}
          style={{ marginTop: 12, fontSize: 17, fontWeight: "600", color: "#fff" }}
        >
          {name}
        </Text>

        {/* Same line, same icon, same weight as the one under the name on
            the profile screen — this card is that identity, reissued. */}
        {namzoedId ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
            <QrCode size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              NamZoed ID: {namzoedId}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: MODAL_RADIUS,
            borderCurve: "continuous",
            backgroundColor: "#fff",
          }}
        >
          {namzoedId ? (
            <QRCode
              value={buildNamzoedQrPayload(namzoedId)}
              size={size}
              color={QR_INK}
              backgroundColor="#fff"
              // The white tile's own padding is the quiet zone; asking the
              // library for a second one just shrinks the modules.
              quietZone={0}
              ecl="M"
            />
          ) : (
            // A profile saved before namzoed_id existed has nothing to
            // encode. Say that in the code's own slot rather than
            // rendering an unscannable placeholder.
            <View
              style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
            >
              <QrCode size={40} strokeWidth={1.5} color="#C7C7CC" />
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "#9CA3AF",
                  textAlign: "center",
                  paddingHorizontal: 12,
                }}
              >
                Your code is still being set up. Pull to refresh in a moment.
              </Text>
            </View>
          )}
        </View>

        {caption ? (
          <Text
            style={{
              marginTop: 14,
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
            }}
          >
            {caption}
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}
