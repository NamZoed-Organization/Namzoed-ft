/**
 * BusinessSearchModal
 *
 * Search *within* one business — its products and its services — reached
 * from the expanded Search control on the business profile's top bar.
 *
 * Scoped deliberately. A business page is a catalogue, and the question a
 * visitor has there is "do they have X", not "who sells X" — which the
 * global search already answers. Sending them to global search from a shop
 * front would lose the shop.
 *
 * Filters what the page already loaded rather than querying: those lists are
 * a business's whole catalogue, they're in memory by the time this can be
 * opened, and a round trip per keystroke would be slower and no more
 * correct.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { MODAL_RADIUS } from "@/constants/theme";
import type { ProviderServiceWithDetails } from "@/lib/servicesService";
import type { Product } from "@/lib/productsService";
import { compactPrice } from "@/utils/price";
import { ChevronLeft, Search, Wrench } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BusinessSearchModalProps {
  visible: boolean;
  onClose: () => void;
  businessName: string | null;
  products: Product[];
  services: ProviderServiceWithDetails[];
  onOpenProduct: (id: string) => void;
  onOpenService: (id: string) => void;
}

export default function BusinessSearchModal({
  visible,
  onClose,
  businessName,
  products,
  services,
  onOpenProduct,
  onOpenService,
}: BusinessSearchModalProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const matchedProducts = useMemo(
    () =>
      q
        ? products.filter(
            (p) =>
              p.name?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q) ||
              p.tags?.some((t) => t.toLowerCase().includes(q)),
          )
        : products,
    [products, q],
  );

  const matchedServices = useMemo(
    () =>
      q
        ? services.filter(
            (s) =>
              s.name?.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q),
          )
        : services,
    [services, q],
  );

  const nothingFound = q.length > 0 && !matchedProducts.length && !matchedServices.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-gray-50"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <StatusBar barStyle="dark-content" />

        <View className="flex-row items-center gap-2 px-4 pb-3 pt-2">
          <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
          <View
            className="flex-1 flex-row items-center bg-white px-3.5 py-2.5"
            style={{ borderRadius: 999, borderCurve: "continuous" }}
          >
            <Search size={16} color="#9CA3AF" />
            <TextInput
              placeholder={
                businessName ? `Search ${businessName}` : "Search this business"
              }
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              className="ml-2 flex-1 text-base text-gray-900"
              autoFocus
              returnKeyType="search"
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {nothingFound ? (
            <View className="items-center py-16 px-8">
              <Text className="text-sm text-gray-400 text-center">
                Nothing in {businessName || "this business"} matches “{query}”
              </Text>
            </View>
          ) : null}

          {matchedProducts.length > 0 && (
            <>
              <Text className="text-[13px] font-semibold text-gray-500 mt-3 mb-2">
                Products
              </Text>
              {matchedProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => onOpenProduct(product.id)}
                  activeOpacity={0.7}
                  style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
                  className="bg-white p-2.5 mb-2 flex-row items-center"
                >
                  <View
                    style={{ width: 46, height: 46, borderRadius: 8, borderCurve: "continuous", overflow: "hidden" }}
                    className="bg-gray-100"
                  >
                    {product.images?.[0] ? (
                      <ProgressiveImage
                        uri={product.images[0]}
                        style={{ width: "100%", height: "100%" }}
                        showProgress={false}
                      />
                    ) : null}
                  </View>
                  <View className="flex-1 ml-3 pr-2">
                    <Text className="text-[15.5px] font-semibold text-[#111]" numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text className="text-[13px] text-gray-400 mt-0.5" numberOfLines={1}>
                      {product.category}
                    </Text>
                  </View>
                  <Text className="text-[13px] font-semibold" style={{ color: "#094569" }}>
                    {compactPrice(product.current_price ?? product.price)}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {matchedServices.length > 0 && (
            <>
              <Text className="text-[13px] font-semibold text-gray-500 mt-3 mb-2">
                Services
              </Text>
              {matchedServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  onPress={() => onOpenService(service.id)}
                  activeOpacity={0.7}
                  style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
                  className="bg-white p-2.5 mb-2 flex-row items-center"
                >
                  <View
                    style={{ width: 46, height: 46, borderRadius: 8, borderCurve: "continuous", overflow: "hidden" }}
                    className="bg-gray-100 items-center justify-center"
                  >
                    {service.images?.[0] ? (
                      <ProgressiveImage
                        uri={service.images[0]}
                        style={{ width: "100%", height: "100%" }}
                        showProgress={false}
                      />
                    ) : (
                      <Wrench size={18} color="#9CA3AF" strokeWidth={1.8} />
                    )}
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-[15.5px] font-semibold text-[#111]" numberOfLines={1}>
                      {service.name}
                    </Text>
                    {service.service_categories?.name ? (
                      <Text className="text-[13px] text-gray-400 mt-0.5" numberOfLines={1}>
                        {service.service_categories.name}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
