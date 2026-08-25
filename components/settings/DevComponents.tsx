/**
 * DevComponents ("DevComp")
 *
 * Dev-only playground for previewing shared UI elements — loading
 * indicators, popups, overlays — in their different states without having
 * to dig up real data to trigger them. Only reachable from Settings when
 * __DEV__ is true (see ProfileSettings.tsx) — never shown in a prod bundle.
 *
 * Add new sections here as more reusable components need a place to preview
 * their states: a SectionHeader + a row of trigger buttons is the pattern.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import LoadingBar from "@/components/ui/LoadingBar";
import PopupMessage from "@/components/ui/PopupMessage";
import PostFeedbackOverlay from "@/components/modals/PostFeedbackOverlay";
import PostGridReportOverlay from "@/components/modals/PostGridReportOverlay";
import { ArrowLeft, FlaskConical } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface Props {
  onClose: () => void;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 12, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.6, color: "#9ca3af" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function Swatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      {children}
      <Text style={{ fontSize: 11, color: "#6b7280" }}>{label}</Text>
    </View>
  );
}

function TriggerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#f3f4f6",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#111" }}>{label}</Text>
    </TouchableOpacity>
  );
}

type PopupKind = "success" | "error" | "warning" | "white" | null;

export default function DevComponents({ onClose }: Props) {
  const [popup, setPopup] = useState<PopupKind>(null);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f0f0f0",
        }}
      >
        <TouchableOpacity onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
          <ArrowLeft size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111", letterSpacing: 0.4 }}>
            Dev Components
          </Text>
          <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
            UI playground — dev builds only
          </Text>
        </View>
        <FlaskConical size={18} color="#7c3aed" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Circular loader ─────────────────────────────── */}
        <SectionHeader
          title="LOADING — CIRCULAR"
          subtitle="Standard indeterminate spinner, used everywhere except video buffering"
        />
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 24 }}>
          <Swatch label='size="small"'>
            <CircularLoader size="small" />
          </Swatch>
          <Swatch label='size="large"'>
            <CircularLoader size="large" />
          </Swatch>
          <Swatch label="custom color">
            <CircularLoader size="large" color="#EDC06D" />
          </Swatch>
          <Swatch label="on dark">
            <View style={{ backgroundColor: "#111", padding: 10, borderRadius: 8 }}>
              <CircularLoader size="small" color="#fff" />
            </View>
          </Swatch>
        </View>

        {/* ── Horizontal loading bar (video buffering) ────── */}
        <SectionHeader
          title="LOADING — VIDEO BUFFERING BAR"
          subtitle="Center-out pulse — lives on the video's own timeline/scrubber, not floating over it"
        />
        <View style={{ gap: 14, marginBottom: 24 }}>
          <View>
            <Text style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Standalone</Text>
            <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
              <LoadingBar size="small" />
              <LoadingBar size="large" />
            </View>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
              On a mock video scrubber (as in ReelsViewer)
            </Text>
            <View
              style={{
                backgroundColor: "#000",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <LoadingBar height={2.5} style={{ width: "100%" }} />
            </View>
          </View>
        </View>

        {/* ── Popups ───────────────────────────────────────── */}
        <SectionHeader
          title="POPUPS"
          subtitle="Tap to preview each PopupMessage variant"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton label="Success" onPress={() => setPopup("success")} />
          <TriggerButton label="Error" onPress={() => setPopup("error")} />
          <TriggerButton label="Warning" onPress={() => setPopup("warning")} />
          <TriggerButton label="White" onPress={() => setPopup("white")} />
        </View>

        {/* ── Post overlays ────────────────────────────────── */}
        <SectionHeader
          title="POST OVERLAYS"
          subtitle="Long-press feedback overlays used on posts"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
          <TriggerButton
            label="Post detail — Report overlay"
            onPress={() => setShowFeedbackOverlay(true)}
          />
          <TriggerButton
            label="Grid card — Report overlay"
            onPress={() => setShowGridOverlay(true)}
          />
        </View>

        {showFeedbackOverlay && (
          <View
            style={{
              width: "100%",
              aspectRatio: 4 / 5,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#334155",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <PostFeedbackOverlay
              visible={showFeedbackOverlay}
              onClose={() => setShowFeedbackOverlay(false)}
              onReport={() => setShowFeedbackOverlay(false)}
            />
          </View>
        )}

        {showGridOverlay && (
          <View
            style={{
              width: 180,
              aspectRatio: 3 / 4,
              borderRadius: 4,
              overflow: "hidden",
              backgroundColor: "#94a3b8",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <PostGridReportOverlay
              visible={showGridOverlay}
              onClose={() => setShowGridOverlay(false)}
              onReport={() => setShowGridOverlay(false)}
            />
          </View>
        )}

        {/* Footer note */}
        <View
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: 12,
            backgroundColor: "#faf5ff",
            borderWidth: 1,
            borderColor: "#ede9fe",
          }}
        >
          <Text style={{ fontSize: 11, color: "#7c3aed", lineHeight: 17 }}>
            Add new sections here as more shared components need a place to preview their
            states — a SectionHeader + a row of TriggerButtons is the pattern.
          </Text>
        </View>
      </ScrollView>

      <PopupMessage
        visible={popup !== null}
        type={popup ?? "white"}
        message={
          popup === "success"
            ? "Everything worked."
            : popup === "error"
              ? "Something went wrong."
              : popup === "warning"
                ? "Heads up — check this."
                : "Just a message."
        }
        onHide={() => setPopup(null)}
      />
    </View>
  );
}
