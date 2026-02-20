import { useUser } from "@/contexts/UserContext";
import {
  getOneSignalDebugState,
  identifyOneSignalUser,
  requestOneSignalPermissionIfNeeded,
  type OneSignalDebugState,
} from "@/services/oneSignalService";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function OneSignalDebugScreen() {
  const { currentUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<OneSignalDebugState | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const expectedExternalId = currentUser?.id ?? null;

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const nextState = await getOneSignalDebugState(expectedExternalId);
      setState(nextState);
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [expectedExternalId]);

  useEffect(() => {
    identifyOneSignalUser(expectedExternalId);
    loadState().catch(() => undefined);
  }, [expectedExternalId, loadState]);

  const mismatch = useMemo(() => {
    if (!state?.expectedExternalId) return false;
    return state.externalId !== state.expectedExternalId;
  }, [state]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-2xl font-bold text-black">OneSignal Debug</Text>
        <Text className="text-sm text-gray-600">
          Use this screen in TestFlight to validate alias + subscription state.
        </Text>

        <View className="rounded-xl border border-gray-300 p-3">
          <Text className="text-xs text-gray-500">Expected External ID</Text>
          <Text className="text-sm text-black">{expectedExternalId ?? "null"}</Text>
        </View>

        <View className="rounded-xl border border-gray-300 p-3">
          <Text className="text-xs text-gray-500">Current OneSignal State</Text>
          {loading ? (
            <View className="flex-row items-center gap-2 py-2">
              <ActivityIndicator />
              <Text className="text-sm text-gray-700">Loading...</Text>
            </View>
          ) : (
            <Text className="text-xs text-black">
              {JSON.stringify(state, null, 2)}
            </Text>
          )}
          <Text className="mt-2 text-xs text-gray-500">
            Last updated: {lastUpdated || "never"}
          </Text>
        </View>

        {mismatch ? (
          <Text className="text-sm text-red-600">
            external_id mismatch: OneSignal externalId does not match logged-in user id.
          </Text>
        ) : null}

        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 rounded-lg bg-black p-3"
            onPress={() => loadState().catch(() => undefined)}
          >
            <Text className="text-center text-sm font-semibold text-white">
              Refresh State
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 rounded-lg bg-blue-600 p-3"
            onPress={() => {
              requestOneSignalPermissionIfNeeded()
                .then(() => loadState())
                .catch(() => undefined);
            }}
          >
            <Text className="text-center text-sm font-semibold text-white">
              Request Permission
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
