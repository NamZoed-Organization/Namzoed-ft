// app/(users)/settings/index.tsx
import {
  AboutApp,
  AboutNamzoed,
  AccountSettings,
  AppVersion,
  AppearanceManager,
  ChangePassword,
  CommunityGuidelines,
  DataStorage,
  DeleteAccount,
  DeviceManagement,
  DevComponents,
  EditBio,
  EditBirthday,
  EditLocation,
  EditName,
  EditProfile,
  EditWorkProfile,
  GeneralSettings,
  HelpCenter,
  LanguageRegion,
  NotificationSettings,
  PrivacyPolicy,
  PrivacySettings,
  SavedPosts,
  SellerPolicy,
  SendFeedback,
  SupportSettings,
  TermsOfService,
  Tutorials,
} from "@/components/settings";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/settings/SettingsChrome";
import {
  Bell,
  ChevronLeft,
  FlaskConical,
  HardDrive,
  Headset,
  Info,
  Lock,
  SlidersHorizontal,
  UserCog,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useUser } from "@/contexts/UserContext";
import { useAppRouter } from "@/utils/navigation";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WhatsNewModal from "@/components/modals/WhatsNewModal";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import SubPageLayer, {
  SUB_PAGE_SLIDE_MS,
} from "@/components/settings/SubPageLayer";
import {
  makeMutable,
  runOnJS,
  SharedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Full-screen replacement for the old bottom-sheet ProfileSettings modal —
// same section list + nested sub-page slide mechanic, just under a real
// route with a chevron-left back button instead of a draggable sheet.
// Jump straight to a sub-page (e.g. from the hamburger drawer, or the
// profile header's Edit Profile / Appearance-badge taps) via ?modal=<name>.
/** One level of the nested sub-page stack, with the value that slides it. */
interface SubPage {
  name: string;
  anim: SharedValue<number>;
}

/** The hamburger drawer's ground (components/modals/HamburgerMenu.tsx) —
 *  the root list and every settings area are built to match it: white
 *  rounded groups on grey, hairline separators, black icons. */
const MENU_BACKGROUND = "#f5f5f5";
/** The standard form screens' ground (UI_STANDARD.md) — bg-gray-50. */
const FORM_BACKGROUND = "#F9FAFB";

// Each sub-page's own ground, so the container behind it (which is what
// shows through behind the status bar) paints the same color. Grouping the
// two families under one flag was close enough to look right and wrong
// enough to see: the settings areas are #f5f5f5, the form screens #F9FAFB,
// and the strip above them was painted with the other one's grey.
const SUB_PAGE_BACKGROUNDS: Record<string, string> = {
  account: MENU_BACKGROUND,
  deviceManagement: MENU_BACKGROUND,
  general: MENU_BACKGROUND,
  notifications: MENU_BACKGROUND,
  privacy: MENU_BACKGROUND,
  support: MENU_BACKGROUND,
  about: MENU_BACKGROUND,
  // The legal documents now sit on the same grey as the settings lists, so
  // the layer beneath them has to as well — otherwise a white strip shows
  // behind the status bar and through the slide.
  privacyPolicy: MENU_BACKGROUND,
  termsOfService: MENU_BACKGROUND,
  editProfile: FORM_BACKGROUND,
  editBio: FORM_BACKGROUND,
  editName: FORM_BACKGROUND,
  editBirthday: FORM_BACKGROUND,
  editLocation: FORM_BACKGROUND,
};

/** Anything not listed above is a plain white sub-page. */
const subPageBackground = (name: string | null | undefined) =>
  (name != null ? SUB_PAGE_BACKGROUNDS[name] : undefined) ?? "#fff";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const { currentUser, logout } = useUser();
  const { modal: initialModal } = useLocalSearchParams<{ modal?: string }>();

  const screenWidth = Dimensions.get("window").width;

  // Each level of the stack owns the shared value that slides it, created
  // when it's pushed and thrown away with it. A single value moved between
  // containers instead: when the top page popped, the one below it inherited
  // that value while the native side still held the off-screen offset from
  // the slide-out, so it mounted at translateX = screenWidth and sat there
  // blank until some unrelated gesture forced a re-layout. A page that never
  // moves now never has its transform touched.
  //
  // makeMutable rather than useSharedValue: these are created in an event
  // handler when a page is pushed, which is not somewhere a hook can run.
  const [modalStack, setModalStack] = useState<SubPage[]>(() =>
    initialModal ? [{ name: initialModal, anim: makeMutable(0) }] : [],
  );
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const { markSeen: markWhatsNewSeen } = useWhatsNew();

  const isAnimating = useRef(false);
  // Mirrored into a shared value so the drag gesture (UI thread) can check it
  // without hopping to JS.
  const animatingShared = useSharedValue(false);
  const isAnimatingWorklet = useCallback(() => {
    "worklet";
    return animatingShared.value;
  }, [animatingShared]);

  const activeModal = modalStack[modalStack.length - 1]?.name ?? null;
  // Arrived on a sub-page directly, rather than browsing to it from the
  // settings list — see the root list's own comment below.
  const openedDirectlyToSubPage = !!initialModal && modalStack.length > 0;
  // Back at the bottom of the stack means leaving Settings altogether, so
  // the route's own edge swipe should handle it — it reveals the screen
  // underneath, which an in-screen drag can't. Only levels above that get
  // the per-page drag.
  const routeOwnsBack =
    modalStack.length === 0 || (modalStack.length === 1 && !!initialModal);

  // Worklet callbacks hop back to JS through these, so they have to be
  // stable functions rather than inline closures.
  const setAnimating = useCallback(
    (value: boolean) => {
      isAnimating.current = value;
      animatingShared.value = value;
    },
    [animatingShared],
  );
  const clearAnimating = useCallback(() => setAnimating(false), [setAnimating]);
  const popStack = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, []);

  const handleNavigation = (modalName: string) => {
    if (isAnimating.current) return;
    if (activeModal === modalName) return;
    setAnimating(true);
    // Starts off-screen right and slides in; the page it covers keeps its
    // own value, untouched at 0.
    const anim = makeMutable(screenWidth);
    setModalStack((prev) => [...prev, { name: modalName, anim }]);
    anim.value = withTiming(0, { duration: SUB_PAGE_SLIDE_MS }, (finished) => {
      if (finished) runOnJS(clearAnimating)();
    });
  };

  const closeActiveModal = useCallback((animated = true) => {
    // Arrived directly at a sub-page (e.g. "Edit Profile" from the profile
    // header) with nothing else on the stack — leave the screen entirely
    // instead of revealing the root settings list the user never browsed to.
    if (modalStack.length === 1 && initialModal) {
      router.back();
      return;
    }
    if (isAnimating.current) return;
    const top = modalStack[modalStack.length - 1];
    if (!top) return;
    // The swipe gesture has already carried the page off-screen, so the
    // slide-out below would play a second time over nothing.
    if (!animated) {
      popStack();
      return;
    }
    setAnimating(true);
    // Only the page being dismissed moves. Whatever it uncovers is already
    // sitting at 0 and stays there, so there's no value to reset afterwards.
    top.anim.value = withTiming(
      screenWidth,
      { duration: SUB_PAGE_SLIDE_MS },
      (finished) => {
        runOnJS(clearAnimating)();
        if (finished) runOnJS(popStack)();
      },
    );
  }, [modalStack, initialModal, router, screenWidth, setAnimating, clearAnimating, popStack]);

  // Android hardware back: pop the nested sub-page first; otherwise fall
  // through to the default screen-back behaviour.
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modalStack.length > 0) {
        closeActiveModal();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [modalStack, closeActiveModal]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const renderModalContent = (name: string | null) => {
    switch (name) {
      case "editProfile":
        return (
          <EditProfile onClose={closeActiveModal} onNavigate={handleNavigation} />
        );
      case "editBio":
        return <EditBio onClose={closeActiveModal} />;
      case "editName":
        return <EditName onClose={closeActiveModal} />;
      case "editBirthday":
        return <EditBirthday onClose={closeActiveModal} />;
      case "editLocation":
        return <EditLocation onClose={closeActiveModal} />;
      case "editWorkProfile":
        return (
          <EditWorkProfile onClose={closeActiveModal} onSaved={() => router.back()} />
        );
      case "appearance":
        return (
          <AppearanceManager onClose={closeActiveModal} userId={currentUser?.id} />
        );
      case "savedPosts":
        return (
          <SavedPosts onClose={closeActiveModal} userId={currentUser?.id} />
        );
      case "changePassword":
        return <ChangePassword onClose={closeActiveModal} />;
      case "privacyPolicy":
        return <PrivacyPolicy onClose={closeActiveModal} />;
      case "sellerPolicy":
        return <SellerPolicy onClose={closeActiveModal} />;
      case "termsOfService":
        return <TermsOfService onClose={closeActiveModal} />;
      case "communityGuidelines":
        return <CommunityGuidelines onClose={closeActiveModal} />;
      case "account":
        return (
          <AccountSettings onClose={closeActiveModal} onNavigate={handleNavigation} />
        );
      case "deviceManagement":
        return <DeviceManagement onClose={closeActiveModal} />;
      case "general":
        return (
          <GeneralSettings onClose={closeActiveModal} onNavigate={handleNavigation} />
        );
      case "notifications":
        return <NotificationSettings onClose={closeActiveModal} />;
      case "privacy":
        return (
          <PrivacySettings onClose={closeActiveModal} onNavigate={handleNavigation} />
        );
      case "support":
        return (
          <SupportSettings onClose={closeActiveModal} onNavigate={handleNavigation} />
        );
      case "about":
        return (
          <AboutNamzoed onClose={closeActiveModal} onNavigate={handleNavigation} />
        );
      case "sendFeedback":
        return <SendFeedback onClose={closeActiveModal} />;
      case "whatsNew":
        return <AppVersion onClose={closeActiveModal} />;
      case "dataStorage":
        return <DataStorage onClose={closeActiveModal} />;
      case "languageRegion":
        return <LanguageRegion onClose={closeActiveModal} />;
      case "helpCenter":
        return <HelpCenter onClose={closeActiveModal} />;
      case "deleteAccount":
        return (
          <DeleteAccount
            onClose={closeActiveModal}
            onAccountDeleted={async () => {
              await logout();
              router.replace("/login");
            }}
          />
        );
      case "appVersion":
        return <AppVersion onClose={closeActiveModal} />;
      case "aboutApp":
        return <AboutApp onClose={closeActiveModal} />;
      case "tutorials":
        return <Tutorials onClose={closeActiveModal} />;
      case "devComponents":
        return <DevComponents onClose={closeActiveModal} />;
      default:
        return null;
    }
  };

  return (
    <View
      className="flex-1"
      style={{
        // Follows whatever is actually on top: a standard-form sub-page's
        // grey, a plain sub-page's white, or — with none open — the root
        // list's own ground, so the color runs behind the status bar
        // instead of stopping at a strip above it.
        backgroundColor: activeModal
          ? subPageBackground(activeModal)
          : MENU_BACKGROUND,
        paddingTop: insets.top,
      }}
    >
      {/* This screen can stay mounted below others that set their own
          light-content bar (e.g. the profile screen it's pushed from) — the
          last-mounted StatusBar wins in RN, so pin this one to dark-content
          explicitly instead of relying on the global default. */}
      {/* The route's own edge swipe pops all of /settings at once — right
          from the root list, wrong from a sub-page, where it skipped every
          level and landed back wherever Settings was opened from. It's
          handed to the per-page swipe below whenever the stack has
          something on it. */}
      <Stack.Screen options={{ gestureEnabled: routeOwnsBack }} />
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 relative overflow-hidden">
        {/* 1. ROOT SETTINGS LIST

            Skipped entirely when the screen was opened straight onto a
            sub-page (?modal=editProfile from the profile header, say):
            closeActiveModal leaves the route in that case rather than
            popping to this list, so it can never be reached — and not
            mounting it means it can't surface during a transition either. */}
        {!openedDirectlyToSubPage && (
          <View className="flex-1" style={{ backgroundColor: MENU_BACKGROUND }}>
            {/* Header */}
            <View className="flex-row items-center px-3 pb-3 pt-1">
              <TouchableOpacity onPress={() => router.back()} className="p-1 mr-1">
                <ChevronLeft size={26} color="#111827" />
              </TouchableOpacity>
              <Text className="text-[17px] font-semibold text-gray-900">
                Settings
              </Text>
            </View>

            {/* One row per area, each opening its own screen — the areas
                themselves hold the individual switches and links, so this
                list stays short enough to take in at a glance. */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingTop: 6,
                paddingBottom: 16,
              }}
            >
              <SettingsGroup>
                <SettingsRow
                  first
                  icon={UserCog}
                  label="Account"
                  description="Sign-in methods, devices, delete account"
                  onPress={() => handleNavigation("account")}
                />
                <SettingsRow
                  icon={SlidersHorizontal}
                  label="General"
                  description="Text size, appearance, language"
                  onPress={() => handleNavigation("general")}
                />
                <SettingsRow
                  icon={Bell}
                  label="Notifications"
                  description="What you get notified about"
                  onPress={() => handleNavigation("notifications")}
                />
                <SettingsRow
                  icon={Lock}
                  label="Privacy"
                  description="Safe View and content controls"
                  onPress={() => handleNavigation("privacy")}
                />
                <SettingsRow
                  icon={HardDrive}
                  label="Storage"
                  description="Cached media and data use"
                  onPress={() => handleNavigation("dataStorage")}
                />
              </SettingsGroup>

              <SettingsGroup>
                <SettingsRow
                  first
                  icon={Headset}
                  label="Help Center"
                  description="Guides, tutorials and support"
                  onPress={() => handleNavigation("support")}
                />
                <SettingsRow
                  icon={Info}
                  label="About Namzoed"
                  description="Version, updates and policies"
                  onPress={() => handleNavigation("about")}
                />
              </SettingsGroup>

              {/* Developer Section — dev builds only */}
              {__DEV__ && (
                <SettingsGroup label="Developer">
                  <SettingsRow
                    first
                    icon={FlaskConical}
                    label="DevComp"
                    description="UI playground — loading states, popups, overlays"
                    onPress={() => handleNavigation("devComponents")}
                  />
                </SettingsGroup>
              )}

              {/* Log out — centered and on its own, away from the rows, so
                  it can't be hit while scanning the list. */}
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.7}
                style={{ borderRadius: 18, borderCurve: "continuous" }}
                className="bg-white py-4 items-center mt-2"
              >
                <Text className="text-[15.5px] font-semibold text-[#DC2626]">
                  Log out
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* 2. NESTED SUB-PAGES (EACH SLIDES OVER THE ONE BELOW)

            One container per level of the stack, all kept mounted, with only
            the top one carrying the slide transform. Rendering just the
            active page (plus a separate copy of the one below it) meant a
            page moved between containers on every push and pop, so it
            unmounted and remounted mid-transition — that remount painted an
            empty first frame, and the animated container briefly sat at its
            pre-animation offset, letting the root settings list show through.
            Both read as a flash of the wrong screen. Keying by depth keeps
            each level's instance alive across the transition instead. */}
        {modalStack.map((page, index) => (
          <SubPageLayer
            // Depth, not name: the instance at a given level survives its
            // neighbours being pushed and popped above it.
            key={index}
            anim={page.anim}
            isTop={index === modalStack.length - 1}
            swipeEnabled={index === modalStack.length - 1 && !routeOwnsBack}
            zIndex={30 + index}
            backgroundColor={subPageBackground(page.name)}
            paddingBottom={insets.bottom}
            isAnimating={isAnimatingWorklet}
            onSwipedBack={() => closeActiveModal(false)}
          >
            {renderModalContent(page.name)}
          </SubPageLayer>
        ))}
      </View>

      <WhatsNewModal
        visible={showWhatsNew}
        onClose={() => {
          setShowWhatsNew(false);
          void markWhatsNewSeen();
        }}
      />
    </View>
  );
}
