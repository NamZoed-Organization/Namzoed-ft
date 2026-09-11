/**
 * History
 *
 * What the viewer has looked at — posts scrolled past, videos watched for
 * more than a few seconds, and products, services and listings opened.
 * Reached from the History card on the profile.
 *
 * Laid out as the same two-column waterfall the rest of the app browses in
 * (MasonryGrid + GridCard), grouped by day: history is browsing, so it reads
 * as a grid of what you saw, not a settings list. Records come from
 * lib/historyService.ts; this screen only reads, searches, filters and
 * clears them.
 */

import GridCard, { gridCardHeight } from "@/components/GridCard";
import MasonryGrid, { GRID_BACKGROUND } from "@/components/MasonryGrid";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { useUser } from "@/contexts/UserContext";
import {
  clearHistory,
  fetchHistory,
  HistoryContentType,
  HistoryEntry,
} from "@/lib/historyService";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft, Search, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Filter = "all" | HistoryContentType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "post", label: "Posts" },
  { key: "video", label: "Videos" },
  { key: "product", label: "Products" },
  { key: "service", label: "Services" },
  { key: "marketplace", label: "Marketplace" },
];

/** "Today" / "Yesterday" / "12 Jun" — the section a card belongs to. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor(
    (startOfToday.getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const { currentUser } = useUser();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [popup, setPopup] = useState<{ visible: boolean; type: "success" | "error"; title: string; message: string }>({
    visible: false, type: "success", title: "", message: "",
  });

  const showPopup = (type: "success" | "error", title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup((p) => ({ ...p, visible: false })), 2500);
  };

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    try {
      setEntries(await fetchHistory(currentUser.id));
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Search and filter run over what's already loaded — history is capped at
  // the most recent couple of hundred entries, so there's nothing to gain
  // from a round trip per keystroke.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) return false;
      if (!needle) return true;
      return (
        entry.title.toLowerCase().includes(needle) ||
        (entry.authorName ?? "").toLowerCase().includes(needle) ||
        (entry.meta ?? "").toLowerCase().includes(needle)
      );
    });
  }, [entries, query, filter]);

  // Entries arrive newest-first, so walking them in order and starting a new
  // section whenever the day changes keeps them in order too.
  const sections = useMemo(() => {
    const out: { day: string; items: HistoryEntry[] }[] = [];
    for (const entry of visible) {
      const day = dayLabel(entry.viewedAt);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(entry);
      else out.push({ day, items: [entry] });
    }
    return out;
  }, [visible]);

  const handleClear = () => {
    if (!currentUser?.id || entries.length === 0) return;
    Alert.alert(
      "Clear History",
      "This removes everything you've viewed. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearHistory(currentUser.id!);
              setEntries([]);
              showPopup("success", "History Cleared", "Your history has been cleared.");
            } catch (error) {
              console.error("Failed to clear history:", error);
              showPopup("error", "Clear Failed", "Couldn't clear your history. Please try again.");
            }
          },
        },
      ],
    );
  };

  const renderCard = useCallback(
    (
      entry: HistoryEntry,
      width: number,
      deferred: boolean,
      priority: "low" | "normal" | "high",
    ) => (
      <GridCard
        id={entry.id}
        width={width}
        ratio={entry.ratio}
        imageUri={entry.imageUri ?? undefined}
        isVideo={entry.isVideo}
        title={entry.title}
        avatarUri={entry.authorAvatar ?? undefined}
        avatarLabel={entry.authorName ?? undefined}
        subtitle={entry.authorName ?? undefined}
        footerRight={
          entry.meta ? (
            <Text className="text-sm font-mbold text-primary" numberOfLines={1}>
              {entry.meta}
            </Text>
          ) : undefined
        }
        onPress={() => router.push(entry.href as any)}
        deferred={deferred}
        priority={priority}
      />
    ),
    [router],
  );

  return (
    // Same ground as the grid itself, so the header, the gaps between day
    // sections, and whatever's left below the last card all read as one
    // surface instead of the grid being a band of a different shade.
    <View className="flex-1" style={{ backgroundColor: GRID_BACKGROUND, paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

      {/* Search sits in the header row itself rather than on its own line —
          the back chevron and Clear bracket it, so the grid starts as high
          up the screen as possible. */}
      <View className="flex-row items-center gap-2 px-3 pb-3 pt-1">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>

        <View
          style={{ borderRadius: 999, borderCurve: "continuous" }}
          className="flex-1 bg-white px-3.5 flex-row items-center"
        >
          <Search size={16} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-2 px-2 text-base text-gray-900"
            placeholder="Search your history"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} className="p-0.5">
              <X size={15} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleClear} disabled={entries.length === 0} className="p-1">
          <Text
            className="text-base font-msemibold"
            style={{ color: entries.length > 0 ? "#111827" : "#D1D5DB" }}
          >
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      {/* Type filter — plain-text tabs, same treatment Home and Marketplace
          use for their own rows. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 18, paddingHorizontal: 16, paddingBottom: 10 }}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <TouchableOpacity key={option.key} onPress={() => setFilter(option.key)} activeOpacity={0.7}>
              <Text
                className={
                  active
                    ? "text-[17px] font-mbold text-gray-900"
                    : "text-[15px] font-medium text-gray-400"
                }
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <CircularLoader color="#094569" />
        </View>
      ) : (
        <PullToRefresh onRefresh={load}>
          {({ indicator, scrollEnabled, onScroll }) => (
            <>
              {indicator}
              <ScrollView
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                scrollEnabled={scrollEnabled}
                bounces={false}
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
              >
                {sections.length === 0 ? (
                  <View className="items-center pt-28 px-10">
                    <Text className="text-base text-gray-400 text-center">
                      {entries.length === 0
                        ? "Nothing here yet — what you view will show up here"
                        : "Nothing matches that"}
                    </Text>
                  </View>
                ) : (
                  sections.map((section) => (
                    <View key={section.day} className="mb-2">
                      <Text className="text-base font-mbold text-gray-900 px-4 pt-3 pb-2">
                        {section.day}
                      </Text>
                      {/* One grid per day so the waterfall balances within a
                          day rather than dragging cards across date breaks. */}
                      <MasonryGrid
                        items={section.items}
                        loading={false}
                        keyExtractor={(entry) => `${entry.type}-${entry.id}`}
                        getHeight={(entry, width) => gridCardHeight(entry.ratio, width)}
                        renderCard={renderCard}
                      />
                    </View>
                  ))
                )}
              </ScrollView>
            </>
          )}
        </PullToRefresh>
      )}
    </View>
  );
}
