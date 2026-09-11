/**
 * A new marketplace listing, as a screen.
 *
 * The same form rules as the product screen next door (§ Form screens), and
 * deliberately the same shape: these two are the app's two ways of putting
 * something up for sale, and a seller moving between them should not have to
 * relearn where anything is. What differs is only the questions — a kind, a
 * place, and a price that is allowed to be nothing.
 *
 * **The kind comes first**, because it changes what the rest of the form
 * means: a job vacancy has no price and a giveaway has one of zero. It is
 * the one place here that keeps a row of chips rather than a sheet — five
 * short words that people choose between constantly, where a sheet would be
 * two taps for something that should be one.
 */

import {
  ChoiceField,
  Field,
  FormScreen,
  Note,
  PhotoField,
  PhotoPicker,
} from "@/components/listings/ListingForm";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
import {
  createMarketplaceItem,
  uploadMarketplaceImages,
} from "@/lib/postMarketPlace";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

const MAX_PHOTOS = 5;

type Kind = "second_hand" | "rent" | "swap" | "free" | "job_vacancy";

const KINDS: { value: Kind; label: string }[] = [
  { value: "second_hand", label: "Second hand" },
  { value: "rent", label: "Rent" },
  { value: "swap", label: "Swap" },
  { value: "free", label: "Free" },
  { value: "job_vacancy", label: "Job" },
];

/** What each kind actually asks for. A vacancy has no price and no
 *  condition; a giveaway has no price to name either. */
const wantsPrice = (kind: Kind) => kind === "second_hand" || kind === "rent";

export default function NewMarketplaceScreen() {
  const router = useAppRouter();
  const { currentUser } = useUser();
  const { kind: initialKind } = useLocalSearchParams<{ kind?: string }>();

  const [kind, setKind] = useState<Kind>(
    KINDS.some((k) => k.value === initialKind)
      ? (initialKind as Kind)
      : "second_hand",
  );
  const [images, setImages] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [dzongkhag, setDzongkhag] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "error", title: "", message: "" });

  const dzongkhagOptions = useMemo(
    () => dzongkhagCenters.map((dz) => ({ value: dz.name, label: dz.name })),
    [],
  );

  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  const ready =
    images.length > 0 &&
    title.trim().length > 0 &&
    (!wantsPrice(kind) || (price.trim().length > 0 && priceValue > 0));

  const submit = async () => {
    if (!ready || !currentUser?.id || busy) return;
    setBusy(true);
    try {
      const uploaded = await uploadMarketplaceImages(images);
      await createMarketplaceItem({
        type: kind,
        title: title.trim(),
        description: description.trim(),
        price: wantsPrice(kind) ? priceValue : 0,
        images: uploaded,
        dzongkhag: dzongkhag ?? undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        userId: String(currentUser.id),
      });
      router.back();
    } catch (e: any) {
      setPopup({
        visible: true,
        type: "error",
        title: "Couldn't list it",
        message: e?.message || "That didn't go up. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title="New listing"
      actionLabel="List"
      onBack={() => router.back()}
      onAction={submit}
      canAct={ready}
      busy={busy}
    >
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

      {/* The kind, as chips: five short words chosen constantly, where a
          sheet would be two taps for a one-tap decision (§ Tabs and pills). */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {KINDS.map((k) => {
          const on = kind === k.value;
          return (
            <TouchableOpacity
              key={k.value}
              onPress={() => setKind(k.value)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: on ? "#094569" : "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: on ? "700" : "500",
                  color: on ? "#fff" : "#6B7280",
                }}
              >
                {k.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <PhotoField
        uris={images}
        max={MAX_PHOTOS}
        onAdd={() => setPicking(true)}
        onRemove={(index) =>
          setImages((prev) => prev.filter((_, i) => i !== index))
        }
      />

      <Field
        value={title}
        onChangeText={setTitle}
        placeholder={kind === "job_vacancy" ? "What is the job?" : "What is it?"}
        maxLength={80}
      />

      {wantsPrice(kind) && (
        <Field
          value={price}
          onChangeText={setPrice}
          placeholder={kind === "rent" ? "Per month" : "0.00"}
          keyboardType="numeric"
          prefix="Nu."
        />
      )}

      <Field
        value={description}
        onChangeText={setDescription}
        placeholder={
          kind === "job_vacancy"
            ? "What the work is, and what you're looking for"
            : "Condition, age, why you're letting it go"
        }
        multiline
        maxLength={800}
        counter
      />

      <ChoiceField
        value={dzongkhag}
        placeholder="Where is it?"
        title="Dzongkhag"
        options={dzongkhagOptions}
        onSelect={setDzongkhag}
      />
      <Note>
        Buyers filter by dzongkhag, so a listing without one is a listing
        fewer people see.
      </Note>

      <Field
        value={tags}
        onChangeText={setTags}
        placeholder="Tags, separated by commas"
        maxLength={120}
      />
      <Note>
        There is no cart here — people message you and you agree between
        yourselves, in the chat you already use.
      </Note>

      <PhotoPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPicked={(uri) =>
          setImages((prev) => [...prev, uri].slice(0, MAX_PHOTOS))
        }
      />
    </FormScreen>
  );
}
