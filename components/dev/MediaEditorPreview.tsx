/**
 * The picture editor, and what it actually exported.
 *
 * The thing worth checking here is not the layout — it is whether the file
 * that comes out matches the thing that was on screen. A filter preview
 * that drifts from its export is the one bug an editor cannot have, and it
 * is invisible until you put the two side by side, which is exactly what
 * this does: original on the left, exported file on the right, at the same
 * size, after a real run through the real pipeline.
 *
 * It opens on a bundled photograph so the flow can be judged in a simulator
 * with an empty camera roll, and on a picked one when what you need to test
 * is a 4000px original from a real phone.
 */

import MediaEditor, { type EditorResult } from "@/components/create/media/MediaEditor";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import {
  FILTERS,
  hasColor,
  hasGeometry,
  hasOverlays,
  type ImageEdit,
} from "@/lib/mediaEdit";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft } from "lucide-react-native";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 16;
const SCREEN_W = Dimensions.get("window").width;
const FIXTURE = Image.resolveAssetSource(
  require("../../assets/images/getstarted-1.png"),
).uri;

interface MediaEditorPreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function MediaEditorPreview({
  visible,
  onClose,
}: MediaEditorPreviewProps) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState(FIXTURE);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<EditorResult | null>(null);

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!picked.canceled && picked.assets[0]) {
      setSource(picked.assets[0].uri);
      setResult(null);
    }
  };

  const half = (SCREEN_W - GROUP_INSET * 2 - 10) / 2;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GROUP_INSET,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: "#9CA3AF",
              paddingHorizontal: 4,
              paddingBottom: 12,
            }}
          >
            Edit the picture, then compare. The right-hand copy is the file the
            composer would upload — geometry through image-manipulator, colour
            through the GL pass, anything drawn on top flattened last.
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pane label="Original" uri={source} size={half} />
            <Pane
              label={result ? "Exported" : "Not exported yet"}
              uri={result?.uri ?? null}
              size={half}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Action label="Edit this picture" onPress={() => setEditing(true)} primary />
            <Action label="Pick another" onPress={pick} />
          </View>

          {result && <EditSummary edit={result.edit} />}
        </ScrollView>

        <MediaEditor
          visible={editing}
          uri={source}
          edit={result?.edit}
          onCancel={() => setEditing(false)}
          onDone={(r) => {
            setResult(r);
            setEditing(false);
          }}
        />
      </View>
    </Modal>
  );
}

function Pane({
  label,
  uri,
  size,
}: {
  label: string;
  uri: string | null;
  size: number;
}) {
  return (
    <View style={{ width: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 12, color: "#9CA3AF" }}>—</Text>
        )}
      </View>
      <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 6, textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        backgroundColor: primary ? "#094569" : "#fff",
        paddingVertical: 11,
        borderRadius: 999,
        borderCurve: "continuous",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: primary ? "#fff" : "#374151",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Which stages actually ran — the fastest way to catch a "no-op" edit that
 *  re-encoded the picture anyway, which is the tax this pipeline exists to
 *  avoid paying. */
function EditSummary({ edit }: { edit: ImageEdit }) {
  const filter = FILTERS.find((f) => f.id === edit.filter);
  const rows: [string, string][] = [
    ["Geometry pass", hasGeometry(edit) ? "ran" : "skipped"],
    [
      "Colour pass",
      hasColor(edit)
        ? `ran · ${filter?.name ?? "Original"} at ${Math.round(edit.intensity * 100)}%`
        : "skipped",
    ],
    ["Flatten pass", hasOverlays(edit) ? `ran · ${edit.overlays.length}` : "skipped"],
    ["Pinned tags", edit.pins.length ? `${edit.pins.length} (data, not burned in)` : "none"],
  ];

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        borderCurve: "continuous",
        padding: 14,
        marginTop: 16,
        gap: 6,
      }}
    >
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, color: "#6B7280" }}>{k}</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#111" }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}
