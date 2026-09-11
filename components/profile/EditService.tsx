/**
 * EditService
 *
 * Add or edit one service. Presentational: it owns the form and the save, and
 * nothing about where it sits — it is rendered as a sliding sub-page inside
 * EditWorkProfile, the same way the settings screen's pages slide within
 * Settings rather than pushing a route.
 *
 * The two modals it replaces (AddServicesModal, EditServicesModal) each held
 * the whole form at once: name, description, category and images stacked in a
 * sheet with a Save at the bottom. That is the shape UI_STANDARD.md moved the
 * profile off — a long form makes every field feel optional — and a sheet is
 * the wrong container for it besides, since editing a service is a place you
 * go, not something you glance at over the page beneath.
 *
 * Built to the form-screen rules: grey ground, three-part header with Save as
 * the single right-hand text action, unbordered white fields at `text-xl`,
 * counters floating inside, explanatory copy below the control it explains.
 * The category is a short list, so it renders inline as selectable rows with
 * a Check rather than opening yet another sheet.
 *
 * The ground and the bottom inset belong to the layer that slides it, so
 * nothing here pads for the safe area.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { MODAL_RADIUS } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { serviceCategories } from "@/data/servicecategory";
import {
  createProviderService,
  deleteProviderService,
  ensureServiceProvider,
  fetchProviderServiceById,
  updateProviderService,
  uploadServiceImages,
} from "@/lib/servicesService";
import { presentSystemPicker } from "@/utils/modal";
import * as ImagePicker from "expo-image-picker";
import { Check, ChevronLeft, ImagePlus, Trash2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 600;
const MAX_IMAGES = 6;

/** Dev only: stands in for the fetch and for the save, so the fixture-driven
 *  preview can drive this exact form without a provider row behind it. */
export interface ServicePreview {
  name: string;
  description: string;
  images: string[];
}

interface EditServiceProps {
  /** Absent means a new service. */
  serviceId?: string | null;
  onClose: () => void;
  /** Saved or deleted — the list behind this needs refetching either way. */
  onSaved: () => void;
  preview?: ServicePreview;
}

export default function EditService({ serviceId, onClose, onSaved, preview }: EditServiceProps) {
  const { currentUser } = useUser();

  const isNew = !serviceId;

  const [loading, setLoading] = useState(!isNew && !preview);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(preview?.name ?? "");
  const [description, setDescription] = useState(preview?.description ?? "");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(preview?.images ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "error", title: "", message: "" });

  // Remembered so Save can tell "nothing changed" from "changed back", the
  // same rule every other form here follows.
  const [original, setOriginal] = useState({
    name: preview?.name ?? "",
    description: preview?.description ?? "",
    images: preview?.images ?? [],
  });

  useEffect(() => {
    if (isNew || !serviceId || preview) return;
    let cancelled = false;
    fetchProviderServiceById(serviceId)
      .then((service) => {
        if (cancelled || !service) return;
        setName(service.name ?? "");
        setDescription(service.description ?? "");
        setCategorySlug(service.service_categories?.slug ?? null);
        setImages(service.images ?? []);
        setOriginal({
          name: service.name ?? "",
          description: service.description ?? "",
          images: service.images ?? [],
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [serviceId, isNew, preview]);

  const showError = (message: string, title = "Couldn't save") =>
    setPopup({ visible: true, type: "error", title, message });

  const pickImages = useCallback(
    async (source: "camera" | "gallery") => {
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) return;

      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showError(
          source === "camera" ? "Camera access is needed." : "Gallery access is needed.",
          "Permission Denied",
        );
        return;
      }

      // Through presentSystemPicker, so nothing of ours is on screen when the
      // system picker opens — see utils/modal.ts.
      const result = await presentSystemPicker(() =>
        source === "camera"
          ? ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
          : ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.9,
              allowsMultipleSelection: true,
              selectionLimit: remaining,
            }),
      );

      if (result.canceled || !result.assets?.length) return;
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
    },
    [images.length],
  );

  const dirty =
    isNew ||
    name.trim() !== original.name.trim() ||
    description.trim() !== original.description.trim() ||
    images.join("|") !== original.images.join("|");

  const canSave = !saving && dirty && name.trim().length > 0 && (!isNew || categorySlug != null);

  const handleSave = async () => {
    if (!canSave) return;
    // Nothing behind a fixture to write to.
    if (preview) {
      onSaved();
      return;
    }
    if (!currentUser?.id) return;
    setSaving(true);
    try {
      if (isNew) {
        await createProviderService(
          currentUser.id,
          categorySlug!,
          name.trim(),
          description.trim(),
          images,
        );
      } else {
        // Only the newly-picked ones need uploading; the rest are already
        // remote URLs and re-uploading them would duplicate the files. The
        // provider id is what the storage path is keyed on, so it has to be
        // the real one — ensureServiceProvider returns the existing row here
        // rather than creating anything.
        const providerId = await ensureServiceProvider(currentUser.id);
        const local = images.filter((uri) => !uri.startsWith("http"));
        const uploaded = local.length ? await uploadServiceImages(local, providerId) : [];
        const merged = images.filter((uri) => uri.startsWith("http")).concat(uploaded);
        await updateProviderService(serviceId!, {
          name: name.trim(),
          description: description.trim(),
          images: merged,
        });
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save service:", error);
      showError("Something went wrong saving this service. Please try again.");
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!serviceId) return;
    if (preview) {
      onSaved();
      return;
    }
    Alert.alert("Delete service", "This removes the service and its photos. It can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProviderService(serviceId);
            onSaved();
          } catch (error) {
            console.error("Failed to delete service:", error);
            showError("Couldn't delete this service.", "Delete failed");
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1">
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <Text className="text-xl font-medium text-gray-900">
            {isNew ? "New service" : "Edit service"}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSave} disabled={!canSave} className="py-1">
          {saving ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text className="text-xl font-medium" style={{ color: canSave ? "#0369A1" : "#93C5FD" }}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* No label above the field — the placeholder carries it. */}
            <View style={{ position: "relative" }}>
              <TextInput
                style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", paddingBottom: 34 }}
                className="bg-white px-4 py-3 text-xl text-gray-900"
                placeholder="What is this service called?"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                maxLength={NAME_MAX}
              />
              <Text
                className="text-xl text-gray-400"
                style={{ position: "absolute", right: 12, bottom: 10 }}
              >
                {name.length}/{NAME_MAX}
              </Text>
            </View>

            <View style={{ position: "relative", marginTop: 12 }}>
              <TextInput
                style={{
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                  minHeight: 160,
                  paddingBottom: 34,
                  textAlignVertical: "top",
                }}
                className="bg-white px-4 py-3 text-xl text-gray-900"
                placeholder="What does it include, and who is it for?"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={(t) => setDescription(t.slice(0, DESCRIPTION_MAX))}
                multiline
                maxLength={DESCRIPTION_MAX}
              />
              <Text
                className="text-xl text-gray-400"
                style={{ position: "absolute", right: 12, bottom: 10 }}
              >
                {description.length}/{DESCRIPTION_MAX}
              </Text>
            </View>

            {/* Photos. A service with none is legitimate, so this never
                blocks Save — it just looks emptier in the grid. */}
            <View
              style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12 }}
              className="bg-white p-3"
            >
              <View className="flex-row flex-wrap">
                {images.map((uri, index) => (
                  <View key={`${uri}-${index}`} className="w-[33.33%] p-1">
                    <View
                      style={{ borderRadius: 8, borderCurve: "continuous", overflow: "hidden" }}
                      className="bg-gray-100 h-24"
                    >
                      <ProgressiveImage
                        uri={uri}
                        style={{ width: "100%", height: "100%" }}
                        showProgress={false}
                      />
                      <TouchableOpacity
                        onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 items-center justify-center"
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {images.length < MAX_IMAGES && (
                  <View className="w-[33.33%] p-1">
                    <TouchableOpacity
                      onPress={() => setShowPicker(true)}
                      activeOpacity={0.7}
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      className="bg-gray-50 h-24 items-center justify-center border border-gray-100"
                    >
                      <ImagePlus size={22} color="#9CA3AF" strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
            <Text className="text-base text-gray-400 mt-3 px-1">
              Up to {MAX_IMAGES} photos. The first one is what people see in the grid.
            </Text>

            {/* Category — only on a new service. Moving an existing one
                between categories would silently change which businesses it
                is found alongside, and the business's own type with it. */}
            {isNew ? (
              <>
                <View
                  style={{
                    borderRadius: MODAL_RADIUS,
                    borderCurve: "continuous",
                    marginTop: 20,
                    overflow: "hidden",
                  }}
                  className="bg-white"
                >
                  {serviceCategories.map((category, index) => (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => setCategorySlug(category.slug)}
                      activeOpacity={0.7}
                      className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
                    >
                      <Text className="text-xl text-gray-900 flex-1">{category.name}</Text>
                      {categorySlug === category.slug && <Check size={20} color="#0369A1" />}
                    </TouchableOpacity>
                  ))}
                </View>
                <Text className="text-base text-gray-400 mt-3 px-1">
                  Your first service also sets what kind of business you are, which decides the
                  sections your profile shows.
                </Text>
              </>
            ) : null}

            {!isNew && (
              <TouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.7}
                style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 24 }}
                className="bg-white px-4 py-4 flex-row items-center"
              >
                <Trash2 size={20} color="#DC2626" />
                <Text className="text-xl ml-3" style={{ color: "#DC2626" }}>
                  Delete service
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <ImagePickerSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onCameraPress={() => pickImages("camera")}
        onGalleryPress={() => pickImages("gallery")}
        title="Add a photo"
      />
    </View>
  );
}
