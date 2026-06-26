
import EarlyAccessBadge from '@/components/EarlyAccessBadge';
import { useAppearance } from '@/contexts/AppearanceContext';
import {
    EarlyAccessBadgeType,
    UserBadge,
    getActiveBadge,
    getUserBadges,
    setActiveBadge,
} from '@/lib/earlyAccessService';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import ChatBackgroundPicker from './ChatBackgroundPicker';

// -- Badge display metadata ---------------------------------------------------

const BADGE_META: Record<string, { title: string; subtitle: string; accentColor: string; bgColor: string }> = {
  founding: { title: 'FOUNDING MEMBER', subtitle: 'The epitome, the privilege', accentColor: '#c9a96e', bgColor: '#fdf8ec' },
  waitlist: { title: 'PIONEER',         subtitle: 'Waitlisted before launch',                   accentColor: '#d97706', bgColor: '#fffbeb' },
  tester:   { title: 'BETA TESTER',     subtitle: 'Early community sign-up',                    accentColor: '#94a3b8', bgColor: '#f8fafc' },
  genesis:  { title: 'GENESIS',         subtitle: 'Waitlisted and early sign up', accentColor: '#22c55e', bgColor: '#f0fdf4' },
};

// -- Bubble style catalog -----------------------------------------------------

const BUBBLE_ORDER: NonNullable<EarlyAccessBadgeType>[] = ['founding', 'waitlist', 'tester', 'genesis'];

const BUBBLE_META: Record<NonNullable<EarlyAccessBadgeType>, { name: string; desc: string; accentColor: string; bgColor: string; lockLabel: string }> = {
  founding: { name: 'FOUNDING', desc: 'Gold gradient — Founding Member edition',   accentColor: '#c9a96e', bgColor: '#fdf8ec', lockLabel: 'Founding only' },
  waitlist: { name: 'PIONEER',  desc: 'Amber gradient — Pioneer edition',          accentColor: '#d97706', bgColor: '#fffbeb', lockLabel: 'Pioneer only' },
  tester:   { name: 'BETA',     desc: 'Silver gradient — Beta Tester edition',     accentColor: '#94a3b8', bgColor: '#f8fafc', lockLabel: 'Beta Tester only' },
  genesis:  { name: 'GENESIS',  desc: 'Emerald gradient — Genesis edition',        accentColor: '#22c55e', bgColor: '#f0fdf4', lockLabel: 'Genesis only' },
};

const BUBBLE_BORDER: Record<NonNullable<EarlyAccessBadgeType>, readonly [string, string, string, string]> = {
  founding: ['#c9a96e', '#f0d79a', '#e8c07a', '#c9a96e'],
  waitlist: ['#a16207', '#d97706', '#f5d264', '#d97706'],
  tester:   ['#475569', '#94a3b8', '#e2e8f0', '#94a3b8'],
  genesis:  ['#166534', '#22c55e', '#4ade80', '#22c55e'],
};
const BUBBLE_BG: Record<NonNullable<EarlyAccessBadgeType>, readonly [string, string, string]> = {
  founding: ['#0c0508', '#160b1e', '#0c0508'],
  waitlist: ['#100a00', '#1d1300', '#100a00'],
  tester:   ['#07101e', '#0f172a', '#07101e'],
  genesis:  ['#031a0c', '#052e16', '#031a0c'],
};
const RECV_BORDER = ['#5a4535', '#7a6048', '#968060', '#7a6048'] as const;
const RECV_BG     = ['#171c24', '#10141c', '#090d14'] as const;

// -- Bubble preview pair ------------------------------------------------------

function BubblePair({ tier }: { tier: NonNullable<EarlyAccessBadgeType> }) {
  const r = 14;
  return (
    <View style={{ backgroundColor: '#f8f8f8', borderRadius: 10, padding: 10 }}>
      <LinearGradient
        colors={BUBBLE_BORDER[tier]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={{ alignSelf: 'flex-end', marginBottom: 4, borderRadius: r, padding: 1.5 }}
      >
        <LinearGradient
          colors={BUBBLE_BG[tier]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: r - 1, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Hey! 👋</Text>
        </LinearGradient>
      </LinearGradient>
      <LinearGradient
        colors={RECV_BORDER} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={{ alignSelf: 'flex-start', borderRadius: r, padding: 1.5 }}
      >
        <LinearGradient
          colors={RECV_BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: r - 1, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{"How's it?"}</Text>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginBottom: 12, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: '#9ca3af' }}>{title}</Text>
      <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{subtitle}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  userId?: string;
}

export default function AppearanceManager({ onClose, userId }: Props) {
  const { bubbleSkin, setBubbleSkin, globalChatBg, setGlobalChatBg } = useAppearance();
  const [userBadges, setUserBadges]        = useState<UserBadge[]>([]);
  const [activeBadge, setActiveBadgeState] = useState<EarlyAccessBadgeType>(null);
  const [loading, setLoading]              = useState(true);
  const [saving, setSaving]                = useState(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([getUserBadges(userId), getActiveBadge(userId)])
      .then(([badges, active]) => {
        setUserBadges(badges);
        setActiveBadgeState(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const handleSetActiveBadge = useCallback(async (badgeId: string) => {
    if (!userId || saving) return;
    setSaving(true);
    const ok = await setActiveBadge(userId, badgeId);
    if (ok) {
      setActiveBadgeState(badgeId as NonNullable<EarlyAccessBadgeType>);
    }
    setSaving(false);
  }, [userId, saving]);

  const ownedIds = new Set(userBadges.map(b => b.badge_id));

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
      }}>
        <TouchableOpacity onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
          <ArrowLeft size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', letterSpacing: 0.4 }}>
            Appearance
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Badge & chat-bubble style</Text>
        </View>
        <Sparkles size={18} color="#c9a96e" />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#c9a96e" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile Badge ─────────────────────────────── */}
          <SectionHeader
            title="PROFILE BADGE"
            subtitle={
              userBadges.length === 0
                ? "You don't have an early-access badge yet"
                : `${userBadges.length} badge${userBadges.length > 1 ? 's' : ''} earned — tap to set which one displays on your profile`
            }
          />

          {userBadges.length === 0 ? (
            <View style={{
              padding: 16, borderRadius: 12, borderWidth: 1,
              borderColor: '#f0ead8', backgroundColor: '#fafaf7', marginBottom: 10,
            }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                Early-access badges are awarded to founding community members.
              </Text>
            </View>
          ) : (
            userBadges.map((badge) => {
              const meta      = BADGE_META[badge.badge_id as NonNullable<EarlyAccessBadgeType>]
                                ?? BADGE_META['tester'];
              const isActive  = activeBadge === badge.badge_id;

              return (
                <TouchableOpacity
                  key={badge.badge_id}
                  activeOpacity={0.75}
                  onPress={() => handleSetActiveBadge(badge.badge_id)}
                  style={{
                    marginBottom: 12, borderRadius: 14,
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? meta.accentColor : '#e5e7eb',
                    backgroundColor: isActive ? meta.bgColor : '#fff',
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <EarlyAccessBadge
                      badgeType={badge.badge_id as NonNullable<EarlyAccessBadgeType>}
                      size="sm"
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: '#111' }}>
                        {meta.title}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                        {meta.subtitle}
                      </Text>
                    </View>
                    {saving && isActive ? (
                      <ActivityIndicator size="small" color={meta.accentColor} />
                    ) : isActive ? (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 8, paddingVertical: 4,
                        backgroundColor: meta.accentColor, borderRadius: 6,
                      }}>
                        <Check size={11} color="#fff" />
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.8 }}>
                          ACTIVE
                        </Text>
                      </View>
                    ) : (
                      <View style={{
                        width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
                        borderColor: '#d1d5db',
                      }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Chat Bubble Style ─────────────────────────── */}
          <View style={{ marginTop: 12 }}>
            <SectionHeader
              title="CHAT BUBBLE STYLE"
              subtitle="How your messages appear in conversations"
            />

            {BUBBLE_ORDER.map((tier) => {
              const meta       = BUBBLE_META[tier];
              const isOwned    = ownedIds.has(tier);
              const isSelected = isOwned && bubbleSkin === tier;

              return (
                <TouchableOpacity
                  key={tier}
                  activeOpacity={isOwned ? 0.75 : 1}
                  onPress={() => { if (isOwned) setBubbleSkin(tier); }}
                  style={{
                    marginBottom: 10, borderRadius: 14,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? meta.accentColor : '#e5e7eb',
                    backgroundColor: isSelected ? meta.bgColor : isOwned ? '#fff' : '#fafafa',
                    padding: 14,
                    opacity: isOwned ? 1 : 0.55,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#111' }}>
                          {meta.name}
                        </Text>
                        {isSelected && (
                          <View style={{
                            marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2,
                            backgroundColor: meta.accentColor, borderRadius: 4,
                          }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.8 }}>
                              ACTIVE
                            </Text>
                          </View>
                        )}
                        {!isOwned && (
                          <View style={{
                            marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2,
                            backgroundColor: '#f3f4f6', borderRadius: 4,
                          }}>
                            <Text style={{ fontSize: 9, color: '#9ca3af', fontWeight: '600' }}>
                              {meta.lockLabel}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>{meta.desc}</Text>
                      <View style={{ backgroundColor: '#f8f8f8', borderRadius: 10, padding: 10 }}>
                        <BubblePair tier={tier} />
                      </View>
                    </View>
                    {isOwned ? (
                      <View style={{
                        width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
                        borderColor: isSelected ? meta.accentColor : '#d1d5db',
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? meta.accentColor : 'transparent',
                        alignSelf: 'flex-start', marginTop: 2,
                      }}>
                        {isSelected && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                        )}
                      </View>
                    ) : (
                      <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14 }}>🔒</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Global Chat Background */}
          <Text style={{
            fontSize: 12, fontWeight: '700', color: '#9ca3af',
            textTransform: 'uppercase', marginBottom: 8, marginTop: 16
          }}>
            Global Chat Background
          </Text>
          <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Set a default background for all your chats. (You can also set custom backgrounds for individual chats on the chat screen.)
          </Text>
          <View style={{ marginHorizontal: -16 }}>
            <ChatBackgroundPicker 
              selectedBgId={globalChatBg}
              onSelectBg={setGlobalChatBg}
            />
          </View>

          {/* Footer note */}
          <View style={{
            marginTop: 16, padding: 14, borderRadius: 12,
            backgroundColor: '#fafaf7', borderWidth: 1, borderColor: '#f0ead8',
          }}>
            <Text style={{ fontSize: 11, color: '#9ca3af', lineHeight: 17 }}>
              Badge and bubble styles are exclusive to early-access members and reflect the tier you earned.
              Your active badge displays on your profile and your bubble style applies to all conversations.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
