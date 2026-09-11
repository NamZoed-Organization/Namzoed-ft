/**
 * The category row that every browsing tab uses: a horizontal scroll of
 * plain-text filters, and a chevron that opens all of them.
 *
 * It was written inside the Shopping tab and lived there alone, which is
 * how the Services tab ended up with a bare scroller and no way to see the
 * twenty categories past the edge of the screen. Two hand-maintained
 * versions of this is the drift § Tabs and pills warns about — so there is
 * one, and both tabs pass it their own list.
 *
 * **The full list drops out of the row itself.** It is the row, opened —
 * anchored to where the row actually is (measured, because the row scrolls
 * with the content), full-width so its own panel covers the chevron that
 * opened it. A bottom sheet was tried and is wrong here: this list *is* the
 * row's own contents, and pulling it up from the opposite edge of the screen
 * severs it from the thing it belongs to.
 *
 * **It takes exactly the height it needs, and no more — but if that is
 * everything below the row, it takes everything below the row.** The old
 * version was a flat 260pt: too tall for a short list, and a scroll-inside-a
 * -scroll for a long one, ending in the middle of nowhere. The height is
 * computed from the number of rows, then capped at the space available.
 *
 * It borrows the app's own sheet grammar even so — a `Check` on the live
 * one, `MODAL_RADIUS` corners, a 13 semibold section label (§ Sheets, § Type)
 * — so it reads as the same family without being a second bottom sheet.
 *
 * **Two across.** A wrapped run of chips leaves a ragged right edge and a
 * different number of items per row depending on how long the words happen
 * to be; a fixed two-column grid gives every category the same target and
 * the same left edge to read down. Long names — "Medical, Legal and
 * Financial Services" — are why: at three across they truncate, and a
 * directory whose labels are cut in half is not a directory.
 */

import {
  FILTER_ROW_GAP,
  FILTER_ROW_INSET,
  FILTER_ROW_VERTICAL,
  MODAL_RADIUS,
} from "@/constants/theme";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
/** Every cell is this tall, which is what makes the panel's height
 *  arithmetic exact rather than measured. */
const CELL_HEIGHT = 50;
const CELL_GAP = 8;
const HEADER_HEIGHT = 50;
const LINK_LABEL_HEIGHT = 34;
const PANEL_PADDING = 16;

export interface CategoryFilterItem {
  key: string;
  label: string;
}

/**
 * Things that are not filters, listed in the drawer under their own
 * heading.
 *
 * Services has two: a ground and a room are booked by the slot rather than
 * by contacting somebody, so they are destinations, not ways of narrowing
 * the grid. They belong *in* this list because that is where somebody looks
 * for "what kinds of thing are there" — but under a heading of their own,
 * because a row that mixed filters and destinations would leave you unable
 * to tell which taps change the grid and which leave the screen.
 */
export interface CategoryFilterLink {
  key: string;
  label: string;
  onPress: () => void;
}

export default function CategoryFilterRow({
  items,
  active,
  onSelect,
  links,
  linksLabel = "Book by the slot",
  drawerTitle = "All categories",
  background = "#f8f9fa",
}: {
  items: CategoryFilterItem[];
  active: string;
  onSelect: (key: string) => void;
  /** Destinations, shown only in the drawer. */
  links?: CategoryFilterLink[];
  linksLabel?: string;
  drawerTitle?: string;
  /** The screen's own ground — the fades and the panel match it, and plain
   *  white read as a too-bright patch against a grey screen. */
  background?: string;
}) {
  const rowRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  /** Where the row is on screen right now — it scrolls with the content, so
   *  a fixed offset would drop the panel somewhere the row is not. */
  const [top, setTop] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  /**
   * How tall the panel wants to be.
   *
   * Two columns, so the rows are half the item count, plus the links and
   * their label when there are any, plus the header and the padding. Worked
   * out rather than measured: a measured height means a frame at the wrong
   * size before the right one, and the arithmetic here is exact because
   * every cell is the same height.
   */
  const rows = Math.ceil(items.length / 2);
  const linkRows = links?.length ? Math.ceil(links.length / 2) : 0;
  const wanted =
    HEADER_HEIGHT +
    rows * (CELL_HEIGHT + CELL_GAP) +
    (linkRows > 0 ? LINK_LABEL_HEIGHT + linkRows * (CELL_HEIGHT + CELL_GAP) : 0) +
    PANEL_PADDING;
  /** Everything below the row is the most it can have. When it wants that
   *  much it simply takes it, and the grid scrolls inside. */
  const available = Math.max(160, SCREEN_HEIGHT - top - 8);
  const panelHeight = Math.min(wanted, available);
  const fillsScreen = panelHeight >= available - 1;

  const openDrawer = useCallback(() => {
    rowRef.current?.measureInWindow((_x, y) => {
      setTop(y);
      slide.setValue(0);
      scrim.setValue(0);
      setOpen(true);
    });
  }, [scrim, slide]);

  /** The entrance runs after the modal has mounted — a slide played against
   *  a window that does not exist yet starts halfway down. */
  useEffect(() => {
    if (!open) return;
    Animated.timing(scrim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, scrim, slide]);

  const closeDrawer = useCallback(() => {
    Animated.timing(scrim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOpen(false);
    });
  }, [scrim, slide]);

  /**
   * One cell of the two-column grid.
   *
   * A fixed 48% rather than a flex chip, so both columns line up whatever
   * the words are — the whole point of a grid over a wrapped run.
   */
  const cell = (
    key: string,
    label: string,
    isActive: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        width: "48%",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        // A fixed height, not padding: the panel's own height is worked out
        // from it, and a cell that grew for a two-line label would make that
        // arithmetic a guess.
        height: CELL_HEIGHT,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        backgroundColor: isActive ? "#EFF4F8" : "#F5F5F5",
      }}
    >
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: isActive ? "700" : "500",
          color: isActive ? "#111827" : "#374151",
        }}
      >
        {label}
      </Text>
      {/* The app's own check on the live one (§ Sheets), rather than a
          filled cell that would read as a button. */}
      {isActive && <Check size={17} color="#0369A1" strokeWidth={2.4} />}
    </TouchableOpacity>
  );

  return (
    <>
      <View
        style={{
          backgroundColor: background,
          paddingTop: FILTER_ROW_VERTICAL,
          paddingBottom: FILTER_ROW_VERTICAL,
        }}
      >
        {/* The scroller sits flush to the screen's left edge and pays for its
            own inset inside `contentContainerStyle`, so the first label lands
            at FILTER_ROW_INSET — the same place Home's and Market's do. A
            padded container plus a padded scroller (which is what this was)
            adds the two together and starts the row 34pt in, which is why
            these tabs used to shift under one another. The right side keeps
            its padding on the container, because that is where the chevron
            lives rather than the scroll. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingRight: FILTER_ROW_INSET,
          }}
        >
          <View ref={rowRef} collapsable={false} style={{ flex: 1, position: "relative" }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // Left padding matches the fade's width — without it the first
              // item sits under the fade at rest and reads as unpressable.
              // Which is also why the fade is exactly one inset wide: any
              // wider and clearing it would push the row off the shared
              // left edge again.
              contentContainerStyle={{ paddingLeft: FILTER_ROW_INSET, paddingRight: 12 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: FILTER_ROW_GAP }}>
                {items.map((item) => {
                  const isActive = active === item.key;
                  return (
                    <TouchableOpacity key={item.key} onPress={() => onSelect(item.key)}>
                      <Text
                        className={
                          isActive
                            ? "text-[17px] font-mbold text-gray-900"
                            : "text-[15px] font-medium text-gray-400"
                        }
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Both ends fade, so it reads as a row that continues rather
                than one that has run out. */}
            <LinearGradient
              colors={[background, "rgba(248,249,250,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: FILTER_ROW_INSET,
              }}
            />
            <LinearGradient
              colors={["rgba(248,249,250,0)", background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: FILTER_ROW_INSET,
              }}
            />
          </View>

          {/* Opens only — the panel covers this the moment it is open, so
              closing is its own chevron-up or the scrim below it. */}
          <TouchableOpacity
            onPress={openDrawer}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 6, width: 26, height: 26, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronDown size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Every category at once, dropped out of the row it belongs to. */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeDrawer}
      >
        <View style={{ flex: 1 }}>
          {/* The scrim starts below the panel: the panel is opaque and
              already covers the row, so there is nothing left to dim
              there. Tapping it closes, like any backdrop. */}
          <Animated.View
            style={{
              position: "absolute",
              top: top + panelHeight,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(17,24,39,0.45)",
              opacity: scrim,
            }}
          >
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeDrawer} />
          </Animated.View>

          {/* Clipped to the panel's own box, so the slide comes out from
              behind the row rather than flying in over it. */}
          <View
            style={{
              position: "absolute",
              top,
              left: 0,
              right: 0,
              height: panelHeight,
              overflow: "hidden",
            }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={{
                height: panelHeight,
                backgroundColor: background,
                // Square at the bottom when it reaches the screen's edge —
                // a rounded corner floating over nothing reads as a panel
                // that stopped short.
                borderBottomLeftRadius: fillsScreen ? 0 : 20,
                borderBottomRightRadius: fillsScreen ? 0 : 20,
                borderCurve: "continuous",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                elevation: 8,
                transform: [
                  {
                    translateY: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-panelHeight, 0],
                    }),
                  },
                ],
              }}
            >
              <View
                style={{
                  height: HEADER_HEIGHT,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>
                  {drawerTitle}
                </Text>
                {/* The panel covers the chevron that opened it, so this is
                    the way back up. */}
                <TouchableOpacity onPress={closeDrawer} hitSlop={10}>
                  <ChevronUp size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: PANEL_PADDING }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    rowGap: CELL_GAP,
                  }}
                >
                  {items.map((item) =>
                    cell(item.key, item.label, active === item.key, () => {
                      onSelect(item.key);
                      closeDrawer();
                    }),
                  )}
                </View>

                {links && links.length > 0 && (
                  <>
                    {/* Not filters — see the type's own note. A section
                        label is 13 semibold sentence case (§ Type). */}
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#6B7280",
                        marginTop: 14,
                        marginBottom: 8,
                        paddingHorizontal: 2,
                      }}
                    >
                      {linksLabel}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        rowGap: CELL_GAP,
                      }}
                    >
                      {links.map((link) =>
                        cell(link.key, link.label, false, () => {
                          closeDrawer();
                          link.onPress();
                        }),
                      )}
                      {/* A lone link would stretch across both columns
                          without this; the grid keeps its shape either way. */}
                      {links.length % 2 === 1 && <View style={{ width: "48%" }} />}
                    </View>
                  </>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </>
  );
}
