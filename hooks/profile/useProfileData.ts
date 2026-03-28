import { useUser } from "@/contexts/UserContext";
import { fetchUserProfile } from "@/lib/profileService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export const useProfileData = (refreshKey: number) => {
  const { currentUser, setCurrentUser } = useUser();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!currentUser?.id) return;

      try {
        const profile = await fetchUserProfile(currentUser.id);

        if (profile?.avatar_url) {
          setProfileImage(profile.avatar_url);

          if (currentUser?.avatar_url !== profile.avatar_url) {
            const updatedUser = {
              ...currentUser,
              avatar_url: profile.avatar_url,
            };
            await AsyncStorage.setItem(
              "currentUser",
              JSON.stringify(updatedUser),
            );
            setCurrentUser(updatedUser);
          }
        } else {
          const user = currentUser as any;
          if (user?.avatar_url) {
            setProfileImage(user.avatar_url);
          }
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
    followerCount,
    setFollowerCount,
    followingCount,
    setFollowingCount,
  };
};
