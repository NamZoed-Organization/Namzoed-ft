/**
 * The tutorial overlay, on a screen made of nothing but its targets.
 *
 * What needs judging here is a thing you otherwise only see once per
 * account, on your very first run, and then never again without clearing
 * storage: the ring around a control, where the card lands relative to it,
 * whether a step that waits for a press reads differently from one that
 * only explains, and what the whole thing looks like over a control at the
 * bottom of the screen versus one at the top.
 *
 * It runs the **real** tour through the **real** overlay — the three
 * buttons register the same anchor ids the app's own controls do, so the
 * steps, the copy and the advance rules are the ones that ship. A mock of
 * the overlay would only tell you the mock renders.
 */

import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import { useTutorial } from "@/contexts/TutorialContext";
import { TOURS, TOUR_ORDER, type TourId } from "@/lib/tutorialTours";
import { ChevronLeft, Plus, ShoppingBag, SquarePen, Video } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 16;

/** The anchors this fixture can stand in for, by tour. Every id here is one
 *  a real screen also registers — see the tour definitions. */
const FIXTURE_ANCHORS: Record<TourId, string[]> = {
  create: ["create.plus", "create.post", "create.product", "create.setlog"],
  post: ["post.media", "post.caption", "post.tag", "post.share"],
  setlog: ["setlog.camera", "setlog.day", "setlog.squad"],
  product: ["product.photos", "product.price"],
  marketplace: ["marketplace.photos", "marketplace.details"],
  business: ["business.identity", "business.details", "business.license"],
  contextdrop: ["contextdrop.surface"],
};

const ICONS = [Plus, SquarePen, ShoppingBag, Video];

interface TutorialPreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function TutorialPreview({ visible, onClose }: TutorialPreviewProps) {
  const insets = useSafeAreaInsets();
  const { startTour, skip, tour } = useTutorial();
  const [which, setWhich] = useState<TourId>("create");

  // Leaving the preview must not leave a tour running over the app behind
  // it — the overlay is mounted here, but the tour itself is global.
  useEffect(() => {
    if (!visible && tour) skip();
  }, [skip, tour, visible]);

  const anchors = FIXTURE_ANCHORS[which];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
        {/* The preview's own way out — not part of any design. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              skip();
              onClose();
            }}
            style={{ padding: 4 }}
          >
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GROUP_INSET,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: "#9CA3AF",
              paddingHorizontal: 4,
              paddingBottom: 12,
            }}
          >
            Stand-ins for the controls {TOURS[which].title.toLowerCase()} points at,
            registered under the same anchor ids the real screens use. Press Run,
            then do what the card says — the steps that wait for an action are
            waiting for these.
          </Text>

          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              borderCurve: "continuous",
              overflow: "hidden",
              padding: 12,
              gap: 12,
            }}
          >
            {anchors.map((id, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <TutorialAnchor key={id} id={id} radius={14}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: "#F5F5F5",
                      borderRadius: 14,
                      borderCurve: "continuous",
                      paddingHorizontal: 14,
                      paddingVertical: 16,
                    }}
                  >
                    <Icon size={20} color="#111" strokeWidth={1.8} />
                    <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
                      {id}
                    </Text>
                  </View>
                </TutorialAnchor>
              );
            })}
          </View>

          {/* A target at the very bottom of the scroll, so the card's
              "flip above the hole" rule can be seen doing it. */}
          <View style={{ height: 320 }} />
          <TutorialAnchor id={anchors[0]} radius={22}>
            <View
              style={{
                height: 44,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: "#EDC06D",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#0A0A0A" }}>
                Same id, low on the screen
              </Text>
            </View>
          </TutorialAnchor>
        </ScrollView>

        {/* Fixture switches, pinned to the bottom — not part of the design. */}
        <View
          style={{
            paddingHorizontal: GROUP_INSET,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            backgroundColor: "#EDEDED",
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TOUR_ORDER.map((id) => (
              <TouchableOpacity
                key={id}
                onPress={() => {
                  skip();
                  setWhich(id);
                }}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderCurve: "continuous",
                  marginRight: 8,
                  backgroundColor: which === id ? "#094569" : "#fff",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: which === id ? "#fff" : "#6B7280",
                  }}
                >
                  {TOURS[id].title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            // Marked as *not* seen: looking at a tour here must not use up
            // its one automatic airing on this device.
            onPress={() => startTour(which, { markSeen: false })}
            activeOpacity={0.85}
            style={{
              marginTop: 10,
              backgroundColor: "#094569",
              borderRadius: 999,
              borderCurve: "continuous",
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
              Run it
            </Text>
          </TouchableOpacity>
        </View>

        {/* This preview is its own Modal window, so it hosts the overlay. */}
        <TutorialOverlay hostId="tutorial-preview" />
      </View>
    </Modal>
  );
}
