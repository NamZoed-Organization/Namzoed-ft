/**
 * FrequentContacts
 *
 * The people you message most, offered while the search field is focused
 * and still empty.
 *
 * One horizontally-scrolling row of 52pt avatars, exactly as the share
 * sheet's "Send to" does it (§ Sheets). What it replaces was a four-column
 * wrapped grid with its own vertical ScrollView capped at three rows —
 * a scroll area nested inside a scrolling screen, which is the thing that
 * section calls out by name: the inner list steals the drag, and the row
 * that is half-visible at the cap reads as a rendering bug.
 *
 * Presentational, so the dev preview can show it against a list that is
 * long enough to scroll.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { UserRound } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const AVATAR = 52;
const GROUP_RADIUS = 18;

export interface FrequentContact {
  id: string;
  name: string;
  avatar: string | null;
}

interface FrequentContactsProps {
  contacts: FrequentContact[];
  onPress: (id: string) => void;
}

export default function FrequentContacts({ contacts, onPress }: FrequentContactsProps) {
  if (contacts.length === 0) return null;

  return (
    <View style={{ marginBottom: 14 }}>
      {/* § Type — sentence case, never uppercase with letter-spacing. */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: "#6B7280",
          marginBottom: 8,
          paddingHorizontal: 4,
        }}
      >
        Frequent contacts
      </Text>

      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: GROUP_RADIUS,
          borderCurve: "continuous",
          overflow: "hidden",
          paddingVertical: 14,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}
        >
          {contacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              onPress={() => onPress(contact.id)}
              activeOpacity={0.75}
              style={{ width: 64, alignItems: "center" }}
            >
              <View
                style={{
                  width: AVATAR,
                  height: AVATAR,
                  borderRadius: AVATAR / 2,
                  borderCurve: "continuous",
                  backgroundColor: contact.avatar ? "#E5E7EB" : "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {contact.avatar ? (
                  <ProgressiveImage
                    uri={contact.avatar}
                    style={{ width: "100%", height: "100%" }}
                    showProgress={false}
                    recyclingKey={contact.avatar}
                  />
                ) : (
                  <UserRound size={22} color="#9CA3AF" strokeWidth={1.8} />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={{ marginTop: 6, fontSize: 13, color: "#111", width: "100%", textAlign: "center" }}
              >
                {contact.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
