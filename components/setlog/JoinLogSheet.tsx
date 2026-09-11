/**
 * Join somebody else's log with their code.
 *
 * This used to be half of a Start/Join sheet, and starting was the half
 * that had to go: a name field and an invite step in front of a two-second
 * video are three decisions guarding a thing whose whole claim is that it
 * costs none. Recording creates your log now (see the capture screen), so
 * all that is left here is redeeming a code for a log that already exists.
 *
 * There is still no member picker. A log is joined by its code, never by
 * being added to — which is what keeps the graph closed: nobody lands in
 * your day because somebody else typed their name.
 */

import BottomSheetModal from "@/components/modals/BottomSheetModal";
import { joinLog } from "@/lib/setlogService";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface JoinLogSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the newly-joined log's id. */
  onDone: (setlogId: string) => void;
  onError: (message: string) => void;
}

export default function JoinLogSheet({
  visible,
  onClose,
  onDone,
  onError,
}: JoinLogSheetProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // A sheet that reopens holding the last attempt's text reads as an error
  // that never cleared.
  useEffect(() => {
    if (!visible) {
      setCode("");
      setBusy(false);
    }
  }, [visible]);

  const canSubmit = !busy && code.trim().length >= 4;

  const submit = async (close: () => void) => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const id = await joinLog(code);
      close();
      onDone(id);
    } catch (e: any) {
      // The database raises the message a person should read here — the log
      // is full, or no log has that code — so it is shown as it is.
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
                Join a log
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => submit(close)}
              disabled={!canSubmit}
              style={{ padding: 4, opacity: canSubmit ? 1 : 0.4 }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#0369A1" />
              ) : (
                <Text style={{ fontSize: 17, fontWeight: "600", color: "#0369A1" }}>
                  Join
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Invite code"
            placeholderTextColor="#9CA3AF"
            maxLength={6}
            autoFocus
            autoCapitalize="characters"
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
              letterSpacing: 4,
              color: "#111",
            }}
          />
          <Text
            style={{ fontSize: 13, lineHeight: 18, color: "#9CA3AF", marginTop: 10 }}
          >
            Six characters, from whoever started the log. Up to 12 people in one.
          </Text>
        </View>
      )}
    </BottomSheetModal>
  );
}
