/**
 * Settings › How Namzoed works — the tours, on demand.
 *
 * This replaced a carousel of captioned screenshots, and the reason is the
 * thing the carousel could never do: every one of these runs **on the real
 * screen**, points at the real control and waits for you to use it. So the
 * list here is not the tutorial — it is a way back into one, and pressing a
 * row closes Settings and drops you where that tour lives.
 *
 * A tour that has been run all the way through says so. Nothing is locked,
 * nothing is ordered, and "Show the tips again" undoes both the ones that
 * were finished and a Skip held down until it turned them all off.
 */

import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import Mascot from "@/components/ui/Mascot";
import { useTutorial } from "@/contexts/TutorialContext";
import { TOURS, TOUR_ORDER, type TourId } from "@/lib/tutorialTours";
import { useAppRouter } from "@/utils/navigation";
import {
  BadgeCheck,
  Check,
  Hand,
  KeyRound,
  Plus,
  RotateCcw,
  ShoppingBag,
  SquarePen,
  Store,
  Video,
} from "lucide-react-native";
import React from "react";
import { ScrollView, Text, View } from "react-native";

interface TutorialsProps {
  onClose?: () => void;
}

/** One icon per tour, and where the tour actually happens — a row that
 *  started a tour on the wrong screen would spotlight nothing. */
const TOUR_META: Record<
  TourId,
  {
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    /** Where to send the user before it starts. */
    go?: string;
  }
> = {
  create: { icon: Plus, go: "/(users)/(tabs)" },
  post: { icon: SquarePen, go: "/(users)/(tabs)" },
  setlog: { icon: Video, go: "/(users)/(tabs)/messages" },
  product: { icon: ShoppingBag, go: "/(users)/(tabs)" },
  marketplace: { icon: Store, go: "/(users)/(tabs)/marketplace" },
  business: { icon: BadgeCheck, go: "/(users)/profile/work" },
  contextdrop: { icon: Hand, go: "/(users)/(tabs)" },
};

export default function Tutorials({ onClose }: TutorialsProps) {
  const router = useAppRouter();
  const { startTour, isDone, resetTours, tipsOff } = useTutorial();

  const run = (id: TourId) => {
    const meta = TOUR_META[id];
    onClose?.();
    if (meta.go) router.push(meta.go as any);
    // The tour points at controls on that screen, so it starts once the
    // screen it belongs to is the one in front — a spotlight on a screen
    // still sliding in lands on nothing.
    setTimeout(() => startTour(id), 420);
  };

  return (
    <SettingsScreen title="How Namzoed works" onClose={onClose}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* The mongoose is the one who does the walking, so it introduces
            the list — and pulls a face when it has been told to stop. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 4,
            paddingTop: 2,
            paddingBottom: 14,
          }}
        >
          <Mascot mood={tipsOff ? "sad" : "excited"} size={56} />
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: "#6B7280" }}>
            {tipsOff
              ? "Tips are switched off, so none of these will turn up on their own. You can still run any of them from here."
              : "Each of these runs on the real screen and waits for you to press the thing it points at."}
          </Text>
        </View>

        <SettingsGroup label="Walk me through it">
          {TOUR_ORDER.map((id, i) => {
            const tour = TOURS[id];
            const done = isDone(id);
            return (
              <SettingsRow
                key={id}
                first={i === 0}
                icon={TOUR_META[id].icon}
                label={tour.title}
                description={tour.blurb}
                onPress={() => run(id)}
                right={
                  done ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Check size={18} color="#0369A1" strokeWidth={2.4} />
                    </View>
                  ) : undefined
                }
              />
            );
          })}
        </SettingsGroup>

        <SettingsGroup label="Tips">
          <SettingsRow
            first
            icon={RotateCcw}
            label="Show the tips again"
            description="Offer every walkthrough the next time you reach it"
            onPress={resetTours}
          />
          <SettingsRow
            icon={KeyRound}
            label="How they behave"
            description="A tip waits for you to press the thing it points at. Skip ends one; holding Skip turns them all off."
          />
        </SettingsGroup>
      </ScrollView>
    </SettingsScreen>
  );
}
