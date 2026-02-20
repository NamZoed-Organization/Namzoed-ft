
import type { EarlyAccessBadgeType } from '@/lib/earlyAccessService';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

// ── Tier definitions ──────────────────────────────────────────────────────────

type TierKey = NonNullable<EarlyAccessBadgeType>;

interface TierConfig {
  borderColors:   readonly [string, string, string, string];
  bgColors:       readonly [string, string, string];
  primaryText:    string;
  subText:        string;
  textColor:      string;
  accentColor:    string;
  shimmerColor:   string;
  rainbowShimmer: boolean;
  /** Neon skin — electric glow border + text colour */
  neonColor:      string;
  /** Minimal skin — muted accent for border and sub-text */
  minimalAccent:  string;
  decoration:     'diamond' | 'lines' | 'dots';
}

const TIER_CONFIG: Record<TierKey, TierConfig> = {
  founding: {
    borderColors:   ['#c9a96e', '#f0d79a', '#e8c07a', '#c9a96e'],
    bgColors:       ['#0c0508', '#160b1e', '#0c0508'],
    primaryText:    'FOUNDING MEMBER',
    subText:        'MMXXVI · NAMZOED',
    textColor:      '#f0e0bc',
    accentColor:    '#c9a96e',
    shimmerColor:   'rgba(249,220,140,0.38)',
    rainbowShimmer: true,
    neonColor:      '#ff6eb4',
    minimalAccent:  '#9b6a40',
    decoration:     'diamond',
  },
  waitlist: {
    borderColors:   ['#a16207', '#d97706', '#f5d264', '#d97706'],
    bgColors:       ['#100a00', '#1d1300', '#100a00'],
    primaryText:    'PIONEER',
    subText:        'EARLY ACCESS · No.001',
    textColor:      '#fde27a',
    accentColor:    '#d97706',
    shimmerColor:   'rgba(251,191,36,0.32)',
    rainbowShimmer: false,
    neonColor:      '#ffd235',
    minimalAccent:  '#8a6500',
    decoration:     'lines',
  },
  tester: {
    borderColors:   ['#475569', '#94a3b8', '#e2e8f0', '#94a3b8'],
    bgColors:       ['#07101e', '#0f172a', '#07101e'],
    primaryText:    'BETA TESTER',
    subText:        'EST. MMXXVI · EARLY',
    textColor:      '#e2e8f0',
    accentColor:    '#94a3b8',
    shimmerColor:   'rgba(203,213,225,0.28)',
    rainbowShimmer: false,
    neonColor:      '#3de4ff',
    minimalAccent:  '#3a5278',
    decoration:     'dots',
  },
  genesis: {
    borderColors:   ['#166534', '#22c55e', '#4ade80', '#22c55e'],
    bgColors:       ['#031a0c', '#052e16', '#031a0c'],
    primaryText:    'GENESIS',
    subText:        'ORIGIN · MMXXVI',
    textColor:      '#bbf7d0',
    accentColor:    '#22c55e',
    shimmerColor:   'rgba(74,222,128,0.28)',
    rainbowShimmer: false,
    neonColor:      '#39ff8a',
    minimalAccent:  '#166534',
    decoration:     'lines',
  },
};

// ── Size presets ──────────────────────────────────────────────────────────────

interface SizeConfig {
  borderRadius: number;
  borderWidth: number;
  paddingH: number;
  paddingV: number;
  primarySize: number;
  subSize: number;
  letterSpacing: number;
  decorSize: number;
  ruleWidth: number;
  ruleMargin: number;
  shimmerWidth: number;
  gap: number;
}

const SIZE_CONFIG: Record<'sm' | 'md' | 'lg', SizeConfig> = {
  sm: {
    borderRadius: 3,  borderWidth: 0.8, paddingH: 8,  paddingV: 4,
    primarySize: 7,   subSize: 5.5,    letterSpacing: 1.4, decorSize: 5,
    ruleWidth: 1,     ruleMargin: 2,   shimmerWidth: 32,   gap: 5,
  },
  md: {
    borderRadius: 4,  borderWidth: 1,   paddingH: 11, paddingV: 5,
    primarySize: 9,   subSize: 6.5,    letterSpacing: 1.8, decorSize: 6.5,
    ruleWidth: 1.5,   ruleMargin: 3,   shimmerWidth: 44,   gap: 7,
  },
  lg: {
    borderRadius: 5,  borderWidth: 1.2, paddingH: 14, paddingV: 7,
    primarySize: 11,  subSize: 8,      letterSpacing: 2.2, decorSize: 8,
    ruleWidth: 2,     ruleMargin: 4,   shimmerWidth: 56,   gap: 9,
  },
};

// ── SVG Decoration marks ──────────────────────────────────────────────────────

/** Filled diamond ◆ flanking the primary label (Founding Member) */
function DiamondMark({ color, size }: { color: string; size: number }) {
  const h = size;
  const w = size * 0.72;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polygon
        points={`${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`}
        fill={color}
        opacity={0.92}
      />
    </Svg>
  );
}

/** Two horizontal ruled lines (Pioneer / waitlist) */
function LineMark({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Line x1="0" y1={size * 0.3} x2={size} y2={size * 0.3}
        stroke={color} strokeWidth="1.2" opacity={0.9} />
      <Line x1={size * 0.2} y1={size * 0.7} x2={size * 0.8} y2={size * 0.7}
        stroke={color} strokeWidth="0.7" opacity={0.6} />
    </Svg>
  );
}

/** Two small filled circles · · (Beta Tester) */
function DotMark({ color, size }: { color: string; size: number }) {
  const r = size * 0.18;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size * 0.28} cy={size / 2} r={r} fill={color} opacity={0.85} />
      <Circle cx={size * 0.72} cy={size / 2} r={r} fill={color} opacity={0.85} />
    </Svg>
  );
}

// ── Shared text block ─────────────────────────────────────────────────────────

function TextBlock({ tier, s, primary, accent }: {
  tier: TierConfig;
  s: (typeof SIZE_CONFIG)['md'];
  primary: string;
  accent: string;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: primary, fontSize: s.primarySize, fontWeight: '700', letterSpacing: s.letterSpacing, includeFontPadding: false }} numberOfLines={1}>
        {tier.primaryText}
      </Text>
      <View style={{ height: 0.5, backgroundColor: accent, alignSelf: 'stretch', marginVertical: s.ruleMargin, opacity: 0.55 }} />
      <Text style={{ color: accent, fontSize: s.subSize, letterSpacing: s.letterSpacing * 0.85, includeFontPadding: false }} numberOfLines={1}>
        {tier.subText}
      </Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface EarlyAccessBadgeProps {
  badgeType: EarlyAccessBadgeType;
  size?: 'sm' | 'md' | 'lg';
}

export default function EarlyAccessBadge({
  badgeType,
  size = 'md',
}: EarlyAccessBadgeProps) {
  if (!badgeType) return null;

  const tier = TIER_CONFIG[badgeType];
  const s    = SIZE_CONFIG[size];
  const Mark = tier.decoration === 'diamond' ? DiamondMark
             : tier.decoration === 'lines'   ? LineMark
             :                                 DotMark;

  return <LuxuryBadge tier={tier} s={s} Mark={Mark} />;
}

// ── Luxury skin extracted to keep Reanimated hook rules valid ────────────────

function LuxuryBadge({ tier, s, Mark }: {
  tier: TierConfig;
  s: (typeof SIZE_CONFIG)['md'];
  Mark: typeof DiamondMark;
}) {
  const offset = useSharedValue(-80);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(240, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      -1, false,
    );
    return () => cancelAnimation(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { skewX: '-18deg' }],
  }));

  return (
    <LinearGradient
      colors={tier.borderColors}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      style={{ borderRadius: s.borderRadius, padding: s.borderWidth }}
    >
      <LinearGradient
        colors={tier.bgColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
        style={{
          borderRadius: s.borderRadius - 0.5,
          paddingHorizontal: s.paddingH,
          paddingVertical: s.paddingV,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {tier.rainbowShimmer ? (
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: s.shimmerWidth * 1.4 }, shimmerStyle]}>
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255,120,160,0.07)',
                'rgba(255,200,100,0.13)',
                'rgba(255,255,200,0.22)',
                'rgba(200,255,220,0.22)',
                'rgba(180,220,255,0.13)',
                'rgba(220,180,255,0.07)',
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        ) : (
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: s.shimmerWidth, backgroundColor: tier.shimmerColor }, shimmerStyle]} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.gap }}>
          <Mark color={tier.accentColor} size={s.decorSize} />
          <TextBlock tier={tier} s={s} primary={tier.textColor} accent={tier.accentColor} />
          <Mark color={tier.accentColor} size={s.decorSize} />
        </View>
      </LinearGradient>
    </LinearGradient>
  );
}
