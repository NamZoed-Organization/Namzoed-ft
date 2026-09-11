/**
 * ServiceDetailOverlay
 *
 * The product overlay's twin, for services: a tile in the Services grid
 * grows into the service screen, and the left-edge swipe takes it back —
 * dropping on the dome messages the provider instead of the seller.
 *
 * It is deliberately the same three lines of difference from the product
 * one (`GrowIntoScreenOverlay` is the shared half): where the hero settles,
 * which drop target, which content. A service and a product are the same
 * kind of page, and somebody who lists both should never notice which one
 * they are looking at until they read it.
 */

import ServiceDetailContent, {
  SERVICE_HERO_HEIGHT,
  useServiceContactProviderTarget,
} from "@/components/ServiceDetailContent";
import GrowIntoScreenOverlay, {
  type SourceRect,
} from "@/components/ui/GrowIntoScreenOverlay";
import { useUser } from "@/contexts/UserContext";
import type { ProviderServiceWithDetails } from "@/lib/servicesService";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ServiceDetailOverlay({
  visible,
  onClose,
  service,
  sourceRect,
}: {
  visible: boolean;
  onClose: () => void;
  service: ProviderServiceWithDetails | null;
  sourceRect?: SourceRect | null;
}) {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const target = useServiceContactProviderTarget(service, currentUser?.id);

  return (
    <GrowIntoScreenOverlay
      visible={visible}
      onClose={onClose}
      sourceRect={sourceRect}
      heroUri={service?.images?.[0]}
      mediaTop={insets.top + 56}
      mediaHeight={SERVICE_HERO_HEIGHT}
      target={target}
    >
      {({ commitClose }) =>
        service ? (
          <ServiceDetailContent
            service={service}
            onBack={() => commitClose()}
            onNavigateAway={(navigate) => commitClose(navigate)}
          />
        ) : null
      }
    </GrowIntoScreenOverlay>
  );
}
