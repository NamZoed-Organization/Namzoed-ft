import { Text, View, TouchableOpacity } from "react-native";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { currentUser, logout } = useUser();
  const router = useRouter();

  console.log("Current user in profile:", currentUser);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View className="flex-1 items-center justify-center bg-background  px-4">
      <Text className="text-2xl font-mbold text-primary mb-2">Profile</Text>
      {currentUser ? (
        <>
          <Text className="text-xl font-medium text-gray-700 mb-4">
            {currentUser.username}
          </Text>
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-500 px-6 py-3 rounded-lg mt-4"
          >
            <Text className="text-white font-medium">Logout</Text>
          </TouchableOpacity>
          <Text className="text-sm text-gray-500 mt-4">
            Debug: {JSON.stringify(currentUser, null, 2)}
          </Text>
        </>
      ) : (
        <Text className="text-base font-regular text-gray-500 text-center">
          No user logged in
        </Text>
      )}
    </View>
  );
}
