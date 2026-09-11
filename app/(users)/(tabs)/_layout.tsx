import { HomeIcon, ShoppingIcon } from "@/components/icons/index";
import LiquidCreateMenu, {
  type CreateOptionKey,
} from "@/components/create/LiquidCreateMenu";
import FloatingTabBar from "@/components/ui/FloatingTabBar";
import CircularLoader from "@/components/ui/CircularLoader";
import TabBarButton from "@/components/ui/TabBarButton";
import { TabBarScrollProvider } from "@/contexts/TabBarScrollContext";
import { useUser } from "@/contexts/UserContext";
import { useTutorial } from "@/contexts/TutorialContext";
import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import { TUTORIAL_SCREENS } from "@/lib/tutorialTours";
import { Actions, Elements, Features, Screens, trackInteraction } from "@/lib/analyticsService";
import { clamp, useResponsive } from "@/utils/responsive";
import { isMongooseUser } from "@/utils/roleCheck";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, StatusBar, Text, View } from "react-native";

const PATHNAME_TO_SCREEN: Record<string, string> = {
  "/": Screens.HOME,
  "/feed": Screens.FEED,
  "/marketplace": Screens.MARKETPLACE,
  "/categories": Screens.CATEGORIES,
  "/services": Screens.SERVICES,
};

export default function UsersTabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading: userLoading } = useUser();
  const { arrive, notify } = useTutorial();
  const prevPathnameRef = useRef<string | null>(null);

  /**
   * The plus tour starts the first time somebody lands on the tabs at all.
   *
   * It is taught here rather than on the home screen because the thing it
   * teaches — the "+" — belongs to this bar, not to whatever is above it,
   * and the bar is on screen from the first frame.
   */
  useEffect(() => {
    if (userLoading || !currentUser) return;
    arrive(TUTORIAL_SCREENS.HOME);
  }, [arrive, currentUser, userLoading]);

  useEffect(() => {
    if (userLoading) return;
    if (currentUser && isMongooseUser(currentUser.email)) {
      router.replace("/mongoose-dashboard");
    }
  }, [currentUser, userLoading, router]);

  // Track tab switches whenever the active pathname changes
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    const screen = PATHNAME_TO_SCREEN[pathname] ?? (pathname.replace(/^\//, "") || Screens.HOME);
    trackInteraction({
      userId: currentUser?.id,
      screen,
      feature: Features.TAB_SWITCH,
      element: Elements.TAB_HOME,
      action: Actions.TAP,
      metadata: { pathname },
    });
  }, [pathname, currentUser?.id]);
  // Tactile tick on every floating-tab-bar press, same as iOS's own
  // segmented-control/tab-bar feedback (selectionAsync, not a heavier
  // impact) — fires on press-in so it lands the instant a finger touches
  // down, matching TabBarButton's no-press-delay Pressable.
  const handleTabPressIn = useCallback(() => {
    Haptics.selectionAsync();
  }, []);
  const renderTabBarButton = useCallback(
    (props: any) => (
      <TabBarButton {...props} android_ripple={null} onPressIn={handleTabPressIn} />
    ),
    [handleTabPressIn],
  );

  const { ms } = useResponsive();
  const sideIconSize = clamp(ms(19), 18, 21);
  const plusCircleSize = clamp(ms(22), 20, 24) + 18;
  const plusIconSize = clamp(ms(22), 20, 24) + 6;

  // ── "+" tab → create menu (Post / Story / Live) ─────────────────────────
  // The "+" tab used to navigate to a full feed screen; it now just opens
  // this sheet, reusing the same lazy-loaded CreatePost/StoryComposer/
  // LiveScrollScreen components the old feed screen did.
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [CreatePostComponent, setCreatePostComponent] =
    useState<React.ComponentType<{ onClose?: () => void }> | null>(null);
  const [createPostLoading, setCreatePostLoading] = useState(false);

  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [StoryComposerComponent, setStoryComposerComponent] =
    useState<React.ComponentType<{ onClose?: () => void }> | null>(null);
  const [storyComposerLoading, setStoryComposerLoading] = useState(false);

  const [showLive, setShowLive] = useState(false);
  const [LiveScrollScreenComponent, setLiveScrollScreenComponent] = useState<React.ComponentType<{
    onClose: () => void;
    openCreateOnMount?: boolean;
  }> | null>(null);
  const [liveScreenLoading, setLiveScreenLoading] = useState(false);

  useEffect(() => {
    if (showCreatePost && !CreatePostComponent && !createPostLoading) {
      setCreatePostLoading(true);
      import("@/components/modals/CreatePost")
        .then((m) => {
          setCreatePostComponent(() => m.default);
          setCreatePostLoading(false);
        })
        .catch((err) => {
          console.error("[TabsLayout] Failed to load CreatePost", err);
          setCreatePostLoading(false);
        });
    }
  }, [showCreatePost, CreatePostComponent, createPostLoading]);

  useEffect(() => {
    if (showStoryComposer && !StoryComposerComponent && !storyComposerLoading) {
      setStoryComposerLoading(true);
      import("@/components/modals/StoryComposer")
        .then((m) => {
          setStoryComposerComponent(() => m.default);
          setStoryComposerLoading(false);
        })
        .catch((err) => {
          console.error("[TabsLayout] Failed to load StoryComposer", err);
          setStoryComposerLoading(false);
        });
    }
  }, [showStoryComposer, StoryComposerComponent, storyComposerLoading]);

  useEffect(() => {
    if (showLive && !LiveScrollScreenComponent && !liveScreenLoading) {
      setLiveScreenLoading(true);
      import("@/components/livestream/LiveScrollScreen")
        .then((m) => {
          setLiveScrollScreenComponent(() => m.default);
          setLiveScreenLoading(false);
        })
        .catch((err) => {
          console.error("[TabsLayout] Failed to load LiveScrollScreen", err);
          setLiveScreenLoading(false);
        });
    }
  }, [showLive, LiveScrollScreenComponent, liveScreenLoading]);

  const openCreateMenu = useCallback(() => {
    setCreateMenuOpen(true);
    // The step about the plus ends here — when the plus was actually
    // pressed, not when a Next was.
    notify("create.menu-opened");
  }, [notify]);

  // The menu closes itself — it runs the liquid back into the button before
  // calling this, so nothing here touches createMenuOpen.
  const handleCreateSelect = useCallback(
    (key: CreateOptionKey) => {
      switch (key) {
        case "post":
          setShowCreatePost(true);
          return;
        case "story":
          setShowStoryComposer(true);
          return;
        case "product":
          // Not the bare form: the screen that holds everything you have
          // listed, opened on the half you actually sell on
          // (app/(users)/listings.tsx). Putting something up and finding
          // what you put up are the same job, and the form alone left you
          // nowhere afterwards.
          router.push("/(users)/listings" as any);
          return;
        case "setlog":
          router.push("/(users)/setlog/capture" as any);
          return;
      }
    },
    [router],
  );

  return (
    <View className="flex-1 bg-background">
      {/* Screens pushed on top of these tabs (profile, marketplace/product
          detail, etc.) set their own light-content bar and stay mounted
          underneath when navigated away from — RN's StatusBar merges props
          from every mounted instance rather than strictly by pop order, so
          without this the floating-tab screens can keep showing white/light
          icons even after returning to them. Re-assert dark-content here,
          same fix as the settings screen's EditBio sub-page. */}
      <StatusBar barStyle="dark-content" />
      <TabBarScrollProvider>
      <Tabs
        initialRouteName="index"
        backBehavior="history"
        safeAreaInsets={{ bottom: 0 }}
        // Pre-mount all screens so tab switching is always instant
        {...({ lazy: false } as any)}
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#094569",
          tabBarInactiveTintColor: "#6b7280",
          tabBarIconStyle: { height: 46 },
          animation: "none",
          tabBarBackground: () => null,
          tabBarStyle: {
            backgroundColor: "transparent",
            borderTopWidth: 0,
            borderTopColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            shadowColor: "transparent",
          },
        }}
      >
        {/* Messages — mounted in the tab group for instant navigation; hidden from tab bar */}
        <Tabs.Screen name="messages" options={{ href: null }} />

        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: renderTabBarButton,
            tabBarIcon: ({ focused }) => (
              <HomeIcon focused={focused} size={sideIconSize} />
            ),
          }}
        />

        <Tabs.Screen
          name="categories/index"
          options={{
            title: "Shopping",
            tabBarButton: renderTabBarButton,
            tabBarIcon: ({ focused }) => (
              <ShoppingIcon
                focused={focused || pathname.includes("/categories/")}
                size={sideIconSize}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="feed"
          listeners={{
            tabPress: (e) => {
              // "+" no longer navigates anywhere — it opens the create menu.
              e.preventDefault();
              openCreateMenu();
            },
          }}
          options={{
            title: "Feed",
            tabBarButton: renderTabBarButton,
            tabBarIcon: () => (
              <TutorialAnchor
                id="create.plus"
                radius={plusCircleSize / 2}
                style={{
                  width: plusCircleSize,
                  height: plusCircleSize,
                  borderRadius: plusCircleSize / 2,
                  borderCurve: "continuous",
                  backgroundColor: "#EDC06D",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={plusIconSize} stroke="#0A0A0A" strokeWidth={2} />
              </TutorialAnchor>
            ),
          }}
        />

        <Tabs.Screen
          name="marketplace/index"
          options={{
            title: "Market",
            tabBarButton: renderTabBarButton,
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? "storefront" : "storefront-outline"}
                size={sideIconSize}
                color="#0A0A0A"
              />
            ),
          }}
        />

        <Tabs.Screen
          name="services/index"
          options={{
            title: "Services",
            tabBarButton: renderTabBarButton,
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? "construct" : "construct-outline"}
                size={sideIconSize}
                color="#0A0A0A"
              />
            ),
          }}
        />
      </Tabs>
      </TabBarScrollProvider>

      {/* The "+" does not open a sheet — it becomes the four things it can
          make (components/create/LiquidCreateMenu.tsx). */}
      <LiquidCreateMenu
        visible={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        onSelect={handleCreateSelect}
      />

      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View className="flex-1 bg-background">
          {CreatePostComponent ? (
            <CreatePostComponent onClose={() => setShowCreatePost(false)} />
          ) : (
            <View className="flex-1 items-center justify-center bg-white">
              <CircularLoader size="large" color="#094569" />
              <Text className="mt-3 text-gray-500 text-sm">Loading…</Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={showStoryComposer}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setShowStoryComposer(false)}
      >
        <View className="flex-1 bg-black">
          {StoryComposerComponent ? (
            <StoryComposerComponent onClose={() => setShowStoryComposer(false)} />
          ) : (
            <View className="flex-1 items-center justify-center bg-black">
              <CircularLoader size="large" color="#fff" />
            </View>
          )}
        </View>
      </Modal>

      {showLive && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={() => setShowLive(false)}
        >
          {LiveScrollScreenComponent ? (
            <LiveScrollScreenComponent
              openCreateOnMount
              onClose={() => setShowLive(false)}
            />
          ) : (
            <View className="flex-1 bg-black items-center justify-center">
              <CircularLoader size="large" color="white" />
              <Text className="mt-4 text-white opacity-60">Loading…</Text>
            </View>
          )}
        </Modal>
      )}
    </View>
  );
}
