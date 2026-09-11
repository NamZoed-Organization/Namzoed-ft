// components/modals/HamburgerMenu.tsx
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import { useUser } from "@/contexts/UserContext";
import { useAppRouter } from "@/utils/navigation";
import { Bike, Briefcase, Headset, Leaf, ScanLine, Settings, Store, UserPlus, Wallet } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: typeof Settings;
  label: string;
  pathname:
    | "/settings"
    | "/profile"
    | "/norbu-wallet"
    | "/profile/work"
    | "/add-friends"
    | "/listings"
    | "/mongoose"
    | "/qr-scanner";
  params?: Record<string, string>;
}

// Grouped like TikTok's side drawer, but trimmed to destinations that
// actually exist in this app — everything else here (Cart/Orders/Creator
// Center/Drafts) has no screen to send users to, and anything already one
// tap away somewhere people go anyway (saved posts, on the profile) is not
// worth a second door. Community Guidelines / Help Center / Settings all
// live on the standalone Settings screen (app/(users)/settings/index.tsx); Manage
// Listings is its own screen (app/(users)/listings.tsx), which is also
// where the "+" menu, the Marketplace tab's empty state and both profiles'
// Products tabs send people; Norbu Wallet is its
// own placeholder screen (app/(users)/norbu-wallet.tsx) — replaced the old
// "Norbu" tab that used to live in Home's tab row.
const MENU_GROUPS: MenuItem[][] = [
  [
    // Your QR code, and both directions of the pending handshake
    // (app/(users)/add-friends.tsx). Until that screen existed this stood
    // in for it by surfacing pending follow requests on the profile.
    { icon: UserPlus, label: "+ Add Friends", pathname: "/add-friends" },
    // Saved Posts was here too and is gone: the profile already has a
    // Saved tab, and a drawer entry to somewhere one tap away on a screen
    // people visit anyway is a second door nobody needed.
  ],
  // Spending: the wallet money moves through, and booking a delivery rider
  // (app/(users)/mongoose.tsx) — Mongoose was the second tab on the Messages
  // screen until Setlog took that slot, and a feature with no entry point is
  // a removed feature. One card each was five stacked tiles reading as five
  // unrelated apps; these two belong to the same errand.
  [
    { icon: Wallet, label: "Norbu Wallet", pathname: "/norbu-wallet" },
    { icon: Bike, label: "Mongoose delivery", pathname: "/mongoose" },
  ],
  // Selling: both halves of running something here. Listings goes straight
  // to the screen, not to the profile with a flag on it — it is a place now,
  // and everything that lists something arrives at the same one. Business
  // edits the (initially empty) service_providers row every profile already
  // has: both how you set one up and how you manage it afterward, replacing
  // the old "Work" tab that was dead space for anyone who'd never filled
  // theirs in.
  [
    { icon: Store, label: "Manage Listings", pathname: "/listings" },
    { icon: Briefcase, label: "Business", pathname: "/profile/work" },
  ],
  [{ icon: Leaf, label: "Community Guidelines", pathname: "/settings", params: { modal: "communityGuidelines" } }],
];

const BOTTOM_ACTIONS: MenuItem[] = [
  // Same door as the ScanLine button in the personal profile's top bar
  // (app/(users)/qr-scanner.tsx) — one screen, reached from both. Standing
  // next to someone with a code out is not a reason to go to your own
  // profile first, and the drawer is already open from wherever you are.
  { icon: ScanLine, label: "Scan", pathname: "/qr-scanner" },
  // ?modal=support, not ?modal=helpCenter: "support" is the Help Center hub
  // (components/settings/SupportSettings.tsx) that the Settings list's own
  // "Help Center" row opens, with Help articles / How Namzoed works /
  // Contact us / Send feedback on it. "helpCenter" is the articles page one
  // level inside it, so the drawer used to land a level deeper than the same
  // button in Settings and with no way to reach the rest.
  { icon: Headset, label: "Help center", pathname: "/settings", params: { modal: "support" } },
  { icon: Settings, label: "Settings", pathname: "/settings" },
];

const DRAWER_WIDTH_RATIO = 0.78;

export default function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handlePress = (item: MenuItem) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    onClose();
    router.push({ pathname: item.pathname, params: item.params } as any);
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Full-screen scrim underneath — a flex sibling of the drawer would
            only cover the leftover strip beside it (visibly "cut out" during
            the slide-in), so this is a true absolute-fill layer instead. */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInLeft.duration(260).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutLeft.duration(220).easing(Easing.in(Easing.cubic))}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${DRAWER_WIDTH_RATIO * 100}%`,
            backgroundColor: "#f5f5f5",
            paddingTop: insets.top + 16,
            paddingHorizontal: 12,
            justifyContent: "space-between",
          }}
        >
          <View>
            {MENU_GROUPS.map((group, gi) => (
              <View
                key={gi}
                style={{ backgroundColor: "#fff", borderRadius: 18, marginBottom: 14, overflow: "hidden" }}
              >
                {group.map((item, ii) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => handlePress(item)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderTopWidth: ii === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: "#f0f0f0",
                    }}
                  >
                    <item.icon size={20} color="#111" strokeWidth={1.8} />
                    <Text style={{ marginLeft: 14, fontSize: 15.5, fontWeight: "600", color: "#111" }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-evenly",
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            {BOTTOM_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => handlePress(action)}
                activeOpacity={0.7}
                style={{ alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    borderCurve: "continuous",
                    backgroundColor: "#e9e9e9",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <action.icon size={20} color="#444" strokeWidth={1.8} />
                </View>
                <Text style={{ fontSize: 12, color: "#666", textAlign: "center" }}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Embedded: this drawer is already a native Modal, and nesting a
          second one inside it is the presentation hazard utils/modal.ts
          exists for. */}
      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Sign in to access this"
        embedded
      />
    </Modal>
  );
}
