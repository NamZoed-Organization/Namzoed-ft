/**
 * OnboardingTutorial
 *
 * A full-screen, animated onboarding modal that walks the user through one or
 * both of the app's two tutorial flows:
 *   • "Add Products"  – how to list items on a profile
 *   • "Tag in Posts"  – how to tag products and people in feed posts
 *
 * Usage
 * ─────
 *   <OnboardingTutorial
 *     visible={showTutorial}
 *     mode="all"                   // 'all' | 'addProducts' | 'tagInPosts'
 *     onComplete={() => setShowTutorial(false)}
 *   />
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle2,
  Package,
  PlusCircle,
  Send,
  ShoppingBag,
  SquarePlus,
  Tag,
  User,
  UserPlus,
  X,
} from "lucide-react-native";

import type { TutorialId } from "@/hooks/useOnboardingTutorial";

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Controls which tutorials the modal presents. */
export type TutorialMode = "all" | "addProducts" | "tagInPosts";

export interface OnboardingTutorialProps {
  /** Whether the modal is currently visible. */
  visible: boolean;
  /**
   * `'all'`         → first-time flow showing both tutorials in sequence.
   * `'addProducts'` → replay only the "Add Products" tutorial.
   * `'tagInPosts'`  → replay only the "Tag in Posts" tutorial.
   */
  mode?: TutorialMode;
  /** Called when the user taps "Done" on the last step, or "Skip". */
  onComplete?: () => void;
  /** Alias for onComplete – typically wired up when launching from Settings. */
  onDismiss?: () => void;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface TutorialStep {
  /** lucide-react-native icon component (shown when no image is available). */
  Icon: React.ComponentType<{
    size: number;
    color: string;
    strokeWidth?: number;
  }>;
  title: string;
  description: string;
  /** Optional pro-tip shown in the amber hint box below the description. */
  tip?: string;
  /** Local image asset shown instead of the icon when available. */
  image?: ReturnType<typeof require>;
}

interface TutorialData {
  id: TutorialId;
  /** Short display name used in the pill badge and section pills. */
  name: string;
  /** Hex accent colour for this tutorial's icons, buttons, and highlights. */
  accentColor: string;
  steps: TutorialStep[];
}

// ─── Tutorial Data ────────────────────────────────────────────────────────────

const ADD_PRODUCTS_TUTORIAL: TutorialData = {
  id: "addProducts",
  name: "Add Products",
  accentColor: "#094569",
  steps: [
    {
      Icon: ShoppingBag,
      title: "Sell on Namzoed",
      description:
        "List products directly on your profile and let people discover and buy from you — all in one place.",
    },
    {
      Icon: User,
      title: "Head to Your Profile",
      description:
        "Tap the profile icon in the top navigation bar to open your profile page.",
      tip: "Look for the person icon at the top right or your profile.",
      image: require("@/assets/tutorial/product-tutorial/1.png"),
    },
    {
      Icon: Package,
      title: "Open the Products Tab",
      description:
        "On your profile, switch to the 'Products' tab to view and manage all your listings.",
      image: require("@/assets/tutorial/product-tutorial/2.png"),
    },
    {
      Icon: PlusCircle,
      title: "Create a New Listing",
      description: "Tap the '+ Add Product' button to open the product form.",
      tip: "You can add up to 4 photos per product.",
      image: require("@/assets/tutorial/product-tutorial/3.png"),
    },
    {
      Icon: CheckCircle2,
      title: "Fill in Details & Post",
      description:
        "Add a name, price, category, photos, and tags — then tap 'Post' to publish your product!",
      tip: "Active products can be tagged in your feed posts.",
      image: require("@/assets/tutorial/product-tutorial/4.png"),
    },
  ],
};

const TAG_IN_POSTS_TUTORIAL: TutorialData = {
  id: "tagInPosts",
  name: "Tag in Posts",
  accentColor: "#0369a1",
  steps: [
    {
      Icon: Tag,
      title: "Link Products & People",
      description:
        "Make your posts shoppable and social by tagging your products and mentioning other users.",
    },
    {
      Icon: SquarePlus,
      title: "Open the Post Creator",
      description:
        "Tap the '+' button on the Feed tab to start composing a new post.",
      tip: "You can add photos and videos to your post.",
      image: require("@/assets/tutorial/post-tutorial/1.png"),
    },
    {
      Icon: ShoppingBag,
      title: "Tag Your Products",
      description:
        "In the post editor, tap 'Tag Products' to link your listings — followers can tap to explore and buy.",
      tip: "Only active products appear in the list.",
      image: require("@/assets/tutorial/post-tutorial/4.png"),
    },
    {
      Icon: UserPlus,
      title: "Mention Other Users",
      description:
        "Tap 'Tag People' and search by name or username to mention them in your post.",
      tip: "Tagged users will be notified.",
      image: require("@/assets/tutorial/post-tutorial/5.png"),
    },
    {
      Icon: Send,
      title: "Share & Let People Discover",
      description:
        "Tap 'Share' — tagged products and people will be visible on your post for your followers to tap and explore!",
      image: require("@/assets/tutorial/post-tutorial/4.png"),
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a 6-digit hex colour to an rgba() string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Return the ordered list of tutorials to present for a given mode. */
function buildTutorials(mode: TutorialMode): TutorialData[] {
  if (mode === "addProducts") return [ADD_PRODUCTS_TUTORIAL];
  if (mode === "tagInPosts") return [TAG_IN_POSTS_TUTORIAL];
  return [ADD_PRODUCTS_TUTORIAL, TAG_IN_POSTS_TUTORIAL];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingTutorial({
  visible,
  mode = "all",
  onComplete,
  onDismiss,
}: OnboardingTutorialProps) {
  const insets = useSafeAreaInsets();

  // ── Derived tutorial list ──────────────────────────────────────────────────
  const tutorials = useMemo(() => buildTutorials(mode), [mode]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [currentTutorialIndex, setCurrentTutorialIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // ── Animation refs ─────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Reset to the very beginning each time the modal is opened.
  useEffect(() => {
    if (visible) {
      setCurrentTutorialIndex(0);
      setCurrentStepIndex(0);
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, [visible, fadeAnim, scaleAnim]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentTutorial = tutorials[currentTutorialIndex];
  const currentStep = currentTutorial.steps[currentStepIndex];
  const { accentColor } = currentTutorial;
  const totalSteps = currentTutorial.steps.length;

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isLastTutorial = currentTutorialIndex === tutorials.length - 1;

  // Pre-compute icon circle backgrounds so they update whenever accentColor changes.
  const outerCircleBg = hexToRgba(accentColor, 0.12);
  const innerCircleBg = hexToRgba(accentColor, 0.2);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Call both completion callbacks (they serve the same purpose). */
  const finish = useCallback(() => {
    onComplete?.();
    onDismiss?.();
  }, [onComplete, onDismiss]);

  /**
   * Animate between steps / tutorials:
   * 1. Fade the content area out over 150 ms.
   * 2. Swap state (tutorial index + step index).
   * 3. Fade back in over 250 ms while simultaneously spring-scaling from 0.8 → 1.
   */
  const animateTransition = useCallback(
    (newTutIdx: number, newStepIdx: number) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentTutorialIndex(newTutIdx);
        setCurrentStepIndex(newStepIdx);
        scaleAnim.setValue(0.8);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            stiffness: 200,
            damping: 18,
            mass: 1,
          }),
        ]).start();
      });
    },
    [fadeAnim, scaleAnim],
  );

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      // Advance within the current tutorial.
      animateTransition(currentTutorialIndex, currentStepIndex + 1);
    } else if (!isLastTutorial) {
      // Move to the first step of the next tutorial.
      animateTransition(currentTutorialIndex + 1, 0);
    } else {
      // All done.
      finish();
    }
  }, [
    isLastStep,
    isLastTutorial,
    currentTutorialIndex,
    currentStepIndex,
    animateTransition,
    finish,
  ]);

  /** Go back one step within the current tutorial (never across tutorials). */
  const handlePrev = useCallback(() => {
    if (currentStepIndex === 0) return;
    animateTransition(currentTutorialIndex, currentStepIndex - 1);
  }, [currentStepIndex, currentTutorialIndex, animateTransition]);

  /** Immediately close the tutorial without completing. */
  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  // ── Derived label for the primary CTA ─────────────────────────────────────
  const nextButtonLabel = useMemo(() => {
    if (isLastStep && isLastTutorial) return "Done ✓";
    if (isLastStep && !isLastTutorial) return "Next Tutorial →";
    return "Next →";
  }, [isLastStep, isLastTutorial]);

  const StepIcon = currentStep.Icon;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleSkip}
      statusBarTranslucent
    >
      <View
        style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.skipIconWrap}>
              <X size={15} color="#9CA3AF" strokeWidth={2.5} />
            </View>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <Text style={styles.stepCounter}>
            Step {currentStepIndex + 1} of {totalSteps}
          </Text>
        </View>

        {/* ── Tutorial section pills (only in 'all' mode) ─────────────────── */}
        {mode === "all" && (
          <View style={styles.pillsRow}>
            {tutorials.map((tut, idx) => {
              const active = idx === currentTutorialIndex;
              return (
                <View
                  key={tut.id}
                  style={[
                    styles.pill,
                    active
                      ? [
                          styles.pillActive,
                          {
                            backgroundColor: tut.accentColor,
                            shadowColor: tut.accentColor,
                          },
                        ]
                      : styles.pillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillLabel,
                      active
                        ? styles.pillLabelActive
                        : styles.pillLabelInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {idx + 1} · {tut.name}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Animated content (image/icon + text + tip) ──────────────── */}
        <Animated.View
          style={[
            styles.animatedArea,
            currentStep.image ? styles.animatedAreaWithImage : null,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {currentStep.image ? (
            /* ── Screenshot image ── */
            <View style={styles.imageWrapper}>
              <Image
                source={currentStep.image}
                style={styles.stepImage}
                resizeMode="contain"
              />
            </View>
          ) : (
            /* ── Fallback: icon circles ── */
            <View
              style={[styles.iconOuter, { backgroundColor: outerCircleBg }]}
            >
              <View
                style={[styles.iconInner, { backgroundColor: innerCircleBg }]}
              >
                <StepIcon size={44} color={accentColor} strokeWidth={1.6} />
              </View>
            </View>
          )}

          {/* Tutorial name badge pill */}
          <View style={[styles.badge, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeText}>{currentTutorial.name}</Text>
          </View>

          {/* Step title */}
          <Text style={styles.stepTitle}>{currentStep.title}</Text>

          {/* Step description */}
          <Text style={styles.description}>{currentStep.description}</Text>

          {/* Optional tip hint box */}
          {currentStep.tip ? (
            <View style={styles.tipBox}>
              <Text style={[styles.tipText, { color: accentColor }]}>
                {"💡 "}
                {currentStep.tip}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* ── Step progress dots ──────────────────────────────────────────── */}
        <View style={styles.dotsRow}>
          {currentTutorial.steps.map((_, idx) => {
            const active = idx === currentStepIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  active
                    ? [styles.dotActive, { backgroundColor: accentColor }]
                    : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* ── Navigation row ─────────────────────────────────────────────── */}
        <View
          style={[
            styles.navRow,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          {/* Back button — only visible after the first step */}
          {currentStepIndex > 0 ? (
            <TouchableOpacity
              onPress={handlePrev}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          ) : (
            /* Spacer keeps the Next button right-aligned */
            <View style={styles.navLeftSpacer} />
          )}

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>{nextButtonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Outer shell ─────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  skipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontFamily: "Montserrat-Medium",
    fontWeight: "500",
  },
  stepCounter: {
    fontSize: 13,
    color: "#9CA3AF",
    fontFamily: "Montserrat-Medium",
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  // ── Section pills ───────────────────────────────────────────────────────────
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  pill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  pillInactive: {
    backgroundColor: "#F3F4F6",
  },
  pillLabel: {
    fontSize: 12,
    fontFamily: "Montserrat-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  pillLabelActive: {
    color: "#FFFFFF",
  },
  pillLabelInactive: {
    color: "#9CA3AF",
  },

  // ── Animated content area ───────────────────────────────────────────────────
  animatedArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  /** When a screenshot image is present, anchor content to the top so the
   *  image fills the upper portion and text sits naturally below it. */
  animatedAreaWithImage: {
    justifyContent: "flex-start",
    paddingTop: 8,
  },

  // ── Step image ───────────────────────────────────────────────────────────────
  imageWrapper: {
    width: SCREEN_WIDTH - 48, // matches container paddingHorizontal (24 × 2)
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  stepImage: {
    width: "100%",
    height: 260,
  },

  // ── Icon circles ────────────────────────────────────────────────────────────
  iconOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Tutorial name badge ──────────────────────────────────────────────────────
  badge: {
    marginTop: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Montserrat-Bold",
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Step title & description ─────────────────────────────────────────────────
  stepTitle: {
    fontSize: 26,
    fontFamily: "Montserrat-Bold",
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    textAlign: "center",
    lineHeight: 33,
    paddingHorizontal: 4,
  },
  description: {
    fontSize: 15,
    fontFamily: "Montserrat-Regular",
    fontWeight: "400",
    color: "#4B5563",
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // ── Tip hint box ────────────────────────────────────────────────────────────
  tipBox: {
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    alignSelf: "stretch",
    marginHorizontal: 4,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Montserrat-Medium",
    fontWeight: "500",
    fontStyle: "italic",
    lineHeight: 19,
    textAlign: "center",
  },

  // ── Step progress dots ──────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    paddingVertical: 18,
  },
  dot: {
    borderRadius: 99,
  },
  dotActive: {
    width: 8,
    height: 8,
  },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: "#E5E7EB",
  },

  // ── Navigation row ──────────────────────────────────────────────────────────
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    minWidth: 76,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: "Montserrat-Medium",
    fontWeight: "500",
    color: "#6B7280",
  },
  /** Spacer that mirrors the Back button width when the button is hidden. */
  navLeftSpacer: {
    minWidth: 76,
  },
  nextButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    // Subtle drop-shadow for depth
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    fontSize: 15,
    fontFamily: "Montserrat-Bold",
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
