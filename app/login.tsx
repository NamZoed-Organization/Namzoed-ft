import {
  AuthButton,
  AuthDivider,
  AuthField,
  AuthFooterLink,
  AuthHeading,
  AuthScreen,
  AuthSecondaryButton,
} from "@/components/auth/AuthChrome";
import { Eye, EyeOff, Lock, Mail, Phone, X } from "lucide-react-native";
import DialogCard from "@/components/ui/DialogCard";
import DateOfBirthPrompt from "@/components/modals/DateOfBirthPrompt";
import { waitForIosModalDismiss } from "@/utils/modal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { generatedAvatarFor, isPlaceholderAvatar } from "@/lib/dicebear";
import { isMongooseUser } from "@/utils/roleCheck";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useAppRouter } from "@/utils/navigation";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
    Platform,
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
  // The auth chrome and the dialog carry their own spacing and type now
  // (§ Auth screens, § Dialogs), so the eighteen scaled constants this
  // screen used to size itself with are all gone.

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
      // The OAuth phone prompt is a native modal, and this one is presented
      // the moment that closes — on iOS a modal presented into another's
      // dismissal simply never appears, which left Google users with no way
      // to give a date of birth at all.
      await waitForIosModalDismiss();
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

    // Google hands over its own monogram for an account with no photo, and
    // that is the placeholder this app is replacing, not a picture worth
    // importing (§ Generated avatars). So a provider picture is taken only
    // when it is a real one, and anything else — including a placeholder an
    // older build already imported — is replaced with a generated avatar
    // seeded on the account id. A photo we cannot prove is a placeholder is
    // left alone: the picker is two taps away, and guessing the other way
    // would delete somebody's actual face.
    const usableProviderAvatar =
      providerAvatar && !isPlaceholderAvatar(providerAvatar)
        ? providerAvatar
        : null;
    const existingAvatarIsReal =
      !!existingProfile?.avatar_url &&
      !isPlaceholderAvatar(existingProfile.avatar_url);

    if (!existingAvatarIsReal) {
      if (usableProviderAvatar) {
        profilePayload.avatar_url = usableProviderAvatar;
        profilePayload.avatar_style = null;
        profilePayload.avatar_animation = "none";
      } else if (!existingProfile?.avatar_style) {
        Object.assign(profilePayload, generatedAvatarFor(authUser.id));
      }
    }

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
        profilePayload.avatar_url !== existingProfile?.avatar_url) ||
      profilePayload.avatar_style !== undefined;

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

  /** Saving the number the OAuth account did not carry. */
  const savePhonePrompt = async () => {
    const normalizedPhone = normalizeBhutanPhone(phonePromptValue);
    if (!isValidBhutanesePhone(phonePromptValue)) {
      showPopup(
        "error",
        "Check that number",
        "A Bhutan number is 17 or 77 followed by six digits, with or without +975.",
      );
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
        showPopup("error", "Couldn't save", error.message || "That number didn't save.");
        return;
      }

      const updatedUser = { ...pendingUserData, phone: normalizedPhone };
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
  };

  /** Going on without one. Remembered, so it is asked once and not again. */
  const skipPhonePrompt = async () => {
    if (phonePromptLoading) return;
    if (pendingUserData?.id) {
      await AsyncStorage.setItem(
        `oauth_phone_prompt_done_${pendingUserData.id}`,
        "true",
      );
    }
    setShowPhonePrompt(false);
    if (pendingUserData) {
      // completeLogin manages pendingUserData itself (it may re-show a
      // mandatory date-of-birth prompt), so don't clear it here.
      await completeLogin(pendingUserData, pendingResolvedEmail);
    }
  };

  return (
    <>
      <AuthScreen
        footer={
          <>
            <AuthFooterLink
              prompt="No account yet?"
              action="Sign up"
              onPress={() => router.push("/signup")}
            />
            {/* Quieter than the sign-up line, because it is the way past
                the screen rather than through it. */}
            <TouchableOpacity
              onPress={() => router.replace("/(users)/(tabs)")}
              activeOpacity={0.7}
              style={{ paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>
                Browse as a guest
              </Text>
            </TouchableOpacity>
          </>
        }
      >
        <AuthHeading
          title="Welcome back"
          subtitle="Sign in to pick up where you left off."
        />

        <View style={{ gap: 12 }}>
          <AuthField
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email or phone"
            keyboardType={isIdentifierEmail ? "email-address" : "default"}
            autoCapitalize="none"
            autoCorrect={false}
            icon={
              isIdentifierEmail ? (
                <Mail size={19} color="#9CA3AF" strokeWidth={1.8} />
              ) : (
                <Phone size={19} color="#9CA3AF" strokeWidth={1.8} />
              )
            }
            accessory={
              identifier.length > 0 ? (
                <TouchableOpacity onPress={handleClearIdentifier} hitSlop={8}>
                  <X size={18} color="#9CA3AF" strokeWidth={2} />
                </TouchableOpacity>
              ) : undefined
            }
          />

          <AuthField
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            icon={<Lock size={19} color="#9CA3AF" strokeWidth={1.8} />}
            accessory={
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff size={19} color="#9CA3AF" strokeWidth={1.8} />
                ) : (
                  <Eye size={19} color="#9CA3AF" strokeWidth={1.8} />
                )}
              </TouchableOpacity>
            }
          />
        </View>

        <TouchableOpacity
          onPress={() => router.push("/forgot")}
          activeOpacity={0.7}
          style={{ alignSelf: "flex-end", paddingVertical: 12 }}
        >
          <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#0369A1" }}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        <AuthButton
          label="Sign in"
          onPress={handleLogin}
          loading={loading}
          disabled={
            !identifier.trim() || password.length === 0 || !isIdentifierValid
          }
        />

        <AuthDivider />

        <View style={{ gap: 10 }}>
          <AuthSecondaryButton
            label="Continue with Google"
            icon={<GoogleIcon size={18} />}
            onPress={() => handleOAuthLogin("google")}
            disabled={!!oauthLoading}
            loading={oauthLoading === "google"}
          />
          {Platform.OS === "ios" && (
            <AuthSecondaryButton
              dark
              label="Continue with Apple"
              icon={<Ionicons name="logo-apple" size={18} color="#fff" />}
              onPress={() => handleOAuthLogin("apple")}
              disabled={!!oauthLoading}
              loading={oauthLoading === "apple"}
            />
          )}
        </View>
      </AuthScreen>

        {/* Two ways of saying the same "no" — Decline and "No Bhutan
            Number" — were two grey buttons doing one job, next to a third
            that was the actual answer. One skip, one save. */}
        <DialogCard
          visible={showPhonePrompt}
          title="Add your phone number"
          message="A Bhutan number makes you easier to reach about orders and deliveries. You can add it later in Settings."
          icon={<Phone size={22} color="#094569" strokeWidth={1.9} />}
          actions={[
            {
              label: "Not now",
              style: "cancel",
              onPress: skipPhonePrompt,
            },
            {
              label: "Save",
              loading: phonePromptLoading,
              onPress: phonePromptLoading ? undefined : savePhonePrompt,
            },
          ]}
        >
          <View style={{ marginTop: 16 }}>
            <AuthField
              value={phonePromptValue}
              onChangeText={setPhonePromptValue}
              placeholder="17123456"
              keyboardType="phone-pad"
              maxLength={8}
              icon={<Phone size={19} color="#9CA3AF" strokeWidth={1.8} />}
              style={{ backgroundColor: "#F5F5F5" }}
            />
          </View>
        </DialogCard>

        {/* Optional date-of-birth prompt for existing users without one */}
        {pendingUserData?.id && (
          <DateOfBirthPrompt
            visible={showDobPrompt}
            userId={pendingUserData.id}
            onSaved={async (birthDate) => {
              // The prompt writes age_verified alongside the date, so keep
              // the cached user object in step with the row.
              const updatedUser = {
                ...pendingUserData,
                birth_date: birthDate,
                age_verified: true,
              };
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
              // Persisted, not just carried on this session's user object —
              // otherwise the next login refetches the profile, finds no
              // flag, and asks again.
              supabase
                .from("profiles")
                .update({ dob_prompt_skipped: true })
                .eq("id", updatedUser.id)
                .then(({ error }) => {
                  if (error) {
                    console.error("Failed to record DOB prompt skip:", error);
                  }
                });
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
    </>
  );
}
