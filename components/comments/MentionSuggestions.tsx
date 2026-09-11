/**
 * The list that appears while an `@` is being typed.
 *
 * A people list (§ People lists), so: one white group, 36pt avatars,
 * `UserRound` where there is no photo, hierarchy by weight rather than
 * colour. It sits directly above the composer and is capped in height —
 * a picker that grows until it covers the thing being written is a picker
 * that hides the sentence you are trying to finish.
 *
 * The secondary line says how you know them, because that is what tells two
 * people with the same name apart, and it is the only thing the ranking
 * knows that the reader does not.
 */

import { MentionCandidate } from "@/lib/mentionService";
import { UserRound } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const RELATION_LABEL: Record<MentionCandidate["relation"], string> = {
  mutual: "You follow each other",
  following: "You follow them",
  follower: "Follows you",
  none: "On Namzoed",
};

export default function MentionSuggestions({
  candidates,
  loading,
  onSelect,
}: {
  candidates: MentionCandidate[];
  loading: boolean;
  onSelect: (candidate: MentionCandidate) => void;
}) {
  if (!loading && candidates.length === 0) return null;

  return (
    <View
      style={{
        maxHeight: 232,
        backgroundColor: "#fff",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderCurve: "continuous",
        overflow: "hidden",
      }}
    >
      {loading && candidates.length === 0 ? (
        <View style={{ paddingVertical: 18, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#9CA3AF" />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {candidates.map((candidate, index) => (
            <TouchableOpacity
              key={candidate.id}
              activeOpacity={0.7}
              onPress={() => onSelect(candidate)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 9,
              }}
            >
              {index > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 16 + 36 + 10,
                    right: 0,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: "#f0f0f0",
                  }}
                />
              )}
              {candidate.avatarUrl ? (
                <Image
                  source={{ uri: candidate.avatarUrl }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#F5F5F5",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserRound size={18} color="#9CA3AF" strokeWidth={1.8} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}
                >
                  {candidate.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13.5, color: "#9CA3AF", marginTop: 1 }}
                >
                  {RELATION_LABEL[candidate.relation]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
