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
export type OneSignalDebugState = {
  expectedExternalId: string | null;
  externalId: string | null;
  oneSignalId: string | null;
  permission: boolean;
  canRequestPermission: boolean;
  permissionNative: number | null;
  pushSubscriptionId: string | null;
  pushOptedIn: boolean;
  pushTokenPrefix: string | null;
};

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
      warnedExpoGoUnsupported = true;
    }
    return cachedOneSignalSdk;
  }

  if (!hasOneSignalNativeModule()) {
    cachedOneSignalSdk = null;
    if (!warnedMissingNativeModule) {
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
      warnedRuntimeFailure = true;
    }
    return fallback;
  }
};

export const ensureOneSignalInitialized = (): boolean => {
  if (initialized) return true;

  if (!ONESIGNAL_APP_ID) {
    if (!warnedMissingAppId) {
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
    if (hasPermission) {
      await ensureOneSignalPushOptedIn("permission_already_granted");
      return true;
    }

    const canRequest =
      await sdk.OneSignal.Notifications.canRequestPermission();
    if (!canRequest) return false;

    const granted = await sdk.OneSignal.Notifications.requestPermission(true);
    if (granted) {
      await ensureOneSignalPushOptedIn("permission_just_granted");
    }
    return granted;
  } catch {
    if (!warnedRuntimeFailure) {
      warnedRuntimeFailure = true;
    }
    return false;
  }
};

export const ensureOneSignalPushOptedIn = async (
  context = "ensure_push_opt_in",
): Promise<boolean> => {
  if (!ensureOneSignalInitialized()) return false;

  const sdk = getOneSignalSdk();
  if (!sdk) return false;

  try {
    const hasPermission = await sdk.OneSignal.Notifications.getPermissionAsync();
    if (!hasPermission) return false;

    const isOptedIn =
      await sdk.OneSignal.User.pushSubscription.getOptedInAsync();
    if (isOptedIn) return true;

    sdk.OneSignal.User.pushSubscription.optIn();

    const isOptedInAfter =
      await sdk.OneSignal.User.pushSubscription.getOptedInAsync();
    if (!isOptedInAfter) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

export const addOneSignalForegroundNotificationHandler = (
  handler: (event: any) => void,
): (() => void) | null => {
  if (!ensureOneSignalInitialized()) return null;

  return withOneSignalGuard((sdk) => {
    sdk.OneSignal.Notifications.addEventListener("foregroundWillDisplay", handler);
    return () => {
      withOneSignalGuard((innerSdk) => {
        innerSdk.OneSignal.Notifications.removeEventListener(
          "foregroundWillDisplay",
          handler,
        );
      }, undefined);
    };
  }, null);
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

export const logOneSignalDebugState = async (
  context: string,
  expectedExternalId?: string | null,
): Promise<void> => {
  if (!ensureOneSignalInitialized()) {
    return;
  }

  const sdk = getOneSignalSdk();
  if (!sdk) {
    return;
  }

  try {
    const [
      permission,
      canRequestPermission,
      permissionNative,
      externalId,
      oneSignalId,
      pushSubscriptionId,
      pushToken,
      pushOptedIn,
    ] = await Promise.all([
      sdk.OneSignal.Notifications.getPermissionAsync(),
      sdk.OneSignal.Notifications.canRequestPermission(),
      sdk.OneSignal.Notifications.permissionNative(),
      sdk.OneSignal.User.getExternalId(),
      sdk.OneSignal.User.getOnesignalId(),
      sdk.OneSignal.User.pushSubscription.getIdAsync(),
      sdk.OneSignal.User.pushSubscription.getTokenAsync(),
      sdk.OneSignal.User.pushSubscription.getOptedInAsync(),
    ]);

    console.log(`[OneSignal Debug][${context}]`, {
      expectedExternalId: expectedExternalId ?? null,
      externalId,
      oneSignalId,
      permission,
      canRequestPermission,
      permissionNative,
      pushSubscriptionId,
      pushOptedIn,
      pushTokenPrefix: pushToken ? String(pushToken).slice(0, 16) : null,
    });

    if (expectedExternalId && externalId !== String(expectedExternalId)) {
    }
  } catch (error) {
  }
};

export const getOneSignalDebugState = async (
  expectedExternalId?: string | null,
): Promise<OneSignalDebugState | null> => {
  if (!ensureOneSignalInitialized()) return null;

  const sdk = getOneSignalSdk();
  if (!sdk) return null;

  try {
    const [
      permission,
      canRequestPermission,
      permissionNative,
      externalId,
      oneSignalId,
      pushSubscriptionId,
      pushToken,
      pushOptedIn,
    ] = await Promise.all([
      sdk.OneSignal.Notifications.getPermissionAsync(),
      sdk.OneSignal.Notifications.canRequestPermission(),
      sdk.OneSignal.Notifications.permissionNative(),
      sdk.OneSignal.User.getExternalId(),
      sdk.OneSignal.User.getOnesignalId(),
      sdk.OneSignal.User.pushSubscription.getIdAsync(),
      sdk.OneSignal.User.pushSubscription.getTokenAsync(),
      sdk.OneSignal.User.pushSubscription.getOptedInAsync(),
    ]);

    return {
      expectedExternalId: expectedExternalId ? String(expectedExternalId) : null,
      externalId,
      oneSignalId,
      permission,
      canRequestPermission,
      permissionNative: typeof permissionNative === "number" ? permissionNative : null,
      pushSubscriptionId,
      pushOptedIn,
      pushTokenPrefix: pushToken ? String(pushToken).slice(0, 16) : null,
    };
  } catch (error) {
    return null;
  }
};
