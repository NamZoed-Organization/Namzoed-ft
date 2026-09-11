/**
 * LoadingOverlay
 *
 * A small rounded-square white card, centered on screen over a dim scrim,
 * holding the app's standard loading indicator (CircularLoader) — for
 * async work that has no natural place of its own to show progress: an
 * image picker that takes a moment to actually open, or an upload that
 * finishes with no visible progress bar until its success/error popup
 * lands. Blocks interaction with the rest of the screen while visible,
 * since something is genuinely in flight underneath it.
 *
 * Rendered through RN's own `Modal` by default rather than a plain
 * absolutely-positioned View — this component can be mounted anywhere in
 * the tree (e.g. DevComponents' preview, nested several inset-padded
 * containers deep inside the Settings screen's own sliding sub-page), and a
 * plain View's absolute fill only ever covers its nearest positioned
 * ancestor, not the true screen. Modal always presents against the real
 * screen bounds — status bar and bottom safe area included — regardless of
 * whatever padding/insets its call site happens to be nested inside.
 *
 * `presentation="inline"` drops the Modal and renders that plain absolute
 * fill instead. It exists for one specific case: covering the gap before a
 * *system* picker (photo library, camera) appears. A native Modal cannot be
 * on screen there — the picker presents on top of whatever is presented, so
 * it either fails to present at all or, if the Modal is dismissed to get out
 * of its way mid-presentation, leaves an orphaned window that swallows every
 * touch in the app. A plain View has no window of its own and none of that
 * applies: the picker simply covers it. The trade-off is that it only fills
 * its nearest positioned ancestor, so it can stop short of the status bar —
 * acceptable for the second or so it is up before the picker slides over it.
 * See presentSystemPicker in utils/modal.ts.
 */

import React from "react";
import { Modal, StyleSheet, View } from "react-native";
import CircularLoader from "@/components/ui/CircularLoader";
import { MODAL_RADIUS } from "@/constants/theme";

const CARD_SIZE = 44;

interface LoadingOverlayProps {
  visible: boolean;
  /** "inline" when a system picker is about to be presented — see above. */
  presentation?: "modal" | "inline";
}

export default function LoadingOverlay({
  visible,
  presentation = "modal",
}: LoadingOverlayProps) {
  // A dark color here isn't painted directly — CircularLoader reads it as
  // "this is sitting on a light backdrop" and picks its third dot's color
  // (black) accordingly. See CircularLoader.tsx.
  const content = (
    <View style={styles.scrim} pointerEvents="auto">
      <View style={styles.card}>
        <CircularLoader size="small" color="#000" />
      </View>
    </View>
  );

  if (presentation === "inline") {
    if (!visible) return null;
    return (
      <View style={styles.inlineHost} pointerEvents="auto">
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Above everything else the screen has drawn, since it is a sibling in the
  // tree rather than a window of its own.
  inlineHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: MODAL_RADIUS,
    borderCurve: "continuous",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
