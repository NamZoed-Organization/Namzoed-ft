import { useUser } from "@/contexts/UserContext";
import { fetchUserProfile } from "@/lib/profileService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

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

        // Set profile image
        if (profile?.avatar_url) {
          setProfileImage(profile.avatar_url);

          // ALWAYS sync avatar_url from database to context/AsyncStorage
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
          // Fallback to context
          const user = currentUser as any;
          if (user?.avatar_url) {
            setProfileImage(user.avatar_url);
          }
        }

        // Set follower counts from database
        setFollowerCount(profile?.follower_count || 0);
        setFollowingCount(profile?.following_count || 0);
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      }
    };

    loadProfileData();
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
