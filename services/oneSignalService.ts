import Constants from "expo-constants";
import { NativeModules } from "react-native";

const ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ||
  (Constants.expoConfig?.extra?.oneSignalAppId as string | undefined);

let initialized = false;
let warnedMissingAppId = false;
let warnedMissingNativeModule = false;
let warnedRuntimeFailure = false;
let warnedExpoGoUnsupported = false;

type OneSignalSdkModule = typeof import("react-native-onesignal");
type NotificationClickHandler = (event: any) => void;

let cachedOneSignalSdk: OneSignalSdkModule | null | undefined;

const hasOneSignalNativeModule = (): boolean => {
  const modules = NativeModules as Record<string, unknown>;
  const oneSignalModule = modules.OneSignal as Record<string, unknown> | undefined;
  return Boolean(
    oneSignalModule &&
      typeof oneSignalModule.initialize === "function",
  );
};

const isExpoGoRuntime = (): boolean => {
  return Constants.executionEnvironment === "storeClient";
};

const getOneSignalSdk = (): OneSignalSdkModule | null => {
  if (cachedOneSignalSdk !== undefined) {
    return cachedOneSignalSdk;
  }

  if (isExpoGoRuntime()) {
    cachedOneSignalSdk = null;
    if (!warnedExpoGoUnsupported) {
      console.warn(
        "OneSignal is not available in Expo Go. Use a development build or standalone app for push.",
      );
      warnedExpoGoUnsupported = true;
    }
    return cachedOneSignalSdk;
  }

  if (!hasOneSignalNativeModule()) {
    cachedOneSignalSdk = null;
    if (!warnedMissingNativeModule) {
      console.warn(
        "OneSignal native module is unavailable. Push will be disabled in this runtime.",
      );
      warnedMissingNativeModule = true;
    }
    return cachedOneSignalSdk;
  }

  try {
    // Lazy-load so Expo Go / missing native module does not crash the app at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedOneSignalSdk = require("react-native-onesignal") as OneSignalSdkModule;
  } catch {
    cachedOneSignalSdk = null;
    if (!warnedMissingNativeModule) {
      console.warn(
        "OneSignal native module is unavailable. Push will be disabled in this runtime.",
      );
      warnedMissingNativeModule = true;
    }
  }

  return cachedOneSignalSdk;
};

const withOneSignalGuard = <T>(fn: (sdk: OneSignalSdkModule) => T, fallback: T): T => {
  const sdk = getOneSignalSdk();
  if (!sdk) return fallback;

  try {
    return fn(sdk);
  } catch {
    if (!warnedRuntimeFailure) {
      console.warn(
        "OneSignal runtime call failed. Push features are disabled for this session.",
      );
      warnedRuntimeFailure = true;
    }
    return fallback;
  }
};

export const ensureOneSignalInitialized = (): boolean => {
  if (initialized) return true;

  if (!ONESIGNAL_APP_ID) {
    if (!warnedMissingAppId) {
      console.warn(
        "OneSignal is not configured. Set EXPO_PUBLIC_ONESIGNAL_APP_ID or expo.extra.oneSignalAppId.",
      );
      warnedMissingAppId = true;
    }
    return false;
  }

  return withOneSignalGuard((sdk) => {
    sdk.OneSignal.Debug.setLogLevel(
      __DEV__ ? sdk.LogLevel.Verbose : sdk.LogLevel.Warn,
    );
    sdk.OneSignal.initialize(ONESIGNAL_APP_ID);
    initialized = true;
    return true;
  }, false);
};

export const identifyOneSignalUser = (externalId?: string | null): void => {
  if (!ensureOneSignalInitialized()) return;

  withOneSignalGuard((sdk) => {
    if (!externalId) {
      sdk.OneSignal.logout();
      return;
    }

    sdk.OneSignal.login(String(externalId));
  }, undefined);
};

export const requestOneSignalPermissionIfNeeded = async (): Promise<boolean> => {
  if (!ensureOneSignalInitialized()) return false;

  const sdk = getOneSignalSdk();
  if (!sdk) return false;

  try {
    const hasPermission = await sdk.OneSignal.Notifications.getPermissionAsync();
    if (hasPermission) return true;

    const canRequest =
      await sdk.OneSignal.Notifications.canRequestPermission();
    if (!canRequest) return false;

    return sdk.OneSignal.Notifications.requestPermission(true);
  } catch {
    if (!warnedRuntimeFailure) {
      console.warn(
        "OneSignal permission API is unavailable in this runtime.",
      );
      warnedRuntimeFailure = true;
    }
    return false;
  }
};

export const addOneSignalNotificationClickListener = (
  handler: NotificationClickHandler,
): (() => void) | null => {
  if (!ensureOneSignalInitialized()) return null;

  return withOneSignalGuard((sdk) => {
    sdk.OneSignal.Notifications.addEventListener("click", handler);
    return () => {
      withOneSignalGuard((innerSdk) => {
        innerSdk.OneSignal.Notifications.removeEventListener(
          "click",
          handler,
        );
      }, undefined);
    };
  }, null);
};
