/**
 * A new product, as a screen.
 *
 * It was a bottom sheet with a blurred backdrop, bordered fields, an inline
 * `<Picker>` and a full-width green button at the foot — five things §
 * Form screens rules out, in one form. Listing something for sale is not a
 * quick choice made over the screen behind it; it is the longest thing a
 * seller does in this app, and it now reads like the rest of the app's
 * forms: grey ground, white fields, the one action in the header.
 *
 * The verified-shop rule is enforced here as well as by the database
 * (`enforce_verified_seller_for_products`): the check happens *before* the
 * form is shown, because discovering it after filling one in is the failure
 * `VerifyToSellNotice` exists to prevent.
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
import VerifyToSellNotice from "@/components/VerifyToSellNotice";
import { useUser } from "@/contexts/UserContext";
import { categories, categoryNames } from "@/data/categories";
import { createProduct, uploadProductImages } from "@/lib/productsService";
import { canListProducts } from "@/lib/sellerService";
import { useAppRouter } from "@/utils/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

const MAX_PHOTOS = 6;

export default function NewProductScreen() {
  const router = useAppRouter();
  const { currentUser } = useUser();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "error", title: "", message: "" });

  useEffect(() => {
    if (!currentUser?.id) return;
    canListProducts(String(currentUser.id))
      .then(setAllowed)
      .catch(() => setAllowed(false));
  }, [currentUser?.id]);

  const categoryOptions = useMemo(
    () =>
      Object.keys(categories).map((key) => ({
        value: key,
        label: categoryNames[key] ?? key,
      })),
    [],
  );

  // The subcategory list is the chosen category's own, so it cannot offer a
  // tag that belongs to something else.
  const tagOptions = useMemo(
    () =>
      category
        ? categories[category].map((sub) => ({ value: sub.name, label: sub.name }))
        : [],
    [category],
  );

  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  const ready =
    images.length > 0 &&
    name.trim().length > 0 &&
    price.trim().length > 0 &&
    priceValue > 0 &&
    category != null;

  const submit = async () => {
    if (!ready || !currentUser?.id || busy) return;
    setBusy(true);
    try {
      const uploaded = await uploadProductImages(images, String(currentUser.id));
      await createProduct({
        name: name.trim(),
        description: description.trim(),
        price: priceValue,
        category,
        tags: tag ? [tag] : [],
        images: uploaded,
        userId: String(currentUser.id),
      });
      // Back to the catalogue it just joined — a confirmation screen would
      // be a step between the seller and the thing they made.
      router.back();
    } catch (e: any) {
      setPopup({
        visible: true,
        type: "error",
        title: "Couldn't post it",
        message: e?.message || "That didn't go up. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  // Refused before the form, never after it.
  if (allowed === false) {
    return (
      <VerifyToSellNotice visible onClose={() => router.back()} />
    );
  }

  return (
    <FormScreen
      title="New product"
      actionLabel="Post"
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

      <PhotoField
        uris={images}
        max={MAX_PHOTOS}
        onAdd={() => setPicking(true)}
        onRemove={(index) =>
          setImages((prev) => prev.filter((_, i) => i !== index))
        }
      />
      <Note>
        The first picture is the one every grid shows. Daylight, plain
        background, the whole thing in frame.
      </Note>

      <Field value={name} onChangeText={setName} placeholder="What is it?" maxLength={80} />
      <Field
        value={price}
        onChangeText={setPrice}
        placeholder="0.00"
        keyboardType="numeric"
        prefix="Nu."
      />

      <ChoiceField
        value={category}
        placeholder="Category"
        title="Category"
        options={categoryOptions}
        onSelect={(v) => {
          setCategory(v);
          // A tag from the old category would be a label from somebody
          // else's shelf.
          setTag(null);
        }}
      />
      {category != null && tagOptions.length > 0 && (
        <ChoiceField
          value={tag}
          placeholder="Type (optional)"
          title={categoryNames[category] ?? "Type"}
          options={tagOptions}
          onSelect={setTag}
        />
      )}

      <Field
        value={description}
        onChangeText={setDescription}
        placeholder="Describe it — size, condition, what's included"
        multiline
        maxLength={600}
        counter
      />
      <Note>
        This goes on the shopping catalogue, so it stays up until you take it
        down. Something you only have one of belongs on the marketplace
        instead.
      </Note>

      <View style={{ height: 8 }} />
      <TouchableOpacity
        onPress={() => router.replace("/(users)/listings/new-marketplace" as any)}
        className="py-3"
      >
        <Text className="text-base text-gray-400 px-1">
          Selling one of something?{" "}
          <Text className="text-primary font-msemibold">
            List it on the marketplace
          </Text>
        </Text>
      </TouchableOpacity>

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
