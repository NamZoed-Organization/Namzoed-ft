import DateOfBirthPrompt from "@/components/modals/DateOfBirthPrompt";
import FormInput from "@/components/ui/FormInput";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { clamp, useResponsive } from "@/utils/responsive";
import { isMongooseUser } from "@/utils/roleCheck";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useAppRouter } from "@/utils/navigation";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

WebBrowser.maybeCompleteAuthSession();
const NATIVE_OAUTH_REDIRECT = "namzoed://login";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.216 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.958 3.042l5.657-5.657C34.057 6.053 29.265 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.654 15.108 18.961 12 24 12c3.059 0 5.842 1.153 7.958 3.042l5.657-5.657C34.057 6.053 29.265 4 24 4c-7.682 0-14.36 4.337-17.694 10.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.163 0 9.879-1.977 13.438-5.189l-6.19-5.238C29.176 35.181 26.701 36 24 36c-5.195 0-9.625-3.317-11.287-7.943l-6.522 5.025C9.485 39.556 16.18 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.055 5.573l.003-.002 6.19 5.238C37 39.167 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"
      />
    </Svg>
  );
}

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useAppRouter();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phonePromptValue, setPhonePromptValue] = useState("");
  const [phonePromptLoading, setPhonePromptLoading] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any | null>(null);
  const [pendingResolvedEmail, setPendingResolvedEmail] = useState("");
  const [showDobPrompt, setShowDobPrompt] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});
  const { setCurrentUser } = useUser();

  const showPopup = (type: 'success'|'error'|'warning'|'white', title: string, message: string) => {
    setPopup({visible: true, type, title, message});
    setTimeout(() => setPopup(p => ({...p, visible: false})), 2500);
  };
  const { ms, vs, wp } = useResponsive();
  const screenPaddingX = clamp(wp(10), 20, 44);
  const headerBottomSpacing = clamp(vs(32), 24, 40);
  const titleSize = clamp(ms(36), 30, 42);
  const logoSize = clamp(ms(112), 88, 132);
  const fieldGap = clamp(vs(12), 10, 16);
  const loginButtonPaddingY = clamp(vs(20), 14, 22);
  const loginButtonMarginY = clamp(vs(40), 24, 48);
  const buttonRadius = clamp(ms(10), 8, 14);
  const buttonLabelSize = clamp(ms(18), 16, 20);
  const helperTextSize = clamp(ms(14), 12, 16);
  const oauthButtonPaddingY = clamp(vs(16), 12, 18);
  const oauthRadius = clamp(ms(12), 10, 16);
  const oauthTextSize = clamp(ms(16), 14, 18);
  const iconSize = clamp(ms(20), 18, 24);
  const modalPaddingX = clamp(wp(6), 16, 30);
  const modalCardPadding = clamp(ms(20), 16, 26);
  const modalTitleSize = clamp(ms(22), 18, 26);

  const isValidEmail = (input: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  };

  const normalizeBhutanPhone = (input: string) => {
    const compact = input.trim().replace(/\s+/g, "");
    return compact.startsWith("+975") ? compact.slice(4) : compact;
  };

  const isValidBhutanesePhone = (input: string) => {
    const normalized = normalizeBhutanPhone(input);
    return (
      /^[0-9]{8}$/.test(normalized) &&
      (normalized.startsWith("17") || normalized.startsWith("77"))
    );
  };

  const isIdentifierEmail = identifier.includes("@");
  const isIdentifierValid = isIdentifierEmail
    ? isValidEmail(identifier)
    : isValidBhutanesePhone(identifier);

  const handleClearIdentifier = () => {
    setIdentifier("");
  };

  const completeLogin = async (userData: any, resolvedEmail: string) => {
    // Optional age prompt: give existing users without a date of birth a chance
    // to provide one (so we can apply age-related content rules), but they can skip it.
    if (
      userData?.id &&
      !userData?.birth_date &&
      !userData?.dob_prompt_skipped
    ) {
      setPendingUserData(userData);
      setPendingResolvedEmail(resolvedEmail);
      setShowDobPrompt(true);
      return;
    }

    await AsyncStorage.setItem("currentUser", JSON.stringify(userData));
    setCurrentUser(userData);
    setPendingUserData(null);
    setIdentifier("");
    setPassword("");

    if (resolvedEmail && isMongooseUser(resolvedEmail)) {
      router.replace("/mongoose-dashboard");
    } else {
      router.replace("/(users)/(tabs)");
    }
  };

  const ensureProfileFromAuthUser = async (authUser: any) => {
    const providerMeta = authUser?.user_metadata || {};
    const providerName =
      providerMeta.full_name ||
      providerMeta.name ||
      providerMeta.user_name ||
      null;
    const providerAvatar =
      providerMeta.avatar_url ||
      providerMeta.picture ||
      providerMeta.photo_url ||
      null;

    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Profile fetch error:", fetchError);
    }

    const profilePayload: any = {
      id: authUser.id,
      email: authUser.email ?? existingProfile?.email ?? null,
      updated_at: new Date().toISOString(),
    };

    if (!existingProfile?.name && providerName)
      profilePayload.name = providerName;
    if (!existingProfile?.avatar_url && providerAvatar)
      profilePayload.avatar_url = providerAvatar;

    if (!existingProfile) {
      profilePayload.created_at = new Date().toISOString();
      if (!profilePayload.name && authUser.email) {
        profilePayload.name = authUser.email.split("@")[0];
      }
    }

    const hasUsefulUpdates =
      !existingProfile ||
      (!!profilePayload.name &&
        profilePayload.name !== existingProfile?.name) ||
      (!!profilePayload.avatar_url &&
        profilePayload.avatar_url !== existingProfile?.avatar_url);

    if (hasUsefulUpdates) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(profilePayload);
      if (upsertError) {
        console.error("Profile upsert error:", upsertError);
      }
    }

    const { data: finalProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    return finalProfile || existingProfile || null;
  };

  const finalizeLogin = async (authUser: any, isOAuth = false) => {
    try {
      const profileData = await ensureProfileFromAuthUser(authUser);

      const userData = {
        id: authUser.id,
        email: authUser.email ?? profileData?.email ?? null,
        ...(profileData || {}),
      };

      const resolvedEmail = userData?.email || "";

      if (isOAuth && !profileData?.phone) {
        const promptDoneKey = `oauth_phone_prompt_done_${authUser.id}`;
        const alreadyHandled = await AsyncStorage.getItem(promptDoneKey);
        if (!alreadyHandled) {
          setPendingUserData(userData);
          setPendingResolvedEmail(resolvedEmail);
          setPhonePromptValue("");
          setShowPhonePrompt(true);
          return;
        }
      }

      await completeLogin(userData, resolvedEmail);
    } catch (error: any) {
      console.error("Finalize login error:", error);
      showPopup("error", "Login Failed", "Failed to complete login");
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    try {
      setOauthLoading(provider);
      // Force fresh account selection flow and prevent stale user session reuse.
      await supabase.auth.signOut({ scope: "local" });
      const redirectTo =
        Platform.OS === "web"
          ? Linking.createURL("/login")
          : NATIVE_OAUTH_REDIRECT;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams:
            provider === "google"
              ? { prompt: "select_account", access_type: "offline" }
              : undefined,
        },
      });

      if (error || !data?.url) {
        showPopup("error", "Login Failed", error?.message || "Unable to start OAuth");
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type !== "success" || !result.url) return;

      const callbackUrl = result.url;
      const code = callbackUrl.match(/[?&]code=([^&#]+)/)?.[1];
      if (code) {
        const { data: sessionData, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
        if (exchangeError) {
          showPopup("error", "Login Failed", exchangeError.message);
          return;
        }
        if (sessionData?.user?.id) {
          await finalizeLogin(sessionData.user, true);
        }
        return;
      }

      // Some providers/native flows return tokens in URL fragment.
      const accessToken = callbackUrl.match(/[#&]access_token=([^&]+)/)?.[1];
      const refreshToken = callbackUrl.match(/[#&]refresh_token=([^&]+)/)?.[1];
      if (accessToken && refreshToken) {
        const { data: setSessionData, error: setSessionError } =
          await supabase.auth.setSession({
            access_token: decodeURIComponent(accessToken),
            refresh_token: decodeURIComponent(refreshToken),
          });
        if (setSessionError) {
          showPopup("error", "Login Failed", setSessionError.message);
          return;
        }
        if (setSessionData?.user?.id) {
          await finalizeLogin(setSessionData.user, true);
          return;
        }
      }

      const { data: sessionResult } = await supabase.auth.getSession();
      if (sessionResult.session?.user?.id) {
        await finalizeLogin(sessionResult.session.user, true);
        return;
      }

      // No code/tokens in the callback and no session — surface whatever
      // Apple/Supabase actually sent back instead of a generic message.
      const oauthErrorDescription =
        callbackUrl.match(/[?&#]error_description=([^&#]+)/)?.[1];
      const oauthError = callbackUrl.match(/[?&#]error=([^&#]+)/)?.[1];
      console.error(`OAuth callback for ${provider} had no code/tokens:`, callbackUrl);
      showPopup(
        "error",
        "Login Failed",
        oauthErrorDescription
          ? decodeURIComponent(oauthErrorDescription).replace(/\+/g, " ")
          : oauthError
          ? `OAuth error: ${decodeURIComponent(oauthError)}`
          : "OAuth completed but no app session was created. Please try again.",
      );
    } catch (error: any) {
      console.error("OAuth error:", error);
      showPopup("error", "Login Failed", error?.message || "OAuth sign-in failed");
    } finally {
      setOauthLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      showPopup("error", "Missing Fields", "Please fill in all fields");
      return;
    }

    if (!isIdentifierValid) {
      showPopup(
        "error",
        "Invalid Input",
        isIdentifierEmail
          ? "Please enter a valid email address"
          : "Please enter a valid Bhutanese phone number (17/77 + 8 digits), with or without +975",
      );
      return;
    }

    try {
      setLoading(true);

      let authEmail = identifier.trim();

      if (!isIdentifierEmail) {
        const normalizedPhone = normalizeBhutanPhone(identifier);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("phone", normalizedPhone)
          .single();

        if (profileError || !profile) {
          showPopup("error", "Phone Not Found", "Bhutan phone number not found. Please check your number or sign up.");
          return;
        }

        authEmail = profile.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (error || !data?.user?.id) {
        showPopup("error", "Login Failed", error?.message || "Unable to sign in. Please check your credentials.");
        return;
      }

      await finalizeLogin(data.user, false);
    } catch (error: any) {
      console.error("Main login error:", {
        message: error.message,
        stack: error.stack,
      });
      showPopup("error", "Login Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
      <View className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-background"
        >
          <View
            className="flex-1 justify-center"
            style={{ paddingHorizontal: screenPaddingX }}
          >
            <View
              className="flex-row justify-between items-center"
              style={{ marginBottom: headerBottomSpacing }}
            >
              <View>
                <Text
                  className="text-primary/90 font-mbold"
                  style={{ fontSize: titleSize }}
                >
                  Welcome
                </Text>
                <Text
                  className="text-secondary/90 font-mbold"
                  style={{ fontSize: titleSize }}
                >
                  Back!
                </Text>
              </View>
              <Image
                source={require("../assets/images/logo.png")}
                style={{ width: logoSize, height: logoSize }}
                resizeMode="contain"
              />
            </View>

            <View className="flex-2" style={{ rowGap: fieldGap }}>
              <View className="mb-4">
                <FormInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Email or phone"
                  keyboardType={isIdentifierEmail ? "email-address" : "default"}
                  autoCapitalize="none"
                  leftIcon={
                    isIdentifierEmail ? (
                      <MaterialIcons name="email" size={iconSize} color="#6B7280" />
                    ) : (
                      <Ionicons name="call" size={iconSize} color="#6B7280" />
                    )
                  }
                  rightAccessory={
                    identifier.length > 0 ? (
                      <Pressable onPress={handleClearIdentifier}>
                        <Ionicons
                          name="close-circle"
                          size={iconSize}
                          color="#9CA3AF"
                        />
                      </Pressable>
                    ) : undefined
                  }
                />
              </View>

              <View className="mb-2">
                <FormInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  leftIcon={
                    <Ionicons
                      name="lock-closed"
                      size={iconSize}
                      color="#6B7280"
                    />
                  }
                  rightAccessory={
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? "eye" : "eye-off"}
                        size={iconSize}
                        color="#6B7280"
                      />
                    </Pressable>
                  }
                />
              </View>
            </View>

            <Text
              className="text-right font-regular"
              style={{ fontSize: helperTextSize, marginBottom: clamp(vs(24), 18, 30) }}
            >
              <Link href="/forgot" className="text-black font-regular">
                Forgot Password?
              </Link>
            </Text>

            <TouchableOpacity
              disabled={
                !identifier.trim() ||
                password.length === 0 ||
                !isIdentifierValid ||
                loading
              }
              onPress={handleLogin}
              className={`items-center ${
                identifier.trim() &&
                password.length > 0 &&
                isIdentifierValid &&
                !loading
                  ? "bg-primary"
                  : "bg-primary/50"
              }`}
              style={{
                paddingVertical: loginButtonPaddingY,
                borderRadius: buttonRadius,
                marginVertical: loginButtonMarginY,
              }}
            >
              {loading ? (
                <CircularLoader color="#EDC06D" />
              ) : (
                <Text
                  className="text-secondary text-center font-semibold"
                  style={{ fontSize: buttonLabelSize }}
                >
                  Login
                </Text>
              )}
            </TouchableOpacity>

            <Text
              className="text-center font-regular text-gray-500"
              style={{ fontSize: helperTextSize, marginBottom: clamp(vs(8), 6, 12) }}
            >
              - or continue with -
            </Text>

            <TouchableOpacity
              disabled={!!oauthLoading}
              onPress={() => handleOAuthLogin("google")}
              className="bg-white border border-gray-200 mb-3 flex-row items-center justify-center"
              style={{
                paddingVertical: oauthButtonPaddingY,
                borderRadius: oauthRadius,
                shadowColor: "#000",
                shadowOffset: { width: 1, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1,
                elevation: 1,
              }}
            >
              {oauthLoading === "google" ? (
                <CircularLoader color="#094569" />
              ) : (
                <>
                  <GoogleIcon size={clamp(ms(18), 16, 22)} />
                  <Text
                    className="text-gray-900 text-center font-msemibold ml-2"
                    style={{ fontSize: oauthTextSize }}
                  >
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                disabled={!!oauthLoading}
                onPress={() => handleOAuthLogin("apple")}
                className="bg-black mb-4 flex-row items-center justify-center"
                style={{
                  paddingVertical: oauthButtonPaddingY,
                  borderRadius: oauthRadius,
                }}
              >
                {oauthLoading === "apple" ? (
                  <CircularLoader color="white" />
                ) : (
                  <>
                    <Ionicons
                      name="logo-apple"
                      size={clamp(ms(18), 16, 22)}
                      color="white"
                    />
                    <Text
                      className="text-white text-center font-msemibold ml-2"
                      style={{ fontSize: oauthTextSize }}
                    >
                      Continue with Apple
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <Text
              className="text-center text-gray-500 font-regular"
              style={{ fontSize: helperTextSize }}
            >
              Create an account{" "}
              <Link href="/signup" className="text-black font-medium underline">
                Sign up
              </Link>
            </Text>

            <TouchableOpacity
              onPress={() => router.replace("/(users)/(tabs)")}
              className="mt-3"
            >
              <Text
                className="text-center text-gray-400 font-mmedium underline"
                style={{ fontSize: helperTextSize }}
              >
                Browse as Guest
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <Modal
          visible={showPhonePrompt}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View
            className="flex-1 bg-black/45 justify-center"
            style={{ paddingHorizontal: modalPaddingX }}
          >
            <View
              className="bg-white rounded-2xl"
              style={{ padding: modalCardPadding }}
            >
              <Text
                className="font-mbold text-gray-900 mb-2"
                style={{ fontSize: modalTitleSize }}
              >
                Add Phone Number
              </Text>
              <Text className="text-sm text-gray-600 mb-4">
                First-time sign-in: add your Bhutan number for a better
                experience. You can skip if you do not have one or prefer not to
                share.
              </Text>

              <FormInput
                value={phonePromptValue}
                onChangeText={setPhonePromptValue}
                placeholder="Bhutan phone"
                keyboardType="phone-pad"
                leftIcon={<Ionicons name="call" size={iconSize} color="#6B7280" />}
              />

              <TouchableOpacity
                disabled={phonePromptLoading}
                onPress={async () => {
                  const normalizedPhone =
                    normalizeBhutanPhone(phonePromptValue);
                  if (!isValidBhutanesePhone(phonePromptValue)) {
                    showPopup("error", "Invalid Phone", "Please enter a valid Bhutan phone (17/77 + 8 digits), with or without +975.");
                    return;
                  }

                  if (!pendingUserData?.id) return;

                  try {
                    setPhonePromptLoading(true);
                    const { error } = await supabase
                      .from("profiles")
                      .update({
                        phone: normalizedPhone,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", pendingUserData.id);

                    if (error) {
                      showPopup("error", "Save Failed", error.message || "Failed to save phone number");
                      return;
                    }

                    const updatedUser = {
                      ...pendingUserData,
                      phone: normalizedPhone,
                    };
                    await AsyncStorage.setItem(
                      `oauth_phone_prompt_done_${pendingUserData.id}`,
                      "true",
                    );
                    setShowPhonePrompt(false);
                    setPendingUserData(null);
                    await completeLogin(updatedUser, pendingResolvedEmail);
                  } finally {
                    setPhonePromptLoading(false);
                  }
                }}
                className={`mt-4 py-3 rounded-xl items-center ${
                  phonePromptLoading ? "bg-gray-300" : "bg-primary"
                }`}
              >
                {phonePromptLoading ? (
                  <CircularLoader color="#fff" />
                ) : (
                  <Text className="text-white font-msemibold">Save Number</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row mt-3 gap-2">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
                  onPress={async () => {
                    if (pendingUserData?.id) {
                      await AsyncStorage.setItem(
                        `oauth_phone_prompt_done_${pendingUserData.id}`,
                        "true",
                      );
                    }
                    setShowPhonePrompt(false);
                    if (pendingUserData) {
                      // completeLogin manages pendingUserData itself (it may
                      // re-show a mandatory date-of-birth prompt), so don't
                      // clear it here.
                      await completeLogin(
                        pendingUserData,
                        pendingResolvedEmail,
                      );
                    }
                  }}
                >
                  <Text className="text-gray-700 font-msemibold">Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
                  onPress={async () => {
                    if (pendingUserData?.id) {
                      await AsyncStorage.setItem(
                        `oauth_phone_prompt_done_${pendingUserData.id}`,
                        "true",
                      );
                    }
                    setShowPhonePrompt(false);
                    if (pendingUserData) {
                      // completeLogin manages pendingUserData itself (it may
                      // re-show a mandatory date-of-birth prompt), so don't
                      // clear it here.
                      await completeLogin(
                        pendingUserData,
                        pendingResolvedEmail,
                      );
                    }
                  }}
                >
                  <Text className="text-gray-700 font-msemibold">
                    No Bhutan Number
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Optional date-of-birth prompt for existing users without one */}
        {pendingUserData?.id && (
          <DateOfBirthPrompt
            visible={showDobPrompt}
            userId={pendingUserData.id}
            onSaved={async (birthDate) => {
              const updatedUser = { ...pendingUserData, birth_date: birthDate };
              setShowDobPrompt(false);
              setPendingUserData(null);
              await completeLogin(updatedUser, pendingResolvedEmail);
            }}
            onSkip={async () => {
              const updatedUser = {
                ...pendingUserData,
                dob_prompt_skipped: true,
              };
              setShowDobPrompt(false);
              setPendingUserData(null);
              await completeLogin(updatedUser, pendingResolvedEmail);
            }}
          />
        )}

      {/* Popup */}
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />
      </View>
    </Pressable>
  );
}
