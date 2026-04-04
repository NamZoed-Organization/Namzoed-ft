import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, AppState, Share, Text, View } from "react-native";

export default function ShareBridgeScreen() {
  const router = useAppRouter();
  const { payload, app } = useLocalSearchParams<{ payload?: string; app?: string }>();
  const ranRef = useRef(false);
  const exitedRef = useRef(false);
  const leftAppRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const safeExit = () => {
    if (exitedRef.current) return;
    exitedRef.current = true;

    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace("/(users)/(tabs)" as any);
    }
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const appStateSub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (prev === "active" && (next === "inactive" || next === "background")) {
        leftAppRef.current = true;
      }

      if (leftAppRef.current && next === "active") {
        // iOS+Instagram can leave Share.share unresolved after returning.
        // Exit this bridge immediately on foreground return.
        setTimeout(() => safeExit(), 140);
      }
    });

    const fallback = setTimeout(() => {
      safeExit();
    }, 20000);

    const run = async () => {
      try {
        const raw = typeof payload === "string" ? decodeURIComponent(payload) : "";
        const parsed = raw ? JSON.parse(raw) : {};

        const message =
          (typeof parsed?.message === "string" && parsed.message) ||
          (typeof parsed?.url === "string" && parsed.url) ||
          "";

        const sharePayload: { title?: string; message: string; url?: string } = {
          title: typeof parsed?.title === "string" ? parsed.title : undefined,
          message,
          url: typeof parsed?.url === "string" ? parsed.url : undefined,
        };

        await new Promise<void>((resolve) => setTimeout(resolve, 120));
        await Share.share(sharePayload, {
          dialogTitle: typeof app === "string" ? `Share to ${app}` : "Share",
        });
      } catch {
        // noop
      } finally {
        safeExit();
      }
    };

    void run();

    return () => {
      clearTimeout(fallback);
      appStateSub.remove();
    };
  }, [payload, app, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color="#094569" size="small" />
      <Text className="mt-3 text-sm text-gray-500">Preparing share…</Text>
    </View>
  );
}
