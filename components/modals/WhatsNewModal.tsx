/**
 * WhatsNewModal
 *
 * Full-screen modal that showcases the current release's new features.
 * Opened either:
 *   - automatically once per new version, via WhatsNewGate, or
 *   - manually, any time, from Settings → About → "What's New".
 *
 * Usage
 * ─────
 *   <WhatsNewModal visible={show} onClose={() => setShow(false)} />
 */

import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { WHATS_NEW_RELEASES } from "@/constants/whatsNew";

export interface WhatsNewModalProps {
  /** Whether the modal is currently visible. */
  visible: boolean;
  /** Called when the user dismisses the modal (close button or CTA). */
  onClose: () => void;
}

/** Convert a 6-digit hex colour to an rgba() string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function WhatsNewModal({ visible, onClose }: WhatsNewModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>What&apos;s New</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#6B7280" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ── Releases ────────────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {WHATS_NEW_RELEASES.map((release, idx) => {
            const outerCircleBg = hexToRgba(release.accentColor, 0.12);
            const innerCircleBg = hexToRgba(release.accentColor, 0.2);
            return (
              <View key={release.version} style={styles.releaseSection}>
                <View style={styles.releaseHeaderRow}>
                  <View
                    style={[
                      styles.versionBadge,
                      { backgroundColor: release.accentColor },
                    ]}
                  >
                    <Text style={styles.versionBadgeText}>
                      v{release.version}
                    </Text>
                  </View>
                  <Text style={styles.releaseDate}>{release.date}</Text>
                </View>

                {release.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <View key={item.title} style={styles.itemRow}>
                      <View
                        style={[styles.iconOuter, { backgroundColor: outerCircleBg }]}
                      >
                        <View
                          style={[styles.iconInner, { backgroundColor: innerCircleBg }]}
                        >
                          <ItemIcon
                            size={22}
                            color={release.accentColor}
                            strokeWidth={1.8}
                          />
                        </View>
                      </View>
                      <View style={styles.itemText}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemDescription}>
                          {item.description}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {idx < WHATS_NEW_RELEASES.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.ctaRow,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.ctaButton,
              { backgroundColor: WHATS_NEW_RELEASES[0]?.accentColor ?? "#094569" },
            ]}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },

  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Montserrat-Bold",
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },

  releaseSection: {
    marginBottom: 8,
  },
  releaseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  versionBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  versionBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Montserrat-Bold",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  releaseDate: {
    fontSize: 13,
    fontFamily: "Montserrat-Medium",
    fontWeight: "500",
    color: "#9CA3AF",
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 22,
  },
  iconOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    flex: 1,
    paddingTop: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: "Montserrat-SemiBold",
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    fontFamily: "Montserrat-Regular",
    fontWeight: "400",
    color: "#6B7280",
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginTop: 8,
    marginBottom: 24,
  },

  ctaRow: {
    paddingTop: 8,
  },
  ctaButton: {
    paddingVertical: 15,
    borderRadius: 999,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaButtonText: {
    fontSize: 15,
    fontFamily: "Montserrat-Bold",
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
