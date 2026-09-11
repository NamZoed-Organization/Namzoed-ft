import { useUser } from "@/contexts/UserContext";
import { normalizeHue } from "@/lib/coverTheme";
import { fetchUserProfile } from "@/lib/profileService";
import { peekCache, readCache, writeCache } from "@/lib/queryCache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

interface CachedProfileCore {
  profileImage: string | null;
  coverImage: string | null;
  coverHue: number | null;
  bio: string | null;
  namzoedId: string | null;
  followerCount: number;
  followingCount: number;
}

const profileCoreCacheKey = (userId: string) => `profile:core:${userId}`;

export const useProfileData = (refreshKey: number) => {
  const { currentUser, setCurrentUser } = useUser();
  const cachedCore = currentUser?.id
    ? peekCache<CachedProfileCore>(profileCoreCacheKey(currentUser.id))?.data ?? null
    : null;
  const [profileImage, setProfileImage] = useState<string | null>(cachedCore?.profileImage ?? null);
  const [coverImage, setCoverImage] = useState<string | null>(cachedCore?.coverImage ?? null);
  // The stored gradient hue travels with the cover image everywhere below —
  // seeding it from cache too is what keeps a revisit from painting the
  // fallback color for a frame before the fetch lands.
  const [coverHue, setCoverHue] = useState<number | null>(
    normalizeHue(cachedCore?.coverHue),
  );
  const [bio, setBio] = useState<string | null>(cachedCore?.bio ?? null);
  const [namzoedId, setNamzoedId] = useState<string | null>(cachedCore?.namzoedId ?? null);
  const [followerCount, setFollowerCount] = useState(cachedCore?.followerCount ?? 0);
  const [followingCount, setFollowingCount] = useState(cachedCore?.followingCount ?? 0);

  // Re-navigating to the profile screen unmounts/remounts it (it's a plain
  // Stack push, not a pre-mounted tab), so without this every visit would
  // start blank and refetch from scratch. The state above seeds instantly
  // from whatever's in memory from this session; this effect also checks
  // AsyncStorage (covers a cold app start where memory is empty) before the
  // network fetch resolves and overwrites both with the fresh result.
  useEffect(() => {
    if (!currentUser?.id) return;
    const key = profileCoreCacheKey(currentUser.id);
    readCache<CachedProfileCore>(key).then((cached) => {
      if (!cached) return;
      setProfileImage(cached.data.profileImage);
      setCoverImage(cached.data.coverImage);
      setCoverHue(normalizeHue(cached.data.coverHue));
      setBio(cached.data.bio);
      setNamzoedId(cached.data.namzoedId);
      setFollowerCount(cached.data.followerCount);
      setFollowingCount(cached.data.followingCount);
    });
  }, [currentUser?.id]);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!currentUser?.id) return;

      try {
        const profile = await fetchUserProfile(currentUser.id);

        if (profile?.avatar_url) {
          setProfileImage(profile.avatar_url);
        } else {
          const user = currentUser as any;
          if (user?.avatar_url) {
            setProfileImage(user.avatar_url);
          }
        }
        setCoverImage(profile?.cover_image_url ?? null);
        setCoverHue(normalizeHue(profile?.cover_hue));
        setBio(profile?.bio ?? null);
        setNamzoedId(profile?.namzoed_id ?? null);

        // Keep UserContext/AsyncStorage in sync so other screens (e.g.
        // EditProfile) can read bio/cover_image_url/namzoed_id straight off
        // currentUser.
        const nextAvatar = profile?.avatar_url ?? (currentUser as any)?.avatar_url ?? null;
        const nextCover = profile?.cover_image_url ?? null;
        const nextCoverHue = normalizeHue(profile?.cover_hue);
        const nextBio = profile?.bio ?? null;
        const nextNamzoedId = profile?.namzoed_id ?? null;
        // Birthday fields aren't rendered by this hook, but the profile
        // header and the Edit Profile hub read them off currentUser, so
        // they have to ride along in the same sync.
        const nextBirthDate = profile?.birth_date ?? null;
        const nextShowBirthday = !!profile?.show_birthday;
        const nextBirthdayDisplay = profile?.birthday_display ?? 'age';
        // The generated avatar's recipe rides along too — the profile header
        // reads it off currentUser to decide whether its avatar animates
        // (§ Generated avatars), and a session cached before these columns
        // existed would otherwise never learn about them.
        const nextAvatarStyle = profile?.avatar_style ?? null;
        const nextAvatarAnimation = profile?.avatar_animation ?? 'none';
        if (
          currentUser?.avatar_style !== nextAvatarStyle ||
          (currentUser?.avatar_animation ?? 'none') !== nextAvatarAnimation ||
          currentUser?.avatar_url !== nextAvatar ||
          currentUser?.cover_image_url !== nextCover ||
          normalizeHue(currentUser?.cover_hue) !== nextCoverHue ||
          currentUser?.bio !== nextBio ||
          currentUser?.namzoed_id !== nextNamzoedId ||
          currentUser?.birth_date !== nextBirthDate ||
          !!currentUser?.show_birthday !== nextShowBirthday ||
          (currentUser?.birthday_display ?? 'age') !== nextBirthdayDisplay
        ) {
          const updatedUser = {
            ...currentUser,
            avatar_url: nextAvatar,
            avatar_style: nextAvatarStyle,
            avatar_animation: nextAvatarAnimation,
            cover_image_url: nextCover,
            cover_hue: nextCoverHue,
            bio: nextBio,
            namzoed_id: nextNamzoedId,
            birth_date: nextBirthDate,
            show_birthday: nextShowBirthday,
            birthday_display: nextBirthdayDisplay,
          };
          await AsyncStorage.setItem(
            "currentUser",
            JSON.stringify(updatedUser),
          );
          setCurrentUser(updatedUser);
        }

        const nextFollowerCount = profile?.follower_count || 0;
        const nextFollowingCount = profile?.following_count || 0;
        setFollowerCount(nextFollowerCount);
        setFollowingCount(nextFollowingCount);

        await writeCache<CachedProfileCore>(profileCoreCacheKey(currentUser.id), {
          profileImage: nextAvatar,
          coverImage: nextCover,
          coverHue: nextCoverHue,
          bio: nextBio,
          namzoedId: nextNamzoedId,
          followerCount: nextFollowerCount,
          followingCount: nextFollowingCount,
        });
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadProfileData();
    });
    return () => task.cancel();
  }, [currentUser, refreshKey]);

  return {
    profileImage,
    setProfileImage,
    coverImage,
    setCoverImage,
    coverHue,
    setCoverHue,
    bio,
    setBio,
    namzoedId,
    setNamzoedId,
    followerCount,
    setFollowerCount,
    followingCount,
    setFollowingCount,
  };
};
