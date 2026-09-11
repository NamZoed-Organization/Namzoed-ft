/**
 * BusinessLicense
 *
 * The business license — the one document that decides whether this seller
 * can list products on shopping at all. It gets a screen because it is the
 * only thing on the business that a buyer has to be able to trust, and
 * because the state matters as much as the file: uploaded is not verified,
 * and a seller who can't see which one they're in has no idea why their
 * products won't publish.
 *
 * The sheet this replaced was three unlabelled actions over a dimmed page —
 * View / Replace / Remove — with the status shown nowhere. Here the status is
 * the first thing on the screen, the document is visible rather than hidden
 * behind "View", and the actions read as what they do to it.
 *
 * Presentational: picking, uploading and removing all belong to the screen
 * that owns the provider row, so this only says what it wants done.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { MODAL_RADIUS } from "@/constants/theme";
import { BadgeCheck, ChevronLeft, Clock, Trash2, Upload } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export type VerificationStatus = "verified" | "pending" | "not_verified";

/** Icon, colour and wording per state. Amber for pending is the same signal
 *  the rest of the app uses for "in progress, nothing wrong" — it must not
 *  read as an error, because waiting is the expected path. */
const STATUS = {
  verified: {
    label: "Verified",
    detail: "You can list products on shopping.",
    color: "#0369A1",
    tint: "#EFF6FF",
    Icon: BadgeCheck,
  },
  pending: {
    label: "Being reviewed",
    detail: "We're checking your document. This usually takes a couple of days.",
    color: "#B45309",
    tint: "#FFFBEB",
    Icon: Clock,
  },
  not_verified: {
    label: "Not uploaded",
    detail: "Upload your license to start listing products on shopping.",
    color: "#6B7280",
    tint: "#F3F4F6",
    Icon: Upload,
  },
} as const;

interface BusinessLicenseProps {
  licenseUrl: string | null;
  verificationStatus: VerificationStatus;
  uploading: boolean;
  onClose: () => void;
  /** Opens the full-screen document viewer. */
  onView: () => void;
  /** Picks a document and uploads it, confirming first if one is already up. */
  onUpload: () => void;
  onRemove: () => void;
}

export default function BusinessLicense({
  licenseUrl,
  verificationStatus,
  uploading,
  onClose,
  onView,
  onUpload,
  onRemove,
}: BusinessLicenseProps) {
  // A document that exists but is marked not_verified was rejected or reset,
  // so the status is what decides the wording, never the presence of a file.
  const status = STATUS[verificationStatus];
  const StatusIcon = status.Icon;

  return (
    <View className="flex-1">
      {/* Nothing here saves from the header — uploading and removing are
          their own confirmed actions. Keep the spacer so the title stays
          optically centred. */}
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <Text className="text-xl font-medium text-gray-900">Business license</Text>
        </View>
        <View className="py-1" style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 }}
      >
        {/* Status first. Which of the three states you are in is the whole
            question this screen answers. */}
        <View
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
          className="bg-white px-4 py-4 flex-row items-start"
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderCurve: "continuous",
              backgroundColor: status.tint,
            }}
            className="items-center justify-center"
          >
            <StatusIcon size={20} color={status.color} strokeWidth={1.9} />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-xl text-gray-900" style={{ color: status.color }}>
              {status.label}
            </Text>
            <Text className="text-base text-gray-400 mt-1" style={{ lineHeight: 20 }}>
              {status.detail}
            </Text>
          </View>
        </View>

        {/* The document itself, shown rather than hidden behind a "View"
            action — the one thing a seller wants to check is that the right
            file went up. */}
        {licenseUrl ? (
          <TouchableOpacity
            onPress={onView}
            activeOpacity={0.85}
            style={{
              borderRadius: MODAL_RADIUS,
              borderCurve: "continuous",
              marginTop: 12,
              overflow: "hidden",
              aspectRatio: 3 / 2,
            }}
            className="bg-white"
          >
            <ProgressiveImage
              uri={licenseUrl}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              showProgress={false}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onUpload}
            activeOpacity={0.7}
            disabled={uploading}
            style={{
              borderRadius: MODAL_RADIUS,
              borderCurve: "continuous",
              marginTop: 12,
              aspectRatio: 3 / 2,
            }}
            className="bg-white items-center justify-center border border-gray-100"
          >
            {uploading ? (
              <CircularLoader size="large" color="#094569" />
            ) : (
              <>
                <Upload size={28} color="#9CA3AF" strokeWidth={1.7} />
                <Text className="text-xl text-gray-400 mt-3">Upload your license</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <Text className="text-base text-gray-400 mt-3 px-1">
          A clear photo or scan of your trade license. Only our review team sees it — it is never
          shown on your business page.
        </Text>

        {/* Actions, as rows in one block like everything else in this stack. */}
        <View
          style={{
            borderRadius: MODAL_RADIUS,
            borderCurve: "continuous",
            marginTop: 20,
            overflow: "hidden",
          }}
          className="bg-white"
        >
          <TouchableOpacity
            onPress={onUpload}
            activeOpacity={0.7}
            disabled={uploading}
            className="px-4 py-4 flex-row items-center"
          >
            {uploading ? (
              <CircularLoader size="small" color="#0369A1" />
            ) : (
              <Upload size={20} color="#0369A1" />
            )}
            <Text className="text-xl ml-3" style={{ color: "#0369A1" }}>
              {licenseUrl ? "Replace document" : "Upload document"}
            </Text>
          </TouchableOpacity>

          {licenseUrl && (
            <TouchableOpacity
              onPress={onRemove}
              activeOpacity={0.7}
              disabled={uploading}
              className="px-4 py-4 flex-row items-center border-t border-gray-100"
            >
              <Trash2 size={20} color="#DC2626" />
              <Text className="text-xl ml-3" style={{ color: "#DC2626" }}>
                Remove document
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text className="text-base text-gray-400 mt-3 px-1">
          {/* Says what is lost, not just what happens — "resets verification"
              means nothing until you know it takes products down. */}
          Replacing the document sends it back for review. Removing it clears your verification, and
          your products stop appearing on shopping until a new license is approved. Your services
          and marketplace listings are unaffected.
        </Text>
      </ScrollView>
    </View>
  );
}
