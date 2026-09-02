import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type GifStickerKind = "gif" | "sticker";

export type GifStickerPayload = {
  provider: "giphy";
  providerId: string;
  type: GifStickerKind;
  title: string;
  url: string;
  previewUrl: string;
  width?: number;
  height?: number;
};

type GiphyImageFormat = {
  url?: string;
  width?: string;
  height?: string;
};

type GiphyItem = {
  id: string;
  title?: string;
  images?: {
    fixed_width?: GiphyImageFormat;
    fixed_width_small?: GiphyImageFormat;
    downsized_medium?: GiphyImageFormat;
    original?: GiphyImageFormat;
  };
};

type GifStickerButtonProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

type GifStickerInlineDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (payload: GifStickerPayload) => void;
};

const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
const RESULT_LIMIT = 24;
const DRAWER_HEIGHT = 370;

const toNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toPayload = (
  item: GiphyItem,
  type: GifStickerKind,
): GifStickerPayload | null => {
  const display = item.images?.fixed_width || item.images?.downsized_medium;
  const preview = item.images?.fixed_width_small || display;
  const original = item.images?.original || display;

  const url = display?.url || original?.url;
  const previewUrl = preview?.url || url;
  if (!url || !previewUrl) return null;

  return {
    provider: "giphy",
    providerId: item.id,
    type,
    title: item.title || (type === "gif" ? "GIF" : "Sticker"),
    url,
    previewUrl,
    width: toNumber(display?.width || original?.width),
    height: toNumber(display?.height || original?.height),
  };
};

export function GifStickerButton({
  visible,
  onVisibleChange,
}: GifStickerButtonProps) {
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "warning";
    title: string;
    message: string;
  }>({ visible: false, type: "warning", title: "", message: "" });

  const handlePress = () => {
    if (!GIPHY_API_KEY) {
      setPopup({
        visible: true,
        type: "warning",
        title: "GIPHY Key Needed",
        message:
          "Add EXPO_PUBLIC_GIPHY_API_KEY to your environment to enable GIFs and stickers.",
      });
      return;
    }
    onVisibleChange(!visible);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        className={`w-9 h-9 items-center justify-center rounded-full ${
          visible ? "bg-white" : ""
        }`}
      >
        <Ionicons
          name={visible ? "happy" : "happy-outline"}
          size={20}
          color={visible ? "#094569" : "#6b7280"}
        />
      </TouchableOpacity>

      <Modal visible={popup.visible} transparent animationType="none">
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      </Modal>
    </>
  );
}

export function GifStickerInlineDrawer({
  visible,
  onClose,
  onSelect,
}: GifStickerInlineDrawerProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [activeType, setActiveType] = useState<GifStickerKind>("gif");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifStickerPayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const expandAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "error";
    title: string;
    message: string;
  }>({ visible: false, type: "error", title: "", message: "" });

  const endpoint = useMemo(() => {
    const base =
      activeType === "gif"
        ? "https://api.giphy.com/v1/gifs"
        : "https://api.giphy.com/v1/stickers";
    return query.trim() ? `${base}/search` : `${base}/trending`;
  }, [activeType, query]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: false,
        speed: 18,
        bounciness: 4,
      }).start();
      return;
    }

    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setShouldRender(false);
    });
  }, [expandAnim, visible]);

  const fetchItems = useCallback(async () => {
    if (!shouldRender || !visible || !GIPHY_API_KEY) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        api_key: GIPHY_API_KEY,
        limit: String(RESULT_LIMIT),
        rating: "pg-13",
        lang: "en",
      });
      if (query.trim()) params.set("q", query.trim());

      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok)
        throw new Error(`GIPHY request failed ${response.status}`);

      const json = (await response.json()) as { data?: GiphyItem[] };
      setItems(
        (json.data || [])
          .map((item) => toPayload(item, activeType))
          .filter(Boolean) as GifStickerPayload[],
      );
    } catch (error) {
      console.error("GIPHY fetch failed:", error);
      setPopup({
        visible: true,
        type: "error",
        title: "Could Not Load",
        message: "GIFs and stickers are unavailable right now.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeType, endpoint, query, shouldRender, visible]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, query.trim() ? 350 : 0);
    return () => clearTimeout(timer);
  }, [fetchItems, query]);

  if (!shouldRender) return null;

  const animatedDrawerStyle = {
    height: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, DRAWER_HEIGHT],
    }),
    opacity: expandAnim,
    transform: [
      {
        translateY: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
    ],
  };

  return (
    <>
      <Animated.View
        style={[
          {
            overflow: "hidden",
            borderTopWidth: 1,
            borderTopColor: "rgba(229,231,235,0.8)",
          },
          animatedDrawerStyle,
        ]}
      >
        <View className="px-3 pt-3 pb-2">
          <View className="flex-row items-center mb-3">
            <View className="flex-row rounded-full bg-white p-1">
              {(["gif", "sticker"] as GifStickerKind[]).map((type) => {
                const selected = activeType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setActiveType(type)}
                    className={`px-4 py-2 rounded-full ${
                      selected ? "bg-primary" : ""
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${
                        selected ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {type === "gif" ? "GIFs" : "Stickers"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="ml-auto w-9 h-9 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="flex-row items-center bg-white px-3 mb-3 h-11">
            <Ionicons name="search" size={17} color="#9ca3af" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${activeType === "gif" ? "GIFs" : "stickers"}`}
              className="flex-1 ml-2 text-[15px]"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={17} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ height: 292 }}>
            {isLoading ? (
              <View className="flex-1 items-center justify-center">
                <CircularLoader size="small" color="#094569" />
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => `${item.type}-${item.providerId}`}
                numColumns={3}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={{ gap: 8 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                ListEmptyComponent={
                  <View className="items-center justify-center py-12">
                    <Text className="text-gray-500 text-[13px]">
                      No results found.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    activeOpacity={0.82}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      overflow: "hidden",
                      backgroundColor: "#f3f4f6",
                    }}
                  >
                    <ExpoImage
                      source={{ uri: item.previewUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Animated.View>

      <Modal visible={popup.visible} transparent animationType="none">
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      </Modal>
    </>
  );
}
