/**
 * ProfilePreviewCard
 *
 * The expanded UI that lives *inside* an avatar (see ProfilePreviewTrigger).
 * It is laid out at full size from the first frame and clipped away by the
 * avatar's own bounds until the island opens — it is never mounted "on open",
 * because a view that appears when you press is a popover, not a morph.
 *
 * Laid out as the profile screen's own header is: the cover runs behind the
 * whole block rather than sitting in a strip, the identity column sits to the
 * RIGHT of the avatar rather than under it, and the counts go beneath both.
 * White on the gradient throughout, same as there.
 *
 * Split in two because they reveal differently. The background comes in with
 * the shape, early, so the pill is already the person's colour as it
 * stretches; the body fades in later, once there is room for type. The avatar
 * is in neither — it is the trigger's own child, the real one, already on
 * screen, and this only leaves a gap for it.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import { fetchUserProfile } from "@/lib/profileService";
import { fetchServiceProviderProfile } from "@/lib/servicesService";
import { LinearGradient } from "expo-linear-gradient";
import { MapPin, Verified, Wrench } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export const CARD_W = 300;
export const CARD_RADIUS = 20;
export const AVATAR_SIZE = 56;
export const AVATAR_LEFT = 16;
export const AVATAR_TOP = 16;
export const AVATAR_RING = 2;
/** Where the identity column starts — clear of the avatar, matching the
 *  profile screen's own `ml-4` beside its 86pt avatar. */
export const IDENTITY_LEFT = AVATAR_LEFT + AVATAR_SIZE + 14;
export const CARD_H_BASE = 134;
export const WORK_CARD_H = 60;

interface PreviewProfile {
  name: string | null;
  coverUrl: string | null;
  coverHue: number | null;
  namzoedId: string | null;
  dzongkhag: string | null;
  followers: number;
  following: number;
}

/** Height depends only on whether there's a Work card, so the target the
 *  morph animates toward is known before the fetch lands. */
export function previewCardHeight(hasWorkCard: boolean) {
  return CARD_H_BASE + (hasWorkCard ? WORK_CARD_H : 0);
}

export function useProfilePreviewData(userId: string | null, active: boolean) {
  const [profile, setProfile] = useState<PreviewProfile | null>(null);
  const [provider, setProvider] = useState<any>(null);

  useEffect(() => {
    if (!userId || !active) return;
    let cancelled = false;

    fetchUserProfile(userId)
      .then((row: any) => {
        if (cancelled || !row) return;
        setProfile({
          name: row.name ?? null,
          coverUrl: row.cover_image_url ?? null,
          coverHue: row.cover_hue ?? null,
          namzoedId: row.namzoed_id ?? null,
          dzongkhag: row.dzongkhag ?? null,
          followers: row.follower_count ?? 0,
          following: row.following_count ?? 0,
        });
      })
      .catch(() => {});

    fetchServiceProviderProfile(userId)
      .then((row: any) => !cancelled && setProvider(row))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId, active]);

  return { profile, provider, hasWorkCard: !!provider?.name?.trim() };
}

interface ProfilePreviewCardProps {
  fallbackName?: string | null;
  profile: PreviewProfile | null;
  provider: any;
  hasWorkCard: boolean;
}

/**
 * The cover, behind everything. Its own layer because it reveals with the
 * shape rather than with the type — the pill should already be the person's
 * colour while it is still stretching.
 */
export function ProfilePreviewBackground({
  userId,
  profile,
  hasWorkCard,
}: {
  userId: string | null;
  profile: PreviewProfile | null;
  hasWorkCard: boolean;
}) {
  // The profile screen's own per-user cover identity, so a peek and the real
  // profile are recognisably the same person's colour.
  const { cover: coverGradient, tintRgb } = useCoverPalette(
    userId ?? undefined,
    profile?.coverUrl,
    profile?.coverHue,
  );

  const tint = (alpha: number) =>
    `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${alpha})`;

  // Four layers, in the profile screen's own order. The cover photo does NOT
  // simply replace the gradient — it sits between two of them:
  //
  //   1. the cover gradient, always, so a profile with no photo still has its
  //      colour and one with a photo still has it underneath while the image
  //      loads;
  //   2. the photo;
  //   3. a neutral grey, so white type survives a photo that happens to be
  //      pale — a coloured tint alone can't guarantee that;
  //   4. the tint ramp from the same hue, the matte the profile screen puts
  //      over its own cover. It runs over the photo too, which is what keeps
  //      the person's colour present instead of the photo washing it out.
  //
  // Its floor is higher here than on the profile screen (0.25 rather than 0)
  // because this card is 134pt tall, not a full header: the identity sits
  // near the top, where that ramp would otherwise still be transparent.
  return (
    <View
      style={{ width: CARD_W, height: previewCardHeight(hasWorkCard), overflow: "hidden" }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={coverGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {profile?.coverUrl ? (
        <>
          <ProgressiveImage
            uri={profile.coverUrl}
            style={StyleSheet.absoluteFillObject}
            showProgress={false}
          />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(17,24,39,0.32)" }]}
          />
        </>
      ) : null}
      <LinearGradient
        colors={[tint(0.25), tint(0.6), tint(0.92)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default function ProfilePreviewCard({
  fallbackName,
  profile,
  provider,
  hasWorkCard,
}: ProfilePreviewCardProps) {
  return (
    <View style={{ width: CARD_W, height: previewCardHeight(hasWorkCard) }}>
      {/* Identity, to the RIGHT of the avatar — the profile screen's own
          avatar-then-column row. The left padding is the gap the avatar
          occupies; it is drawn by the trigger, not here. */}
      <View
        style={{
          paddingLeft: IDENTITY_LEFT,
          paddingRight: 14,
          paddingTop: AVATAR_TOP,
          minHeight: AVATAR_TOP + AVATAR_SIZE,
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
          {profile?.name ?? fallbackName ?? ""}
        </Text>
        {profile?.namzoedId ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}
          >
            NamZoed ID: {profile.namzoedId}
          </Text>
        ) : null}
        {profile?.dzongkhag ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <MapPin size={11} color="rgba(255,255,255,0.5)" />
            <Text numberOfLines={1} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              {profile.dzongkhag}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Counts below both, as on the profile screen. */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginTop: 12, gap: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
            {profile?.followers ?? 0}
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Followers</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
            {profile?.following ?? 0}
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Following</Text>
        </View>
      </View>

      {hasWorkCard ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 14,
            borderRadius: 8,
            borderCurve: "continuous",
            paddingVertical: 9,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.15)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 13, fontWeight: "600", color: "#fff", flexShrink: 1 }}
              >
                {provider.name}
              </Text>
              {provider.verification_status === "verified" && (
                <Verified size={12} color="#7FD1FF" />
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                color: provider.master_bio
                  ? "rgba(255,255,255,0.7)"
                  : "rgba(255,255,255,0.5)",
                fontStyle: provider.master_bio ? "normal" : "italic",
                marginTop: 1,
              }}
            >
              {provider.master_bio || "Business"}
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          >
            {provider.profile_url ? (
              <ProgressiveImage
                uri={provider.profile_url}
                style={{ width: "100%", height: "100%" }}
                showProgress={false}
              />
            ) : (
              <Wrench size={16} strokeWidth={1.5} color="rgba(255,255,255,0.8)" />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
