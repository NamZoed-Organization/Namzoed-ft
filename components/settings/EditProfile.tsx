import AvatarStylePicker from '@/components/modals/AvatarStylePicker';
import CoverImageViewer from '@/components/modals/CoverImageViewer';
import ProfileImageViewer from '@/components/modals/ProfileImageViewer';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import PopupMessage from '@/components/ui/PopupMessage';
import ProgressiveImage from '@/components/ui/ProgressiveImage';
import { MODAL_RADIUS } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useCoverPalette } from '@/hooks/useCoverPalette';
import { saveAvatarPhoto, saveCoverPhoto } from '@/lib/profileMedia';
import { generatedAvatarFor, type AvatarAnimation } from '@/lib/dicebear';
import { fetchUserProfile, updateUserProfile } from '@/lib/profileService';
import { formatDisplayDate } from '@/utils/age';
import { parseBirthDate } from '@/utils/zodiac';
import { presentSystemPicker, waitForIosModalDismiss } from '@/utils/modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronLeft, ChevronRight, ImageIcon, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditProfileProps {
  onClose?: () => void;
  /** Pushes another settings sub-page (e.g. "editBio") onto the stack. */
  onNavigate?: (modal: string) => void;
}

type PhotoTarget = 'avatar' | 'cover';

const COVER_PREVIEW_HEIGHT = 55;
const COVER_PREVIEW_MAX_WIDTH = 165;

type PendingPick = { target: PhotoTarget; source: 'camera' | 'gallery' } | null;

// The Edit Profile hub. Nothing is edited in place here — the photos are the
// only things that change from this screen, and every text field is a row
// that opens its own single-purpose screen (UI_STANDARD.md), the way
// Edit Bio already worked.
export default function EditProfile({ onClose, onNavigate }: EditProfileProps) {
  const { currentUser, setCurrentUser } = useUser();
  const insets = useSafeAreaInsets();
  // Tapping either photo opens the same full-screen viewer the profile
  // screen uses, and the source choice lives on that viewer — so there's no
  // sheet stacked on top of it just to ask camera-or-library.
  const [viewerFor, setViewerFor] = useState<PhotoTarget | null>(null);
  const [coverRatio, setCoverRatio] = useState<number | null>(null);
  const [pendingPick, setPendingPick] = useState<PendingPick>(null);
  const [showAvatarStyles, setShowAvatarStyles] = useState(false);
  // Two phases, presented differently: "picking" covers the wait before the
  // system picker appears and must render inline (a native modal there eats
  // the picker, or freezes the app — see LoadingOverlay's `presentation`
  // prop), while "saving" covers the upload and can use the modal overlay.
  const [busy, setBusy] = useState<null | 'picking' | 'saving'>(null);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  const avatarUrl = (currentUser as any)?.avatar_url as string | null | undefined;
  const coverUrl = currentUser?.cover_image_url;
  // This row is the owner's own settings entry, so it reports whether a
  // birthday is *set* — the actual date, which only they see here. Reading
  // the public badge instead made a birthday that's set but hidden read as
  // "Not set", which is a different thing entirely.
  const birthDate = parseBirthDate((currentUser as any)?.birth_date);
  // Matches the profile screen's own cover gradient, so a profile with no
  // cover photo shows the same colours in the viewer that it shows there.
  const { cover: coverGradient } = useCoverPalette(
    currentUser?.id,
    coverUrl,
    currentUser?.cover_hue,
  );

  // currentUser is hydrated from AsyncStorage at launch, and a user who
  // came straight here from the drawer (rather than via their profile
  // screen, which syncs on mount) can be carrying a copy saved before these
  // fields existed — every row would read "Not set". One fetch on mount
  // makes the hub right regardless of how it was reached.
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    let cancelled = false;
    fetchUserProfile(userId)
      .then((profile) => {
        if (cancelled || !profile) return;
        syncUser({
          name: profile.name ?? null,
          avatar_url: profile.avatar_url ?? null,
          avatar_style: profile.avatar_style ?? null,
          avatar_animation: profile.avatar_animation ?? 'none',
          cover_image_url: profile.cover_image_url ?? null,
          cover_hue: profile.cover_hue ?? null,
          bio: profile.bio ?? null,
          dzongkhag: profile.dzongkhag ?? null,
          birth_date: profile.birth_date ?? null,
          show_birthday: !!profile.show_birthday,
          birthday_display: profile.birthday_display ?? 'age',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Runs once for the signed-in user; syncUser closes over currentUser,
    // which is exactly the value being replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  // The preview box takes the photo's own shape rather than a fixed banner
  // one, so there are no empty bars beside it. Covers aren't always 3:1 —
  // iOS's built-in editor crops square regardless of the `aspect` passed to
  // the picker (that option is Android-only), so plenty of them are.
  useEffect(() => {
    if (!coverUrl) {
      setCoverRatio(null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      coverUrl,
      (width, height) => {
        if (cancelled || !width || !height) return;
        setCoverRatio(width / height);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  // Closes the viewer first, then queues the pick — the effect below waits
  // for the modal to actually go away before presenting the system picker.
  const choosePhoto = (target: PhotoTarget, source: 'camera' | 'gallery') => {
    setViewerFor(null);
    setPendingPick({ target, source });
  };

  const syncUser = async (patch: Record<string, unknown>) => {
    const updated = { ...currentUser, ...patch };
    await AsyncStorage.setItem('currentUser', JSON.stringify(updated));
    setCurrentUser(updated as any);
  };

  // Picking a generated avatar writes the same three fields the sign-up
  // trigger does (lib/dicebear.ts) — the raster URL every avatar in the app
  // reads, plus the recipe the surfaces that can animate rebuild from.
  const saveGeneratedAvatar = async (style: string, animation: AvatarAnimation) => {
    if (!currentUser?.id) return;
    setBusy('saving');
    try {
      const patch = generatedAvatarFor(currentUser.id, style, animation);
      await updateUserProfile(currentUser.id, patch);
      await syncUser(patch);
      setShowAvatarStyles(false);
      showPopup('success', 'Avatar Updated', 'Your profile avatar has been updated.');
    } catch (error) {
      console.error('Failed to save generated avatar:', error);
      showPopup('error', 'Save Failed', 'Failed to save the avatar. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // Launching the system picker from state rather than from the viewer's own
  // press handler, so the viewer has unmounted before the picker is
  // presented.
  useEffect(() => {
    if (!pendingPick) return;
    const { target, source } = pendingPick;
    setPendingPick(null);

    (async () => {
      // The viewer is a native modal and the system picker is another, so
      // the viewer's dismissal is waited out before anything else happens —
      // a picker presented into it never appears. From there the screen is
      // back to the bare hub with nothing to show for the tap, so the
      // inline indicator goes up and stays up under the picker.
      await waitForIosModalDismiss();
      setBusy('picking');
      try {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            showPopup('error', 'Permission Denied', 'Camera access is needed.');
            return;
          }
        } else {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            showPopup('error', 'Permission Denied', 'Gallery access is needed.');
            return;
          }
        }

        // Square for the avatar, banner for the cover — the picker's own
        // editor handles the crop on both platforms.
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: target === 'avatar' ? [1, 1] : [3, 1],
          quality: 1.0,
        };
        const result = await presentSystemPicker(() =>
          source === 'camera'
            ? ImagePicker.launchCameraAsync(options)
            : ImagePicker.launchImageLibraryAsync(options),
        );

        if (result.canceled || !result.assets?.[0] || !currentUser?.id) return;
        const uri = result.assets[0].uri;
        // The picker is gone; hand over to the modal overlay for the upload.
        setBusy('saving');

        if (target === 'avatar') {
          const url = await saveAvatarPhoto(currentUser.id, uri, avatarUrl);
          await syncUser({ avatar_url: url });
          showPopup('success', 'Photo Updated', 'Your profile photo has been updated.');
        } else {
          const { url, hue } = await saveCoverPhoto(currentUser.id, uri, {
            previousUrl: coverUrl,
            fallbackHue: currentUser.cover_hue,
          });
          await syncUser({ cover_image_url: url, cover_hue: hue });
          showPopup('success', 'Cover Updated', 'Your cover photo has been updated.');
        }
      } catch (error) {
        console.error('Failed to save profile photo:', error);
        showPopup('error', 'Save Failed', 'Failed to save the photo. Please try again.');
      } finally {
        setBusy(null);
      }
    })();
    // currentUser fields are read fresh inside; re-running on their identity
    // would relaunch the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPick]);

  // Fixed height, width follows the photo — clamped so a very wide or very
  // tall cover can't crowd out the label or shrink to a sliver.
  const coverPreviewWidth = Math.round(
    Math.min(
      COVER_PREVIEW_MAX_WIDTH,
      Math.max(COVER_PREVIEW_HEIGHT, COVER_PREVIEW_HEIGHT * (coverRatio ?? 3)),
    ),
  );

  const rows: { key: string; label: string; value?: string | null; modal: string }[] = [
    { key: 'name', label: 'Name', value: (currentUser as any)?.name, modal: 'editName' },
    { key: 'bio', label: 'Bio', value: (currentUser as any)?.bio, modal: 'editBio' },
    {
      key: 'birthday',
      label: 'Birthday',
      value: birthDate ? formatDisplayDate(birthDate) : null,
      modal: 'editBirthday',
    },
    { key: 'location', label: 'Location', value: currentUser?.dzongkhag, modal: 'editLocation' },
  ];

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingBottom: insets.bottom }}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />
      <LoadingOverlay visible={busy === 'saving'} />
      <LoadingOverlay visible={busy === 'picking'} presentation="inline" />

      {/* No Save here — every row saves on its own screen, and the photos
          save the moment they're picked, so back is the only header
          action. */}
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        {/* A chevron rather than "Cancel": this hub has nothing pending to
            cancel — each row saves on its own screen — so it's plain back
            navigation. The form screens it opens keep Cancel/Save. */}
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" }}
          pointerEvents="none"
        >
          <Text className="text-xl font-medium text-gray-900">Edit Profile</Text>
        </View>
        <View className="py-1" style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 }}>
        {/* Profile photo — centered, with the camera badge as the affordance. */}
        <View className="items-center mb-6">
          <TouchableOpacity onPress={() => setViewerFor('avatar')} activeOpacity={0.8}>
            <View
              style={{ width: 104, height: 104, borderRadius: 52, borderCurve: "continuous", overflow: "hidden" }}
              className="bg-gray-200 items-center justify-center"
            >
              {avatarUrl ? (
                <ProgressiveImage
                  uri={avatarUrl}
                  style={{ width: "100%", height: "100%" }}
                  showProgress={false}
                  priority="high"
                />
              ) : (
                <User size={40} strokeWidth={1.5} color="#9CA3AF" />
              )}
            </View>
            <View
              style={{ position: "absolute", right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17, borderCurve: "continuous" }}
              className="bg-white items-center justify-center border border-gray-100"
            >
              <Camera size={18} color="#0369A1" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Cover — a row like the ones below it, but with the preview sized
            so the photo is actually readable in place, rather than needing
            the full-screen viewer to make anything out. The box takes the
            photo's own aspect (see coverPreviewWidth) so it fills the frame
            with no empty bars beside it. */}
        <TouchableOpacity
          onPress={() => setViewerFor('cover')}
          activeOpacity={0.7}
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
          className="bg-white px-4 py-3 flex-row items-center"
        >
          <Text className="text-xl text-gray-900 flex-1">Cover</Text>
          <View
            style={{
              width: coverPreviewWidth,
              height: COVER_PREVIEW_HEIGHT,
              borderRadius: 8,
              borderCurve: "continuous",
              overflow: "hidden",
            }}
            className="bg-gray-100 items-center justify-center mr-3"
          >
            {coverUrl ? (
              <ProgressiveImage
                uri={coverUrl}
                style={{ width: "100%", height: "100%" }}
                showProgress={false}
              />
            ) : (
              <ImageIcon size={20} color="#9CA3AF" />
            )}
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Text fields — each one opens its own screen. */}
        <View
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12, overflow: "hidden" }}
          className="bg-white"
        >
          {rows.map((row, index) => (
            <TouchableOpacity
              key={row.key}
              onPress={() => onNavigate?.(row.modal)}
              activeOpacity={0.7}
              className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
            >
              <Text className="text-xl text-gray-900" style={{ width: 96 }}>
                {row.label}
              </Text>
              <Text
                className="text-xl flex-1 text-right mr-3"
                style={{ color: row.value ? "#6B7280" : "#9CA3AF" }}
                numberOfLines={1}
              >
                {row.value || "Not set"}
              </Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ProfileImageViewer
        visible={viewerFor === 'avatar'}
        imageUri={avatarUrl ?? null}
        onClose={() => setViewerFor(null)}
        onChangePhoto={() => choosePhoto('avatar', 'gallery')}
        onTakePhoto={() => choosePhoto('avatar', 'camera')}
        onGeneratedAvatar={() => {
          setViewerFor(null);
          setShowAvatarStyles(true);
        }}
      />
      <AvatarStylePicker
        visible={showAvatarStyles}
        userId={currentUser?.id ?? ''}
        currentStyle={(currentUser as any)?.avatar_style ?? null}
        currentAnimation={((currentUser as any)?.avatar_animation ?? 'none') as AvatarAnimation}
        saving={busy === 'saving'}
        onClose={() => setShowAvatarStyles(false)}
        onSave={saveGeneratedAvatar}
      />
      <CoverImageViewer
        visible={viewerFor === 'cover'}
        imageUri={coverUrl ?? null}
        gradientColors={coverGradient}
        onClose={() => setViewerFor(null)}
        onChangePhoto={() => choosePhoto('cover', 'gallery')}
        onTakePhoto={() => choosePhoto('cover', 'camera')}
      />
    </View>
  );
}
