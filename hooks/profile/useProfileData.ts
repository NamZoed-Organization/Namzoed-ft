import { useUser } from "@/contexts/UserContext";
import { fetchUserProfile } from "@/lib/profileService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export const useProfileData = (refreshKey: number) => {
  const { currentUser, setCurrentUser } = useUser();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [namzoedId, setNamzoedId] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

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
        setBio(profile?.bio ?? null);
        setNamzoedId(profile?.namzoed_id ?? null);

        // Keep UserContext/AsyncStorage in sync so other screens (e.g.
        // EditProfile) can read bio/cover_image_url/namzoed_id straight off
        // currentUser.
        const nextAvatar = profile?.avatar_url ?? (currentUser as any)?.avatar_url ?? null;
        const nextCover = profile?.cover_image_url ?? null;
        const nextBio = profile?.bio ?? null;
        const nextNamzoedId = profile?.namzoed_id ?? null;
        if (
          currentUser?.avatar_url !== nextAvatar ||
          currentUser?.cover_image_url !== nextCover ||
          currentUser?.bio !== nextBio ||
          currentUser?.namzoed_id !== nextNamzoedId
        ) {
          const updatedUser = {
            ...currentUser,
            avatar_url: nextAvatar,
            cover_image_url: nextCover,
            bio: nextBio,
            namzoed_id: nextNamzoedId,
          };
          await AsyncStorage.setItem(
            "currentUser",
            JSON.stringify(updatedUser),
          );
          setCurrentUser(updatedUser);
        }

        setFollowerCount(profile?.follower_count || 0);
        setFollowingCount(profile?.following_count || 0);
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
