// components/modals/HamburgerMenu.tsx
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import { useUser } from "@/contexts/UserContext";
import { useAppRouter } from "@/utils/navigation";
import { Bookmark, Briefcase, Headset, Leaf, Settings, Store, UserPlus, Wallet } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: typeof Bookmark;
  label: string;
  pathname: "/settings" | "/profile" | "/norbu-wallet" | "/profile/work";
  params?: Record<string, string>;
}

// Grouped like TikTok's side drawer, but trimmed to destinations that
// actually exist in this app — everything else here (Cart/Orders/Scan/Add
// friends/Creator Center/Drafts) has no screen to send users to. Saved
// Posts / Community Guidelines / Help Center / Settings all live on the
// standalone Settings screen (app/(users)/settings/index.tsx); Manage
// Listings is its own overlay off the Profile screen; Norbu Wallet is its
// own placeholder screen (app/(users)/norbu-wallet.tsx) — replaced the old
// "Norbu" tab that used to live in Home's tab row.
const MENU_GROUPS: MenuItem[][] = [
  [
    // Stands in for a real add-friends flow for now by surfacing pending
    // follow requests (app/(users)/profile/index.tsx's FollowRequests modal,
    // previously opened from a header icon that's since moved into this
    // drawer).
    { icon: UserPlus, label: "+ Add Friends", pathname: "/profile", params: { openFollowRequests: "1" } },
    { icon: Bookmark, label: "Saved Posts", pathname: "/settings", params: { modal: "savedPosts" } },
  ],
  [{ icon: Wallet, label: "Norbu Wallet", pathname: "/norbu-wallet" }],
  [{ icon: Store, label: "Manage Listings", pathname: "/profile", params: { openManageListings: "1" } }],
  // Every profile already has an (initially empty) service_providers row —
  // this is both how you set one up for the first time and how you manage
  // it afterward. Replaces the old "Work" tab on the profile screen, which
  // was dead space for anyone who'd never filled theirs in.
  [{ icon: Briefcase, label: "Work Profile", pathname: "/profile/work" }],
  [{ icon: Leaf, label: "Community Guidelines", pathname: "/settings", params: { modal: "communityGuidelines" } }],
];

const BOTTOM_ACTIONS: MenuItem[] = [
  { icon: Headset, label: "Help center", pathname: "/settings", params: { modal: "helpCenter" } },
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

      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Sign in to access this"
      />
    </Modal>
  );
}
