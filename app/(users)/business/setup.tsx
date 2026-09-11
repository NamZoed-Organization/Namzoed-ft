/**
 * Setting a business up, the first time.
 *
 * Tapping Business used to land people on their own work profile — which,
 * before anybody has filled anything in, is a page with no name, no type,
 * nothing listed and no explanation of what it is for. The only way forward
 * was to find Edit and work out which of eight rows mattered. A blank page
 * is not an invitation; it reads as a broken screen.
 *
 * So the first visit is this instead: the three things a business page needs
 * before it is worth showing anybody, asked one screen at a time in the
 * app's own form shape (§ Form screens). Everything else — hours, a second
 * number, the licence, services — stays on the profile's Edit hub, where it
 * belongs, because none of it is needed to *have* a page.
 *
 * **Three, and no more.** A name, what kind of business it is, and a line
 * about it. The type is not decoration: it decides which sections the
 * profile shows (`lib/businessSections.ts`), so a page created without one
 * is a page that cannot lay itself out. Everything past those three is a
 * reason to abandon the form.
 *
 * Verification is deliberately not here. Selling on the catalogue needs a
 * licence reviewed by a person, and putting that in front of somebody who
 * only wants a page would be asking for a document before they have a
 * business to attach it to — the profile explains it in its own time.
 */

import {
  ChoiceField,
  Field,
  FormScreen,
  Note,
} from "@/components/listings/ListingForm";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { serviceCategories } from "@/data/servicecategory";
import {
  ensureServiceProvider,
  getCategoryIdBySlug,
  updateServiceProviderProfile,
} from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function BusinessSetupScreen() {
  const router = useAppRouter();
  const { currentUser } = useUser();

  const [name, setName] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "error", title: "", message: "" });

  const typeOptions = useMemo(
    () => serviceCategories.map((c) => ({ value: c.slug, label: c.name })),
    [],
  );

  const ready = name.trim().length > 1 && type != null;

  const create = async () => {
    if (!ready || !currentUser?.id || busy) return;
    setBusy(true);
    try {
      // Every profile already has a work-profile row; this makes sure of it
      // rather than assuming, because the whole flow depends on there being
      // one to write to.
      await ensureServiceProvider(String(currentUser.id));
      const categoryId = await getCategoryIdBySlug(type);
      await updateServiceProviderProfile(String(currentUser.id), {
        name: name.trim(),
        master_bio: bio.trim(),
        category_id: categoryId,
      });
      // Replace, not push: the setup screen is not somewhere to come back
      // to, and a back gesture from the new page should leave the flow
      // rather than re-open the form that made it.
      router.replace("/(users)/profile/work" as any);
    } catch (e: any) {
      setPopup({
        visible: true,
        type: "error",
        title: "Couldn't set it up",
        message: e?.message || "That didn't save. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title="Set up your business"
      actionLabel="Create"
      onBack={() => router.back()}
      onAction={create}
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

      <Text className="text-base text-gray-500 leading-6 px-1 pt-1">
        A business page sits beside your personal one — same login, different
        page. Three things and it exists; everything else can wait.
      </Text>

      <Field
        value={name}
        onChangeText={setName}
        placeholder="What is your business called?"
        maxLength={60}
      />

      <ChoiceField
        value={type}
        placeholder="What kind of business is it?"
        title="Kind of business"
        options={typeOptions}
        onSelect={setType}
      />
      <Note>
        This decides what your page shows — a restaurant gets a menu, a shop
        gets a catalogue. You can change it later.
      </Note>

      <Field
        value={bio}
        onChangeText={setBio}
        placeholder="A line about what you do"
        multiline
        maxLength={240}
        counter
      />
      <Note>
        Hours, a work number, your licence and what you sell all live on the
        page once it exists. Verifying comes later, and only if you want to
        sell on the shopping catalogue.
      </Note>

      <TouchableOpacity onPress={() => router.back()} className="py-4 mt-2">
        <Text className="text-base text-gray-400 px-1">
          Not now —{" "}
          <Text className="text-primary font-msemibold">go back</Text>
        </Text>
      </TouchableOpacity>

      <View style={{ height: 12 }} />
    </FormScreen>
  );
}
