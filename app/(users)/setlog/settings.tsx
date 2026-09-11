/**
 * Setlog settings.
 *
 * Two groups, and they are different kinds of setting on purpose:
 *
 *  - **Camera defaults** — what the camera opens on. Everything here can
 *    also be changed on the camera itself, for one take; this is where you
 *    say what "one take" should start as. Device-local, because it is a way
 *    of holding this phone.
 *
 *  - **The hourly prompt** — off by default, and the OS permission is asked
 *    for the first time this screen is opened rather than on the way into
 *    the app. A permission asked in the place it is about is a permission
 *    people understand; one asked at launch is one they decline.
 *
 * The prompt is gated on the app version (`SETLOG_FEATURE_VERSION`). Setlog
 * ships in the version being built now; the build people are running today
 * is older and has no Setlog tab, so a push about it would open a screen
 * that does not exist for them — the switch is unavailable on such a build,
 * the write refuses it a second time, and every opt-in records the version
 * it was made on for the sender to filter by.
 */

import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import EdgeSwipeBack from "@/components/ui/EdgeSwipeBack";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import {
  CAPTURE_MODES,
  CAPTURE_MODE_ORDER,
  VIDEO_QUALITIES,
  formatHour,
  type CaptureMode,
  type VideoQuality,
} from "@/lib/setlogService";
import {
  DEFAULT_CAMERA_DEFAULTS,
  DEFAULT_SETLOG_PROMPT,
  SETLOG_FEATURE_VERSION,
  fetchSetlogPrompt,
  formatPromptWindow,
  repairSetlogPrompt,
  hasAskedForNotifications,
  loadCameraDefaults,
  markAskedForNotifications,
  saveCameraDefaults,
  saveSetlogPrompt,
  setlogNotificationsSupported,
  type CameraDefaults,
  type SetlogPrompt,
} from "@/lib/setlogSettings";
import {
  getNotificationPermission,
  requestOneSignalPermissionIfNeeded,
} from "@/services/oneSignalService";
import { SWITCH_COLORS } from "@/constants/theme";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 12;

const ZOOM_LABELS = ["0.5", "1x", "2", "4", "8"];
const TIMERS = [0, 3, 10];

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "600",
        color: "#6B7280",
        paddingHorizontal: 16,
        paddingBottom: 8,
        paddingTop: 6,
      }}
    >
      {children}
    </Text>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        borderCurve: "continuous",
        overflow: "hidden",
        marginHorizontal: GROUP_INSET,
        marginBottom: 14,
      }}
    >
      {children}
    </View>
  );
}

function Row({
  label,
  description,
  value,
  onPress,
  right,
  first,
  disabled,
}: {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  first?: boolean;
  disabled?: boolean;
}) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {!first && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 16,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: "#f0f0f0",
          }}
        />
      )}
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
          {label}
        </Text>
        {description ? (
          <Text style={{ fontSize: 14, lineHeight: 19, color: "#9CA3AF", marginTop: 2 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ fontSize: 15.5, color: "#9CA3AF" }}>{value}</Text>
      ) : null}
      {right}
    </Wrapper>
  );
}

type SheetKind =
  | null
  | "frame"
  | "mode"
  | "quality"
  | "flash"
  | "zoom"
  | "timer"
  | "from"
  | "to";

export default function SetlogSettingsScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();

  const [camera, setCamera] = useState<CameraDefaults>(DEFAULT_CAMERA_DEFAULTS);
  const [prompt, setPrompt] = useState<SetlogPrompt>(DEFAULT_SETLOG_PROMPT);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [showPriming, setShowPriming] = useState(false);
  const [osPermission, setOsPermission] = useState<boolean | null>(null);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "white", title: "", message: "" });

  const supported = setlogNotificationsSupported();

  useEffect(() => {
    (async () => {
      try {
        const [defaults, saved] = await Promise.all([
          loadCameraDefaults(),
          currentUser?.id
            ? fetchSetlogPrompt(currentUser.id)
            : Promise.resolve(DEFAULT_SETLOG_PROMPT),
        ]);
        setCamera(defaults);
        setPrompt(saved);
        // A row the sender cannot act on — no timezone, or an app version
        // from before this update — is repaired on sight; both are silent
        // ways for a switched-on prompt to never arrive.
        if (currentUser?.id) {
          repairSetlogPrompt(currentUser.id, saved).catch(() => false);
        }
      } catch (e) {
        console.error("Error loading setlog settings:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser?.id]);

  /**
   * The offer, asked once, here — and it is an *offer*, not the OS dialog.
   *
   * Firing `requestPermission` on mount was wrong twice over. iOS shows its
   * real dialog only once per install, so spending it the instant a screen
   * opens spends it before anyone knows what they are agreeing to; and when
   * the SDK is not available, or permission is already granted, that call
   * returns silently and the screen appears to have done nothing at all —
   * which is exactly what it looked like.
   *
   * So the first visit puts a card on the screen. The OS dialog comes after
   * someone has said yes to that, which is the priming step the whole
   * notification literature asks for.
   */
  useEffect(() => {
    if (!supported) return;
    hasAskedForNotifications().then((asked) => {
      if (!asked) setShowPriming(true);
    });
  }, [supported]);

  /** What the OS actually thinks, so a blocked switch is never a mystery. */
  useEffect(() => {
    getNotificationPermission().then(setOsPermission);
  }, [prompt.enabled]);

  const answerPriming = async (turnOn: boolean) => {
    // Marked only once they have answered — the old code marked it before
    // asking, so a silent failure burned the one chance to offer it.
    await markAskedForNotifications();
    setShowPriming(false);
    if (turnOn) await updatePrompt({ enabled: true });
  };

  const updateCamera = useCallback((patch: Partial<CameraDefaults>) => {
    setCamera((prev) => {
      const next = { ...prev, ...patch };
      saveCameraDefaults(next);
      return next;
    });
  }, []);

  const updatePrompt = useCallback(
    async (patch: Partial<SetlogPrompt>) => {
      const next = { ...prompt, ...patch };
      setPrompt(next);
      if (!currentUser?.id) return;
      try {
        // Turning it on needs the OS to agree as well as the user; asking
        // again here is free once it has been granted, and is the only
        // moment where a "yes" here and a "no" in Settings can be caught.
        if (next.enabled) {
          const granted = await requestOneSignalPermissionIfNeeded();
          if (!granted) {
            setPrompt({ ...next, enabled: false });
            setPopup({
              visible: true,
              type: "warning",
              title: "Notifications are off",
              message:
                "Your phone is blocking notifications for Namzoed. Turn them on in Settings and come back.",
            });
            return;
          }
        }
        await saveSetlogPrompt(currentUser.id, next);
      } catch (e: any) {
        setPopup({
          visible: true,
          type: "error",
          title: "Couldn't save",
          message: e?.message || "That setting didn't save.",
        });
      }
    },
    [prompt, currentUser?.id],
  );

  const hourOptions = Array.from({ length: 24 }, (_, h) => ({
    value: String(h),
    label: formatHour(h),
  }));

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
      <View
        style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}
      >
        <StatusBar barStyle="dark-content" />

        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />

        {/* § Header — chevron, centred title, a spacer opposite. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 2,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>
              Setlog
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#0369A1" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* The offer, on the first visit only. A card rather than the
                OS dialog: iOS gives one chance at that dialog, and it
                should be spent by someone who has already decided. */}
            {showPriming && supported && (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 18,
                  borderCurve: "continuous",
                  marginHorizontal: GROUP_INSET,
                  marginBottom: 14,
                  padding: 16,
                }}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
                  Want a nudge on the hour?
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    color: "#9CA3AF",
                    marginTop: 4,
                  }}
                >
                  Setlog can remind you each hour inside a window you choose, so
                  the day fills itself in. It&apos;s off until you say
                  otherwise, and you can change it here any time.
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => answerPriming(false)}
                    style={{
                      borderRadius: 999,
                      borderCurve: "continuous",
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      backgroundColor: "#F5F5F5",
                    }}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: "600", color: "#6B7280" }}
                    >
                      Not now
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => answerPriming(true)}
                    style={{
                      borderRadius: 999,
                      borderCurve: "continuous",
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      backgroundColor: "#0369A1",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
                      Turn it on
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── The hourly prompt ─────────────────────────────── */}
            <GroupLabel>Hourly prompt</GroupLabel>
            <Group>
              <Row
                first
                label="Remind me on the hour"
                description={
                  supported
                    ? "A notification each hour inside your window, in the app and on your phone."
                    : `Arrives in ${SETLOG_FEATURE_VERSION}. This build can't be notified about a screen it doesn't have.`
                }
                right={
                  <Switch
                    value={prompt.enabled}
                    disabled={!supported}
                    onValueChange={(v) => updatePrompt({ enabled: v })}
                    trackColor={{
                      true: SWITCH_COLORS.trackOn,
                      false: SWITCH_COLORS.trackOff,
                    }}
                    thumbColor={SWITCH_COLORS.thumb}
                    ios_backgroundColor={SWITCH_COLORS.trackOff}
                  />
                }
              />
              <Row
                label="From"
                value={formatHour(prompt.fromHour)}
                disabled={!prompt.enabled}
                onPress={() => prompt.enabled && setSheet("from")}
              />
              <Row
                label="Until"
                value={formatHour(prompt.toHour)}
                disabled={!prompt.enabled}
                onPress={() => prompt.enabled && setSheet("to")}
              />
            </Group>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: "#9CA3AF",
                paddingHorizontal: 16,
                marginTop: -6,
                marginBottom: prompt.enabled && osPermission === false ? 8 : 20,
              }}
            >
              Off unless you turn it on, and silent outside {formatPromptWindow(prompt)}.
            </Text>

            {/* The switch can be on while the phone refuses to deliver.
                Said plainly, with the one place it can be changed. */}
            {prompt.enabled && osPermission === false && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Linking.openSettings()}
                style={{ paddingHorizontal: 16, marginBottom: 20 }}
              >
                <Text style={{ fontSize: 13, lineHeight: 18, color: "#DC2626" }}>
                  Your phone is blocking notifications for Namzoed, so nothing
                  will arrive. Open Settings to allow them.
                </Text>
              </TouchableOpacity>
            )}

            {/* ── Camera defaults ───────────────────────────────── */}
            <GroupLabel>Camera opens on</GroupLabel>
            <Group>
              <Row
                first
                label="Frame"
                value={camera.frame === "landscape" ? "Landscape" : "Portrait"}
                onPress={() => setSheet("frame")}
              />
              <Row
                label="Length"
                value={CAPTURE_MODES[camera.mode].label}
                onPress={() => setSheet("mode")}
              />
              <Row
                label="Video quality"
                value={camera.quality}
                onPress={() => setSheet("quality")}
              />
              <Row
                label="Flash"
                value={
                  camera.flash === "off"
                    ? "Off"
                    : camera.flash === "on"
                      ? "On"
                      : "Auto"
                }
                onPress={() => setSheet("flash")}
              />
              <Row
                label="Zoom"
                value={ZOOM_LABELS[camera.zoomIndex] ?? "1x"}
                onPress={() => setSheet("zoom")}
              />
              <Row
                label="Self-timer"
                value={camera.timerSeconds === 0 ? "Off" : `${camera.timerSeconds}s`}
                onPress={() => setSheet("timer")}
              />
              <Row
                label="Camera"
                value={camera.facing === "back" ? "Back" : "Front"}
                onPress={() =>
                  updateCamera({
                    facing: camera.facing === "back" ? "front" : "back",
                  })
                }
              />
            </Group>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: "#9CA3AF",
                paddingHorizontal: 16,
                marginTop: -6,
              }}
            >
              What the camera starts as. Every one of these can still be changed on
              the camera itself, for one take, without changing what it opens on
              next time.
            </Text>
          </ScrollView>
        )}

        <ChoiceSheet
          visible={sheet === "frame"}
          title="Frame"
          selected={camera.frame}
          options={[
            { value: "landscape", label: "Landscape" },
            { value: "portrait", label: "Portrait" },
          ]}
          onSelect={(v) => updateCamera({ frame: v as CameraDefaults["frame"] })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "mode"}
          title="Length"
          selected={camera.mode}
          options={CAPTURE_MODE_ORDER.map((m) => ({
            value: m,
            label: CAPTURE_MODES[m].label,
          }))}
          onSelect={(v) => updateCamera({ mode: v as CaptureMode })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "quality"}
          title="Video quality"
          selected={camera.quality}
          options={VIDEO_QUALITIES.map((q) => ({ value: q, label: q }))}
          onSelect={(v) => updateCamera({ quality: v as VideoQuality })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "flash"}
          title="Flash"
          selected={camera.flash}
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
            { value: "auto", label: "Auto" },
          ]}
          onSelect={(v) => updateCamera({ flash: v as CameraDefaults["flash"] })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "zoom"}
          title="Zoom"
          selected={String(camera.zoomIndex)}
          options={ZOOM_LABELS.map((label, i) => ({ value: String(i), label }))}
          onSelect={(v) => updateCamera({ zoomIndex: Number(v) })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "timer"}
          title="Self-timer"
          selected={String(camera.timerSeconds)}
          options={TIMERS.map((t) => ({
            value: String(t),
            label: t === 0 ? "Off" : `${t} seconds`,
          }))}
          onSelect={(v) => updateCamera({ timerSeconds: Number(v) })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "from"}
          title="Start prompting at"
          selected={String(prompt.fromHour)}
          options={hourOptions}
          onSelect={(v) => updatePrompt({ fromHour: Number(v) })}
          onClose={() => setSheet(null)}
        />
        <ChoiceSheet
          visible={sheet === "to"}
          title="Stop prompting at"
          selected={String(prompt.toHour)}
          options={hourOptions}
          onSelect={(v) => updatePrompt({ toHour: Number(v) })}
          onClose={() => setSheet(null)}
        />
      </View>
    </EdgeSwipeBack>
  );
}
