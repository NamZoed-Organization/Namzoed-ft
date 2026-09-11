/**
 * Setlog's hourly prompt, in Settings › Notifications.
 *
 * The switch already existed on the Setlog settings screen. It is here too
 * because this is where people go when they are looking for a notification
 * they are not getting — a notifications screen that lists every kind the
 * app sends *except* the hourly one reads as proof that Setlog does not
 * send anything.
 *
 * **Two doors, one truth.** Both read and write `profiles.setlog_prefs`
 * through `lib/setlogSettings.ts`; nothing is duplicated into the general
 * `notification_prefs` blob. A second switch storing a second answer is how
 * a person ends up opted in on one screen and out on the other, with the
 * sender believing whichever it happens to read.
 *
 * The **Send a test prompt** row exists because the hourly prompt has four
 * moving parts and silence names none of them. It fires the in-app half and
 * the push half for you alone and says which of the two arrived, which is
 * the difference between "the scheduler never ran" and "push is broken".
 */

import ChoiceSheet from "@/components/ui/ChoiceSheet";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSwitchRow,
} from "@/components/settings/SettingsChrome";
import { useUser } from "@/contexts/UserContext";
import { requestOneSignalPermissionIfNeeded } from "@/services/oneSignalService";
import {
  DEFAULT_SETLOG_PROMPT,
  fetchSetlogPrompt,
  repairSetlogPrompt,
  saveSetlogPrompt,
  sendTestSetlogPrompt,
  setlogNotificationsSupported,
  type SetlogPrompt,
} from "@/lib/setlogSettings";
import { formatHour } from "@/lib/setlogService";
import { BellRing, Clock, Send } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

type Sheet = "from" | "to" | null;

export default function SetlogPromptSettings({
  onMessage,
}: {
  /** Reports a result through the host screen's own popup. */
  onMessage: (
    type: "success" | "warning" | "error",
    title: string,
    message: string,
  ) => void;
}) {
  const { currentUser } = useUser();
  const [prompt, setPrompt] = useState<SetlogPrompt>(DEFAULT_SETLOG_PROMPT);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [testing, setTesting] = useState(false);
  const supported = setlogNotificationsSupported();

  useEffect(() => {
    if (!currentUser?.id || !supported) return;
    let alive = true;
    fetchSetlogPrompt(currentUser.id)
      .then(async (saved) => {
        if (!alive) return;
        setPrompt(saved);
        // A switched-on row can still be invisible to the sender: no
        // timezone (the column arrived after some opt-ins) or a stale app
        // version (nothing rewrites the row when the app updates). Both are
        // silent, so they are repaired on sight rather than waited for.
        await repairSetlogPrompt(currentUser.id!, saved).catch(() => false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [currentUser?.id, supported]);

  const update = useCallback(
    async (patch: Partial<SetlogPrompt>) => {
      const next = { ...prompt, ...patch };
      setPrompt(next);
      if (!currentUser?.id) return;
      try {
        // Turning it on needs the OS to agree as well as the user — the one
        // moment a "yes" here and a "no" in the phone's own settings can be
        // caught, rather than becoming silence a month later.
        if (next.enabled) {
          const granted = await requestOneSignalPermissionIfNeeded();
          if (!granted) {
            setPrompt({ ...next, enabled: false });
            onMessage(
              "warning",
              "Notifications are off",
              "Your phone is blocking notifications for Namzoed. Turn them on in your device settings and come back.",
            );
            return;
          }
        }
        await saveSetlogPrompt(currentUser.id, next);
      } catch (e: any) {
        setPrompt(prompt);
        onMessage("error", "Couldn't save", e?.message || "That didn't save.");
      }
    },
    [currentUser?.id, onMessage, prompt],
  );

  const runTest = async () => {
    if (!currentUser?.id || testing) return;
    setTesting(true);
    try {
      const result = await sendTestSetlogPrompt(currentUser.id);
      if (result.inApp && result.push) {
        onMessage(
          "success",
          "Test sent",
          "Check your notifications tab and your lock screen. If only one arrived, tell us which.",
        );
      } else if (result.inApp || result.push) {
        onMessage(
          "warning",
          result.inApp ? "In-app only" : "Push only",
          result.detail ??
            "One half went out and the other didn't — that narrows it to that half.",
        );
      } else {
        onMessage(
          "error",
          "Neither half sent",
          result.detail ?? "Nothing went out. The problem is before delivery.",
        );
      }
    } finally {
      setTesting(false);
    }
  };

  // A build without Setlog must not offer to notify about it — the same
  // gate the write itself enforces (SETLOG_FEATURE_VERSION).
  if (!supported) return null;

  const hourOptions = Array.from({ length: 24 }, (_, h) => ({
    value: String(h),
    label: formatHour(h),
  }));

  return (
    <>
      <SettingsGroup label="Setlog">
        <SettingsSwitchRow
          first
          icon={BellRing}
          label="Hourly prompt"
          description="A nudge each hour inside your window — in the app and on your phone"
          value={prompt.enabled}
          onValueChange={(value) => update({ enabled: value })}
        />
        <SettingsRow
          icon={Clock}
          label="From"
          value={formatHour(prompt.fromHour)}
          onPress={prompt.enabled ? () => setSheet("from") : undefined}
        />
        <SettingsRow
          icon={Clock}
          label="Until"
          value={formatHour(prompt.toHour)}
          onPress={prompt.enabled ? () => setSheet("to") : undefined}
        />
        <SettingsRow
          icon={Send}
          label={testing ? "Sending…" : "Send a test prompt"}
          description="Fires both halves now, and says which arrived"
          onPress={runTest}
        />
      </SettingsGroup>

      <Text className="text-xs text-gray-400 px-3 leading-5 -mt-2 mb-3">
        The prompt is sent hourly by the server, so it needs this switch on
        <Text> </Text>
        and Namzoed allowed to notify you on this phone. Nothing is sent
        outside the window, or in an hour you have already recorded.
      </Text>

      <ChoiceSheet
        visible={sheet === "from"}
        title="Start at"
        options={hourOptions}
        selected={String(prompt.fromHour)}
        onSelect={(v) => update({ fromHour: Number(v) })}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === "to"}
        title="Stop at"
        options={hourOptions}
        selected={String(prompt.toHour)}
        onSelect={(v) => update({ toHour: Number(v) })}
        onClose={() => setSheet(null)}
      />
    </>
  );
}
