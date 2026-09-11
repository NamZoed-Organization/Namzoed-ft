/**
 * The shell the legal documents wear: terms, privacy, and whatever follows.
 *
 * These were built as brochures. A navy hero with a 20pt badge in it, then
 * eleven white cards each headed by a rounded tile in a different colour —
 * primary, secondary, blue, purple, green, indigo, red, orange, teal, pink —
 * over callouts in amber, green, red, blue and grey, then a navy footer card
 * with a second badge. Ten hues and three card shapes carrying no information
 * at all: § Icons rules out per-item colour coding, and a document where
 * "Governing Law" is teal and "Termination" is orange is that rule broken ten
 * times on one screen.
 *
 * Worse, the tiles were `bg-gradient-to-br from-… to-…`, which React Native
 * has no equivalent for and NativeWind therefore drops. Every one of those
 * white icons was sitting on nothing — invisible on a white card. The
 * brochure did not even render as a brochure.
 *
 * What a legal document actually needs is to be read: § Grounds' grey with
 * § Groups and rows' white blocks on it, numbered clauses separated by the
 * standard hairline, one icon colour, and hierarchy from weight and size.
 * Numbers stay because a legal document's clause numbers are how people cite
 * it — that is information, unlike the colour was.
 */

import { SettingsScreen } from "@/components/settings/SettingsChrome";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/** § Icons — one colour, one weight, for the whole document. */
export const LEGAL_ICON = "#9CA3AF";
const BODY = "#4B5563";
const HEADING = "#111827";

export function LegalScreen({
  title,
  lede,
  updated,
  version,
  onClose,
  children,
}: {
  title: string;
  /** One paragraph on the grey, above the clauses — what replaced the hero. */
  lede: string;
  updated: string;
  version: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <SettingsScreen title={title} onClose={onClose}>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 22,
          color: BODY,
          // 16, so the lede's text starts on the same vertical as the clause
          // text inside the cards below it (the scroll view already pays 12).
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 18,
        }}
      >
        {lede}
      </Text>

      {children}

      <Text
        style={{
          fontSize: 12.5,
          color: "#9CA3AF",
          textAlign: "center",
          marginTop: 10,
          marginBottom: 4,
        }}
      >
        Last updated {updated} · Version {version}
      </Text>
    </SettingsScreen>
  );
}

/** A numbered clause: one white group (§ Groups and rows). */
export function LegalSection({
  index,
  title,
  note,
  icon,
  children,
}: {
  index: number;
  title: string;
  /** A parenthetical under the title — "(Tshongpas)". */
  note?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        borderCurve: "continuous",
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        {icon ? <View style={{ width: 30 }}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16.5, fontWeight: "700", color: HEADING }}>
            {index}. {title}
          </Text>
          {note ? (
            <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** A paragraph inside a section. */
export function LegalText({
  children,
  strong,
}: {
  children: React.ReactNode;
  /** The one sentence a clause turns on, if it has one. */
  strong?: boolean;
}) {
  return (
    <Text
      style={{
        fontSize: 15,
        lineHeight: 22,
        color: strong ? HEADING : BODY,
        fontWeight: strong ? "600" : "400",
        paddingHorizontal: 16,
        paddingBottom: 16,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * A sub-clause — "3.1 Eligibility" — as a row in the group.
 *
 * The hairline is the separator the whole app uses, inset to where the text
 * starts, in place of the coloured left-border strips and tinted boxes these
 * documents used to draw around every sub-point.
 */
export function LegalClause({
  number,
  title,
  children,
}: {
  number?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: "#f0f0f0",
          marginLeft: 16,
        }}
      />
      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        {title ? (
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: HEADING,
              marginBottom: 4,
            }}
          >
            {number ? `${number} ` : ""}
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? (
          <Text style={{ fontSize: 14.5, lineHeight: 21, color: BODY }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/**
 * A list inside a clause.
 *
 * A bullet and a bold lead-in, not a tinted box per item. `term` is the part
 * being defined; leaving it out gives a plain bullet.
 */
export function LegalBullets({
  items,
}: {
  items: { term?: string; text: string }[];
}) {
  return (
    <View style={{ gap: 7, marginTop: 2 }}>
      {items.map((item, index) => (
        <View key={index} style={{ flexDirection: "row" }}>
          <Text style={{ fontSize: 14.5, lineHeight: 21, color: "#9CA3AF", width: 14 }}>
            •
          </Text>
          <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: BODY }}>
            {item.term ? (
              <Text style={{ fontWeight: "600", color: HEADING }}>
                {item.term}{" "}
              </Text>
            ) : null}
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
