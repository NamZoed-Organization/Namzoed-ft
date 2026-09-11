/**
 * Settings › General › Appearance.
 *
 * Two things you can change about how the app looks: which earned badge
 * shows on your profile, and what your chats sit on.
 *
 * It used to be three. "Chat bubble style" offered four gradient bubble
 * skins gated by badge tier, with a live preview pair of each — and none of
 * it did anything. `app/(users)/chat/[id].tsx` destructured `bubbleSkin`
 * from the appearance context and never read it; the gradient rendering it
 * was written for had been taken out of the message list at some point and
 * the setting was left behind. So the screen let people pick between four
 * options, saved the choice, and produced no visible difference anywhere —
 * which is worse than not offering it, because the honest conclusion a user
 * draws is that the app ignored them. The whole section is gone, along with
 * `bubbleSkin` in `contexts/AppearanceContext.tsx` and the dead read in the
 * chat screen. If gradient bubbles come back, they come back with the
 * rendering first and the setting second.
 *
 * The rest is § Chrome / § Groups and rows rather than the bespoke layout
 * it had: `SettingsScreen`'s grey and centred title in place of a
 * hand-rolled `ArrowLeft` header with a `Sparkles` in the corner, white
 * rounded groups instead of individually bordered cards, and one selection
 * mark — the `Check` in `#0369A1` that every other list under Settings uses
 * — instead of per-tier accent borders, tinted card backgrounds and a
 * coloured "ACTIVE" pill. § Icons rules out colour as a marker, and a badge
 * list is exactly where that rule earns its keep: the tier colour belongs
 * to the badge, so repeating it on the row's border, background and status
 * pill says the same thing four times and still leaves you hunting for
 * which one is on.
 */

import EarlyAccessBadge from '@/components/EarlyAccessBadge';
import ChatBackgroundPicker from '@/components/settings/ChatBackgroundPicker';
import {
  SettingsGroup,
  SettingsScreen,
} from '@/components/settings/SettingsChrome';
import CircularLoader from '@/components/ui/CircularLoader';
import { useAppearance } from '@/contexts/AppearanceContext';
import {
  EarlyAccessBadgeType,
  UserBadge,
  getActiveBadge,
  getUserBadges,
  setActiveBadge,
} from '@/lib/earlyAccessService';
import { Check } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** What each earned badge is called, and what it was for. No colours here:
 *  the badge mark carries the tier, the row does not repeat it. */
const BADGE_META: Record<string, { title: string; subtitle: string }> = {
  founding: { title: 'Founding member', subtitle: 'The epitome, the privilege' },
  waitlist: { title: 'Pioneer', subtitle: 'Waitlisted before launch' },
  tester: { title: 'Beta tester', subtitle: 'Early community sign-up' },
  genesis: { title: 'Genesis', subtitle: 'Waitlisted and early sign-up' },
};

interface Props {
  onClose: () => void;
  userId?: string;
}

/** A badge as a row in the group. Not `SettingsRow`, only because the
 *  leading element is the badge mark itself rather than a lucide icon —
 *  every metric below is that component's (§ Groups and rows). */
function BadgeRow({
  badgeId,
  active,
  busy,
  first,
  onPress,
}: {
  badgeId: string;
  active: boolean;
  busy: boolean;
  first: boolean;
  onPress: () => void;
}) {
  const meta = BADGE_META[badgeId] ?? BADGE_META.tester;
  return (
    <>
      {first ? null : (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: '#f0f0f0',
            marginLeft: 60,
          }}
        />
      )}
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={busy}>
        <View className="flex-row items-center px-4 py-4">
          <View style={{ width: 44 }}>
            <EarlyAccessBadge
              badgeType={badgeId as NonNullable<EarlyAccessBadgeType>}
              size="sm"
            />
          </View>
          <View className="flex-1 ml-1">
            <Text className="text-[15.5px] font-semibold" style={{ color: '#111' }}>
              {meta.title}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">{meta.subtitle}</Text>
          </View>
          {busy ? (
            <CircularLoader size="small" color="#0369A1" />
          ) : active ? (
            <Check size={20} color="#0369A1" strokeWidth={2.4} />
          ) : null}
        </View>
      </TouchableOpacity>
    </>
  );
}

/**
 * The screen itself, with no idea where badges come from — so
 * `components/dev/AppearancePreview.tsx` can drive the real thing on
 * fixtures. Which badges you own is not something you can give yourself to
 * look at: they are awarded by a backfill, and "none", "one" and "all four"
 * are three different screens.
 */
export function AppearanceView({
  badgeIds,
  activeBadge,
  savingId,
  loading,
  globalChatBg,
  onSelectBadge,
  onSelectBg,
  onClose,
}: {
  badgeIds: string[];
  activeBadge: EarlyAccessBadgeType;
  savingId: string | null;
  loading: boolean;
  globalChatBg: string;
  onSelectBadge: (badgeId: string) => void;
  onSelectBg: (bgId: string) => void;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <SettingsScreen title="Appearance" onClose={onClose}>
        <View className="items-center justify-center" style={{ paddingTop: 64 }}>
          <CircularLoader color="#0369A1" />
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="Appearance" onClose={onClose}>
      <SettingsGroup label="Profile badge">
        {badgeIds.length === 0 ? (
          <View className="px-4 py-4">
            <Text className="text-[15.5px] font-semibold" style={{ color: '#111' }}>
              No badge yet
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              Early-access badges are awarded to founding community members.
            </Text>
          </View>
        ) : (
          badgeIds.map((badgeId, i) => (
            <BadgeRow
              key={badgeId}
              badgeId={badgeId}
              active={activeBadge === badgeId}
              busy={savingId === badgeId}
              first={i === 0}
              onPress={() => onSelectBadge(badgeId)}
            />
          ))
        )}
      </SettingsGroup>

      {badgeIds.length > 1 && (
        <Text className="text-xs text-gray-400 px-3 leading-5 -mt-2 mb-3.5">
          The one you pick is the one shown on your profile.
        </Text>
      )}

      <SettingsGroup label="Chat background">
        {/* The picker pays its own horizontal padding, so the group gives it
            none — it scrolls edge to edge inside the card the way a row of
            covers should, rather than stopping short of the corners. */}
        <View style={{ paddingVertical: 2 }}>
          <ChatBackgroundPicker
            selectedBgId={globalChatBg}
            onSelectBg={onSelectBg}
          />
        </View>
      </SettingsGroup>

      <Text className="text-xs text-gray-400 px-3 leading-5">
        This is the default for every chat. A single conversation can be given
        its own background from the chat screen, which overrides this one.
      </Text>
    </SettingsScreen>
  );
}

/** The real screen: fetches the badges, then hands them to the view. */
export default function AppearanceManager({ onClose, userId }: Props) {
  const { globalChatBg, setGlobalChatBg } = useAppearance();
  const [badgeIds, setBadgeIds] = useState<string[]>([]);
  const [activeBadge, setActiveBadgeState] = useState<EarlyAccessBadgeType>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    Promise.all([getUserBadges(userId), getActiveBadge(userId)])
      .then(([badges, active]) => {
        setBadgeIds(badges.map((b: UserBadge) => b.badge_id));
        setActiveBadgeState(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const handleSelectBadge = useCallback(
    async (badgeId: string) => {
      if (!userId || savingId) return;
      setSavingId(badgeId);
      const ok = await setActiveBadge(userId, badgeId);
      if (ok) setActiveBadgeState(badgeId as NonNullable<EarlyAccessBadgeType>);
      setSavingId(null);
    },
    [userId, savingId],
  );

  return (
    <AppearanceView
      badgeIds={badgeIds}
      activeBadge={activeBadge}
      savingId={savingId}
      loading={loading}
      globalChatBg={globalChatBg}
      onSelectBadge={handleSelectBadge}
      onSelectBg={setGlobalChatBg}
      onClose={onClose}
    />
  );
}
