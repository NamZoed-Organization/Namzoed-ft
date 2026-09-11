/**
 * EditWorkProfile
 *
 * The business's edit screen, built as a hub in the same shape as
 * components/settings/EditProfile.tsx (UI_STANDARD.md § Hub screens): the
 * logo is the only thing edited in place, and everything else is a row that
 * opens its own single-purpose page with one Save and one thing to get wrong.
 *
 * What it replaced was a single form with every field on it at once, which
 * is the pattern the standard moved the personal profile off — a long form
 * makes each field feel optional, and a business's name and license are the
 * two things a buyer has to be able to trust.
 *
 * Those pages slide in *within* this screen, on the same SubPageLayer stack
 * the Settings screen uses, rather than being stacked full-screen modals or
 * pushed routes. Modals cross-faded from nowhere and could not be dragged
 * back; a pushed route meant closing this screen to open the next one, so
 * coming back landed on the business page instead of the row you left. One
 * stack gives every level the same slide, the same left-edge drag and the
 * same hardware back, and leaves the hub sitting where it was underneath.
 */

import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import { useTutorial } from "@/contexts/TutorialContext";
import { TUTORIAL_SCREENS } from "@/lib/tutorialTours";
import BusinessLicense from "@/components/profile/BusinessLicense";
import EditBusinessType from "@/components/profile/EditBusinessType";
import EditService, { type ServicePreview } from "@/components/profile/EditService";
import SubPageLayer, { SUB_PAGE_SLIDE_MS } from "@/components/settings/SubPageLayer";
import CircularLoader from "@/components/ui/CircularLoader";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { MODAL_RADIUS, SWITCH_COLORS } from "@/constants/theme";
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  Plus,
  Store,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  makeMutable,
  runOnJS,
  SharedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface WorkProfileForm {
  businessName: string;
  bio: string;
  email: string;
  contact: string;
  emailActive: boolean;
  contactActive: boolean;
}

type FieldKey = "businessName" | "bio" | "email" | "contact";

const FIELDS: Record<
  FieldKey,
  { title: string; label: string; placeholder: string; maxLength: number; multiline?: boolean }
> = {
  businessName: {
    title: "Business name",
    label: "Name",
    placeholder: "What is your business called?",
    maxLength: 60,
  },
  bio: {
    title: "About",
    label: "About",
    placeholder: "What do you make, sell or do?",
    maxLength: 240,
    multiline: true,
  },
  email: {
    title: "Email",
    label: "Email",
    placeholder: "you@business.bt",
    maxLength: 120,
  },
  contact: {
    title: "Phone",
    label: "Phone",
    placeholder: "17 XXX XXX",
    maxLength: 20,
  },
};

/** The grey every page here sits on — hub and sub-pages alike, so a level
 *  sliding over another never shows a seam. */
const GROUND = "#F9FAFB";

/** A level of the stack. `key` is `field:<FieldKey>`, `type`, `license`,
 *  `service:new`, or `service:<id>`; `anim` is that level's own translateX,
 *  created when it is pushed and thrown away with it, so a page that never
 *  moves never has its transform touched. */
interface SubPage {
  key: string;
  anim: SharedValue<number>;
}

interface EditWorkProfileProps {
  visible: boolean;
  form: WorkProfileForm;
  logoUrl: string | null;
  verificationStatus: "verified" | "pending" | "not_verified";
  saving?: boolean;
  onClose: () => void;
  onChangeLogo: () => void;
  /** One field at a time, so a failed save can only ever lose one thing. */
  onSaveField: (patch: Partial<WorkProfileForm>) => void | Promise<void>;
  /** The license document and where it is in review. Picking, uploading and
   *  removing belong to the screen that owns the provider row — this only
   *  says what it wants done. */
  licenseUrl: string | null;
  uploadingLicense?: boolean;
  onViewLicense: () => void;
  onUploadLicense: () => void;
  onRemoveLicense: () => void;
  /** The business's type — what it does, which decides which sections its
   *  profile shows. Set from the first service if never chosen. The name is
   *  what the row displays; the slug is what the picker selects on. */
  businessType: string | null;
  businessTypeSlug: string | null;
  onSaveBusinessType: (slug: string) => void | Promise<void>;
  /** Services are managed from here rather than from the business page,
   *  which is the shop front — a visitor shouldn't share a screen with the
   *  owner's add/edit controls. */
  services: {
    id: string;
    name: string;
    status?: boolean;
    /** Dev only: stands in for the fetch when the preview drives this. */
    preview?: ServicePreview;
  }[];
  /** A service was added, changed or deleted — the page behind needs its
   *  list refetched. */
  onServicesChanged: () => void;
}

export default function EditWorkProfile({
  visible,
  form,
  logoUrl,
  verificationStatus,
  saving,
  onClose,
  onChangeLogo,
  onSaveField,
  licenseUrl,
  uploadingLicense,
  onViewLicense,
  onUploadLicense,
  onRemoveLicense,
  businessType,
  businessTypeSlug,
  onSaveBusinessType,
  services,
  onServicesChanged,
}: EditWorkProfileProps) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;

  // Setting up a business is the longest thing anybody does in this app and
  // the least self-explanatory, so it teaches itself the first time the
  // editor opens (lib/tutorialTours.ts) — on the logo, the rows and the
  // licence, which is the order it actually happens in.
  const { arrive } = useTutorial();
  useEffect(() => {
    if (visible) arrive(TUTORIAL_SCREENS.WORK_PROFILE);
  }, [arrive, visible]);

  const [stack, setStack] = useState<SubPage[]>([]);
  const [draft, setDraft] = useState("");

  // Mirrored into a shared value so the drag gesture (UI thread) can check
  // whether an animation already owns the value without hopping to JS.
  const isAnimating = useRef(false);
  const animatingShared = useSharedValue(false);
  const isAnimatingWorklet = useCallback(() => {
    "worklet";
    return animatingShared.value;
  }, [animatingShared]);
  const setAnimating = useCallback(
    (value: boolean) => {
      isAnimating.current = value;
      animatingShared.value = value;
    },
    [animatingShared],
  );
  const clearAnimating = useCallback(() => setAnimating(false), [setAnimating]);
  const popStack = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);

  // Closing the whole editor empties the stack, so reopening it lands on the
  // hub rather than on whichever page happened to be open when it closed.
  useEffect(() => {
    if (!visible) {
      setStack([]);
      setAnimating(false);
    }
  }, [visible, setAnimating]);

  const push = useCallback(
    (key: string) => {
      if (isAnimating.current) return;
      setAnimating(true);
      // Starts off-screen right and slides in; the page it covers keeps its
      // own value, untouched at 0.
      const anim = makeMutable(screenWidth);
      setStack((prev) => [...prev, { key, anim }]);
      anim.value = withTiming(0, { duration: SUB_PAGE_SLIDE_MS }, (finished) => {
        if (finished) runOnJS(clearAnimating)();
      });
    },
    [screenWidth, setAnimating, clearAnimating],
  );

  const pop = useCallback(
    (animated = true) => {
      const top = stack[stack.length - 1];
      if (!top) return;
      // The drag has already carried the page off-screen, so the slide-out
      // below would play a second time over nothing.
      if (!animated) {
        popStack();
        return;
      }
      if (isAnimating.current) return;
      setAnimating(true);
      top.anim.value = withTiming(screenWidth, { duration: SUB_PAGE_SLIDE_MS }, (finished) => {
        runOnJS(clearAnimating)();
        if (finished) runOnJS(popStack)();
      });
    },
    [stack, screenWidth, setAnimating, clearAnimating, popStack],
  );

  const openField = (key: FieldKey) => {
    setDraft(form[key] ?? "");
    push(`field:${key}`);
  };

  const commitField = async (key: FieldKey) => {
    await onSaveField({ [key]: draft.trim() } as Partial<WorkProfileForm>);
    pop();
  };

  const rows: { key: FieldKey; label: string; value: string }[] = [
    { key: "businessName", label: "Name", value: form.businessName },
    { key: "bio", label: "About", value: form.bio },
    { key: "email", label: "Email", value: form.email },
    { key: "contact", label: "Phone", value: form.contact },
  ];

  const licenseLabel =
    verificationStatus === "verified"
      ? "Verified"
      : verificationStatus === "pending"
        ? "Being reviewed"
        : "Not uploaded";

  const renderSubPage = (key: string) => {
    if (key.startsWith("field:")) {
      const field = key.slice("field:".length) as FieldKey;
      return (
        <FieldPage
          field={field}
          draft={draft}
          original={form[field] ?? ""}
          saving={!!saving}
          onChangeDraft={setDraft}
          onClose={() => pop()}
          onSave={() => commitField(field)}
        />
      );
    }
    if (key === "type") {
      return (
        <EditBusinessType
          value={businessTypeSlug}
          saving={!!saving}
          onClose={() => pop()}
          onSave={async (slug) => {
            await onSaveBusinessType(slug);
            pop();
          }}
        />
      );
    }
    if (key === "license") {
      return (
        <BusinessLicense
          licenseUrl={licenseUrl}
          verificationStatus={verificationStatus}
          uploading={!!uploadingLicense}
          onClose={() => pop()}
          onView={onViewLicense}
          onUpload={onUploadLicense}
          onRemove={onRemoveLicense}
        />
      );
    }
    if (key.startsWith("service:")) {
      const id = key.slice("service:".length);
      return (
        <EditService
          serviceId={id === "new" ? null : id}
          preview={services.find((service) => service.id === id)?.preview}
          onClose={() => pop()}
          onSaved={() => {
            onServicesChanged();
            pop();
          }}
        />
      );
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      // Android hardware back pops a sub-page first; only the hub closes the
      // editor, which is what every level of the stack has to agree on.
      onRequestClose={() => (stack.length > 0 ? pop() : onClose())}
    >
      {/* Gestures inside a RN Modal live in their own native window, which
          the app-level root view doesn't reach — the sub-page back drag is
          dead on Android without this. */}
      <GestureHandlerRootView
        className="flex-1"
        style={{ backgroundColor: GROUND, paddingTop: insets.top }}
      >
        {/* The screen underneath sets light-content for its cover gradient,
            and RN merges StatusBar props last-mounted-wins. */}
        <StatusBar barStyle="dark-content" />

        <View className="flex-1 relative overflow-hidden">
          <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
            {/* No Save here — every row saves on its own page, and the logo
                saves the moment it's picked, so back is the only header
                action. */}
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
                <Text className="text-xl font-medium text-gray-900">Edit business</Text>
              </View>
              <View className="py-1" style={{ width: 60 }} />
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 }}
            >
              {/* Logo — centred with the camera badge, exactly as the personal
                  hub treats the profile photo. */}
              <TutorialAnchor
                id="business.identity"
                radius={52}
                style={{ alignItems: "center", marginBottom: 24 }}
              >
                <TouchableOpacity onPress={onChangeLogo} activeOpacity={0.8}>
                  <View
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: 52,
                      borderCurve: "continuous",
                      overflow: "hidden",
                    }}
                    className="bg-gray-200 items-center justify-center"
                  >
                    {logoUrl ? (
                      <ProgressiveImage
                        uri={logoUrl}
                        style={{ width: "100%", height: "100%" }}
                        showProgress={false}
                        priority="high"
                      />
                    ) : (
                      <Store size={40} strokeWidth={1.5} color="#9CA3AF" />
                    )}
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      borderCurve: "continuous",
                    }}
                    className="bg-white items-center justify-center border border-gray-100"
                  >
                    <Camera size={18} color="#0369A1" />
                  </View>
                </TouchableOpacity>
              </TutorialAnchor>

              <TutorialAnchor
                id="business.details"
                radius={MODAL_RADIUS}
                style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", overflow: "hidden" }}
              >
              <View
                style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", overflow: "hidden" }}
                className="bg-white"
              >
                {rows.map((row, index) => (
                  <TouchableOpacity
                    key={row.key}
                    onPress={() => openField(row.key)}
                    activeOpacity={0.7}
                    className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
                  >
                    <Text className="text-xl text-gray-900" style={{ width: 96 }}>
                      {row.label}
                    </Text>
                    <Text
                      className="text-xl flex-1 text-right mr-3"
                      style={{ color: row.value ? "#6B7280" : "#9CA3AF" }}
                      numberOfLines={1}
                    >
                      {row.value || "Not set"}
                    </Text>
                    <ChevronRight size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
              </TutorialAnchor>

              {/* Visibility switches sit beside what they control rather than in
                  a settings screen somewhere else — a seller deciding whether to
                  publish their phone number is deciding it about that number. */}
              <View
                style={{
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                  marginTop: 12,
                  overflow: "hidden",
                }}
                className="bg-white"
              >
                <SwitchRow
                  label="Show email"
                  value={form.emailActive}
                  onChange={(v) => onSaveField({ emailActive: v })}
                />
                <SwitchRow
                  label="Show phone"
                  value={form.contactActive}
                  onChange={(v) => onSaveField({ contactActive: v })}
                  divider
                />
              </View>

              {/* What the business does. It decides which sections the profile
                  shows — a taxi service has no Products tab — so it earns a row
                  of its own rather than being inferred forever from whichever
                  service happened to be added first. */}
              <TouchableOpacity
                onPress={() => push("type")}
                activeOpacity={0.7}
                style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12 }}
                className="bg-white px-4 py-4 flex-row items-center"
              >
                <Text className="text-xl text-gray-900" style={{ width: 96 }}>
                  Type
                </Text>
                <Text
                  className="text-xl flex-1 text-right mr-3"
                  style={{ color: businessType ? "#6B7280" : "#9CA3AF" }}
                  numberOfLines={1}
                >
                  {businessType || "Not set"}
                </Text>
                <ChevronRight size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Services — a group of rows like everything else here, with
                  adding as the last row rather than a button floating beside a
                  heading. Same shape as the field rows above, so the whole
                  screen reads as one list of things you can change. */}
              <View
                style={{
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                  marginTop: 12,
                  overflow: "hidden",
                }}
                className="bg-white"
              >
                {services.map((service, index) => (
                  <TouchableOpacity
                    key={service.id}
                    onPress={() => push(`service:${service.id}`)}
                    activeOpacity={0.7}
                    className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
                  >
                    <Text className="text-xl text-gray-900 flex-1" numberOfLines={1}>
                      {service.name}
                    </Text>
                    {/* A paused service still exists; saying so is the whole
                        reason the row shows a state at all. */}
                    {service.status === false && (
                      <Text className="text-xl text-gray-400 mr-3">Paused</Text>
                    )}
                    <ChevronRight size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => push("service:new")}
                  activeOpacity={0.7}
                  className={`px-4 py-4 flex-row items-center ${services.length > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <Plus size={20} color="#0369A1" />
                  <Text className="text-xl ml-3" style={{ color: "#0369A1" }}>
                    Add a service
                  </Text>
                </TouchableOpacity>
              </View>

              <TutorialAnchor
                id="business.license"
                radius={MODAL_RADIUS}
                style={{ marginTop: 12 }}
              >
              <TouchableOpacity
                onPress={() => push("license")}
                activeOpacity={0.7}
                style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
                className="bg-white px-4 py-4 flex-row items-center"
              >
                <Text className="text-xl text-gray-900 flex-1">Business license</Text>
                {verificationStatus === "verified" && (
                  <BadgeCheck size={18} color="#0369A1" style={{ marginRight: 6 }} />
                )}
                <Text
                  className="text-xl mr-3"
                  style={{ color: verificationStatus === "verified" ? "#6B7280" : "#9CA3AF" }}
                >
                  {licenseLabel}
                </Text>
                <ChevronRight size={20} color="#9CA3AF" />
              </TouchableOpacity>
              </TutorialAnchor>

              <Text className="text-base text-gray-400 mt-3 px-1">
                A verified license is what lets you list products on shopping. Without one you can
                still offer services and sell in the marketplace.
              </Text>
            </ScrollView>
          </View>

          {/* Keyed by depth, not by name: the instance at a given level
              survives its neighbours being pushed and popped above it, so a
              transition never remounts a page mid-slide. */}
          {stack.map((page, index) => (
            <SubPageLayer
              key={index}
              anim={page.anim}
              isTop={index === stack.length - 1}
              swipeEnabled={index === stack.length - 1}
              zIndex={30 + index}
              backgroundColor={GROUND}
              paddingBottom={insets.bottom}
              isAnimating={isAnimatingWorklet}
              onSwipedBack={() => pop(false)}
            >
              {renderSubPage(page.key)}
            </SubPageLayer>
          ))}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One field, one page, one Save. */
function FieldPage({
  field,
  draft,
  original,
  saving,
  onChangeDraft,
  onClose,
  onSave,
}: {
  field: FieldKey;
  draft: string;
  original: string;
  saving: boolean;
  onChangeDraft: (next: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const config = FIELDS[field];
  const changed = draft.trim() !== (original ?? "").trim();

  return (
    <View className="flex-1">
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
          <Text className="text-xl font-medium text-gray-900">{config.title}</Text>
        </View>
        <TouchableOpacity onPress={onSave} disabled={saving || !changed} className="py-1">
          {saving ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text
              className="text-xl font-medium"
              // Live only when there is something to save — pale and
              // disabled when unchanged, same as every other form.
              style={{ color: changed ? "#0369A1" : "#93C5FD" }}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 10 }}>
        <View style={{ position: "relative" }}>
          <TextInput
            style={{
              borderRadius: MODAL_RADIUS,
              borderCurve: "continuous",
              // paddingBottom 34 on EVERY field, single-line ones included —
              // it's the room the counter sits in, and EditName/EditBio both
              // have it. Applying it only to multiline left single-line text
              // padded at the top and not the bottom, which reads as the text
              // sinking in its box.
              paddingBottom: 34,
              ...(config.multiline
                ? { minHeight: 160, textAlignVertical: "top" as const }
                : null),
            }}
            className="bg-white px-4 py-3 text-xl text-gray-900"
            placeholder={config.placeholder}
            placeholderTextColor="#9CA3AF"
            value={draft}
            onChangeText={(t) => onChangeDraft(t.slice(0, config.maxLength))}
            multiline={config.multiline}
            maxLength={config.maxLength}
            keyboardType={
              field === "email" ? "email-address" : field === "contact" ? "phone-pad" : "default"
            }
            autoCapitalize={field === "email" ? "none" : "sentences"}
            autoFocus
          />
          {/* On every field too, for the same reason: the padding above
              reserves its space whether or not it's drawn. */}
          <Text
            className="text-xl text-gray-400"
            style={{ position: "absolute", right: 12, bottom: 10 }}
          >
            {draft.length}/{config.maxLength}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  divider,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  divider?: boolean;
}) {
  return (
    <View className={`px-4 py-4 flex-row items-center ${divider ? "border-t border-gray-100" : ""}`}>
      <Text className="text-xl text-gray-900 flex-1">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: SWITCH_COLORS.trackOn, false: SWITCH_COLORS.trackOff }}
        thumbColor={SWITCH_COLORS.thumb}
        ios_backgroundColor={SWITCH_COLORS.trackOff}
      />
    </View>
  );
}
