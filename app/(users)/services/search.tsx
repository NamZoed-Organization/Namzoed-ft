import CircularLoader from "@/components/ui/CircularLoader";
import {
  fetchAllProviderServices,
  fetchProviderServicesByCategory,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { getInitials } from "@/utils/initials";
import { useAppRouter } from "@/utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ChevronLeft, Verified } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] =
        a[i - 1] === b[j - 1]
          ? m[i - 1][j - 1]
          : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[a.length][b.length];
}

function bestWordDistance(query: string, text: string): number {
  if (!text) return Infinity;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  let best = Infinity;
  for (const w of words) {
    const d = levenshtein(query, w);
    if (d < best) best = d;
  }
  return best;
}

function scoreService(s: ProviderServiceWithDetails, q: string): number {
  const name = (s.name || "").toLowerCase();
  const desc = (s.description || "").toLowerCase();
  const providerName = (s.service_providers?.name || "").toLowerCase();
  const userName = (s.service_providers?.profiles?.name || "").toLowerCase();

  if (name === q) return 1000;
  if (name.startsWith(q)) return 900;
  if (providerName.startsWith(q) || userName.startsWith(q)) return 850;
  if (name.includes(q)) return 720;
  if (providerName.includes(q) || userName.includes(q)) return 680;
  if (desc.includes(q)) return 400;

  const dist = Math.min(
    bestWordDistance(q, name),
    bestWordDistance(q, providerName),
    bestWordDistance(q, userName),
  );
  const tol = q.length <= 3 ? 1 : q.length <= 6 ? 2 : 3;
  if (dist <= tol) return 300 - dist * 40;
  return 0;
}

export default function ServicesSearchScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  // scope = category slug (slug page) or undefined (general page)
  const { scope } = useLocalSearchParams<{ scope?: string }>();

  const [query, setQuery] = useState("");
  const [services, setServices] = useState<ProviderServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = scope
          ? await fetchProviderServicesByCategory(scope)
          : await fetchAllProviderServices(0, 500);
        if (!cancelled) {
          setServices((data || []).filter((s) => s.status !== false));
        }
      } catch (e) {
        console.error("ServicesSearchScreen load error:", e);
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services
      .map((s) => ({ s, score: scoreService(s, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((r) => r.s);
  }, [services, query]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 6, marginRight: 4 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color="#0f172a" strokeWidth={2.5} />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#F1F5F9",
            borderRadius: 999,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search services, providers..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: "#0F172A",
              paddingVertical: 0,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : query.trim().length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons name="search" size={44} color="#CBD5E1" />
          <Text
            style={{
              marginTop: 10,
              color: "#94A3B8",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Search by service name, provider, or user name
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons name="search-outline" size={44} color="#CBD5E1" />
          <Text
            style={{
              marginTop: 10,
              color: "#64748B",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No services found for &quot;{query}&quot;
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const providerName =
              item.service_providers?.name ||
              item.service_providers?.profiles?.name ||
              "Unknown";
            const providerImage =
              item.service_providers?.profiles?.avatar_url ||
              item.service_providers?.profile_url;
            const image = item.images?.[0];

            return (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/(users)/servicedetail/${item.id}` as any)
                }
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  borderCurve: "continuous",
                  padding: 10,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "#F1F5F9",
                }}
              >
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={{ width: 52, height: 52, borderRadius: 10 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: "#F1F5F9",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="construct" size={22} color="#94A3B8" />
                  </View>
                )}

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#0F172A",
                    }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 3,
                    }}
                  >
                    {providerImage ? (
                      <Image
                        source={{ uri: providerImage }}
                        style={{ width: 14, height: 14, borderRadius: 7 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          borderCurve: "continuous",
                          backgroundColor: "#E0E7EF",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 7,
                            fontWeight: "700",
                            color: "#094569",
                          }}
                        >
                          {getInitials(providerName)}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        marginLeft: 5,
                        fontSize: 11,
                        color: "#64748B",
                        flexShrink: 1,
                      }}
                      numberOfLines={1}
                    >
                      by {providerName}
                    </Text>
                    {item.service_providers?.verification_status ===
                      "verified" && (
                      <Verified
                        size={10}
                        color="#094569"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                  {item.service_categories?.name && (
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 10,
                        color: "#094569",
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {item.service_categories.name}
                    </Text>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
