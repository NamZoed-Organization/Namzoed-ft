/**
 * Start a squad — the second answer on the Squad tab, never the first.
 *
 * Joining is what puts you in a day that is already running; starting one
 * puts you in an empty room and hands you a code to fill it. That is the
 * whole reason this is a quiet row under the join card rather than a button
 * beside it, and the reason the sheet ends where it does: it creates the
 * log and lands you *in* it, where Invite is, instead of stopping to
 * congratulate you.
 *
 * The name is optional and the field says so. `setlogDisplayName` prints
 * "Untitled log" for one nobody named, so a name is a convenience for
 * telling two squads apart — not a gate in front of one.
 */

import BottomSheetModal from "@/components/modals/BottomSheetModal";
import { createLog } from "@/lib/setlogService";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface StartSquadSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the new log's id. */
  onDone: (setlogId: string) => void;
  onError: (message: string) => void;
}

export default function StartSquadSheet({
  visible,
  onClose,
  onDone,
  onError,
}: StartSquadSheetProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // A sheet that reopens holding the last attempt's text reads as something
  // that never finished.
  useEffect(() => {
    if (!visible) {
      setName("");
      setBusy(false);
    }
  }, [visible]);

  const submit = async (close: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createLog(name);
      close();
      onDone(id);
    } catch (e: any) {
      onError(e?.message || "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="46%"
      avoidKeyboard
    >
      {(close) => (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 18,
            }}
          >
            <TouchableOpacity onPress={close} style={{ padding: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: "500", color: "#6B7280" }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>
                Start a squad
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => submit(close)}
              disabled={busy}
              style={{ padding: 4, opacity: busy ? 0.4 : 1 }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#0369A1" />
              ) : (
                <Text style={{ fontSize: 17, fontWeight: "600", color: "#0369A1" }}>
                  Start
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name it, or leave it blank"
            placeholderTextColor="#9CA3AF"
            maxLength={40}
            autoFocus
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => submit(close)}
            style={{
              backgroundColor: "#F5F5F5",
              borderRadius: 12,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 20,
              fontWeight: "600",
              color: "#111",
            }}
          />
          <Text
            style={{ fontSize: 13, lineHeight: 18, color: "#9CA3AF", marginTop: 10 }}
          >
            You&apos;ll get a code to send whoever is in it. Up to 12 people, and
            nobody joins without it.
          </Text>
        </View>
      )}
    </BottomSheetModal>
  );
}
