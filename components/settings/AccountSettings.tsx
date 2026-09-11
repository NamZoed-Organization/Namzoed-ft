import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import React, { useEffect, useState } from "react";
import { Text } from "react-native";

interface AccountSettingsProps {
  onClose?: () => void;
  onNavigate?: (modal: string) => void;
}

/** What Supabase reports as linked on the auth user, keyed by provider. */
type Identities = Record<string, string | undefined>;

export default function AccountSettings({ onClose, onNavigate }: AccountSettingsProps) {
  const { currentUser } = useUser();
  const [identities, setIdentities] = useState<Identities>({});

  // The linked sign-in methods live on the auth user, not the profile row —
  // `identities` is one entry per provider the account can sign in with.
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const map: Identities = {};
        for (const identity of data.user?.identities ?? []) {
          const identityData = identity.identity_data as Record<string, any> | undefined;
          map[identity.provider] =
            identityData?.email ?? identityData?.phone ?? identityData?.name ?? "Linked";
        }
        setIdentities(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const phone = currentUser?.phone ? `+975 ${currentUser.phone}` : null;

  return (
    <SettingsScreen title="Account" onClose={onClose}>
      <SettingsGroup label="Sign-in methods">
        <SettingsRow
          first
          label="Mobile"
          value={phone ?? identities.phone ?? "Not linked"}
        />
        <SettingsRow
          label="Email"
          value={currentUser?.email ?? identities.email ?? "Not linked"}
        />
        <SettingsRow
          label="Apple"
          value={identities.apple ?? "Not linked"}
        />
        <SettingsRow
          label="Google"
          value={identities.google ?? "Not linked"}
        />
      </SettingsGroup>

      <SettingsGroup label="Security">
        <SettingsRow
          first
          label="Change password"
          onPress={() => onNavigate?.("changePassword")}
        />
        <SettingsRow
          label="Device management"
          description="The device you're signed in on"
          onPress={() => onNavigate?.("deviceManagement")}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          first
          label="Delete account"
          destructive
          onPress={() => onNavigate?.("deleteAccount")}
        />
      </SettingsGroup>

      <Text className="text-xs text-gray-400 px-3 leading-5">
        Sign-in methods are read from your account and can&apos;t be unlinked here
        yet — contact support if you need one removed.
      </Text>
    </SettingsScreen>
  );
}
