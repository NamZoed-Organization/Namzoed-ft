import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

/**
 * Data saver — spend less of somebody's mobile data without being asked.
 *
 * Most people using Namzoed pay for every megabyte, and the ones who most
 * need this are the ones who will never go looking for a setting. So it is on
 * by default whenever the phone says the connection is metered, and off on
 * Wi-Fi. While it is on:
 *
 * - sized pictures are requested smaller (lib/imagePreview.ts),
 * - grids reveal less ahead of the scroll (hooks/useGridReveal.ts),
 * - an inline feed video waits for a tap (components/post/VideoTapToPlay.tsx),
 * - Reels gives a player only to the reel on screen (components/ReelsViewer.tsx).
 *
 * "Metered" is the phone's own verdict, not ours: a cellular connection, or
 * any connection the OS flags as expensive — which is how a hotspot shared
 * from another phone is caught, even though it arrives as Wi-Fi.
 *
 * A module-level store rather than a context, because the picture-sizing code
 * that reads it is a plain function called from many components; components
 * that need to re-render on a change use `useDataSaver`.
 */

export type DataSaverMode = "auto" | "on" | "off";

export const DATA_SAVER_OPTIONS: { value: DataSaverMode; label: string }[] = [
  { value: "auto", label: "On mobile data" },
  { value: "on", label: "Always" },
  { value: "off", label: "Never" },
];

const MODE_KEY = "settings:dataSaverMode";

export interface DataSaverState {
  mode: DataSaverMode;
  /** The phone reports the current connection as metered. */
  meteredConnection: boolean;
  /** What everything else reads: is data saver in effect right now. */
  active: boolean;
}

let state: DataSaverState = { mode: "auto", meteredConnection: false, active: false };
const listeners = new Set<() => void>();

const isMetered = (net: NetInfoState): boolean =>
  net.type === "cellular" ||
  (net.details as { isConnectionExpensive?: boolean } | null)?.isConnectionExpensive === true;

const update = (patch: Partial<Omit<DataSaverState, "active">>) => {
  const mode = patch.mode ?? state.mode;
  const meteredConnection = patch.meteredConnection ?? state.meteredConnection;
  const active = mode === "on" || (mode === "auto" && meteredConnection);
  if (
    mode === state.mode &&
    meteredConnection === state.meteredConnection &&
    active === state.active
  ) {
    return;
  }
  state = { mode, meteredConnection, active };
  listeners.forEach((listener) => listener());
};

let started = false;

/** Called once from the root layout, before anything asks what size to load. */
export function startDataSaver(): () => void {
  if (started) return () => {};
  started = true;

  AsyncStorage.getItem(MODE_KEY)
    .then((raw) => {
      if (raw === "auto" || raw === "on" || raw === "off") update({ mode: raw });
    })
    .catch(() => {});
  NetInfo.fetch()
    .then((net) => update({ meteredConnection: isMetered(net) }))
    .catch(() => {});
  const unsubscribe = NetInfo.addEventListener((net) =>
    update({ meteredConnection: isMetered(net) }),
  );

  return () => {
    unsubscribe();
    started = false;
  };
}

export const getDataSaverState = (): DataSaverState => state;

/** For non-React code; read at the moment a request is built. */
export const isDataSaverActive = (): boolean => state.active;

export async function setDataSaverMode(mode: DataSaverMode): Promise<void> {
  update({ mode });
  try {
    await AsyncStorage.setItem(MODE_KEY, mode);
  } catch {
    // Applies for this session regardless; it just won't survive a restart.
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useDataSaver(): DataSaverState {
  return useSyncExternalStore(subscribe, getDataSaverState, getDataSaverState);
}
