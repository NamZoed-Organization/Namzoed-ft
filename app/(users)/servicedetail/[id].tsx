/**
 * A service, by its own address — for deep links, shares, and anything that
 * pushes rather than growing an overlay.
 *
 * The screen itself is `components/ServiceDetailContent.tsx`, which is the
 * same component the peek sheet grows into and the services grid opens as
 * an overlay. This file is what it always should have been: the fetch, the
 * history entry, and the chrome around them — the layout lives in one place
 * so a service opened three ways is the same screen three times.
 */

import ServiceDetailContent from "@/components/ServiceDetailContent";
import CircularLoader from "@/components/ui/CircularLoader";
import { useUser } from "@/contexts/UserContext";
import { recordView } from "@/lib/historyService";
import {
  fetchProviderServiceById,
  type ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import { Stack, useLocalSearchParams } from "expo-router";
import { Wrench } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StatusBar, Text, View } from "react-native";

/** Hoisted, like the other detail screens': a fresh literal each render
 *  retriggers `navigation.setOptions()` and can trip React's nested-update
 *  guard. This one is a plain opaque push, so it only needs a real
 *  animation instead of the root layout's default "none". */
const SERVICE_SCREEN_OPTIONS = {
  animation: "slide_from_right" as const,
};

export default function ServiceDetailScreen() {
  const router = useAppRouter();
  const { currentUser } = useUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const serviceId = String(id ?? "");

  const [service, setService] = useState<ProviderServiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!serviceId) return;
      try {
        if (!isRefresh) setLoading(true);
        const data = await fetchProviderServiceById(serviceId);
        setService(data);
        // The viewer's own History — opening the detail is having seen it.
        recordView(
          "service",
          serviceId,
          currentUser?.id,
          data?.service_providers?.user_id,
        );
      } catch (error) {
        console.error("Error loading service:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser?.id, serviceId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={SERVICE_SCREEN_OPTIONS} />
      <StatusBar barStyle="dark-content" />

      {loading && !service ? (
        <View className="flex-1 bg-[#FAFBFC] items-center justify-center">
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : service ? (
        <ServiceDetailContent
          service={service}
          onBack={() => router.back()}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          refreshing={refreshing}
        />
      ) : (
        <View className="flex-1 bg-[#FAFBFC] items-center justify-center px-10">
          <Wrench size={40} color="#D1D5DB" />
          <Text className="text-base font-semibold text-gray-700 mt-4 text-center">
            This service isn&apos;t available
          </Text>
          <Text className="text-sm text-gray-400 mt-1 text-center">
            It may have been taken down by whoever offered it.
          </Text>
        </View>
      )}
    </>
  );
}
