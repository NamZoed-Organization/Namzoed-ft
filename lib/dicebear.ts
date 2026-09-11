/**
 * Generated avatars.
 *
 * A profile with no photo used to fall back to the person's initials on a
 * grey circle — a wall of grey letters in every list, and two people called
 * Karma looking identical (§ The conversation list makes the same point
 * about the initial-on-navy tiles that preceded them). Accounts made through
 * the app's own sign-up have no photo at all, and a Google sign-in without a
 * photo hands over Google's own monogram, which is the same problem wearing
 * someone else's brand.
 *
 * So an account without a real photo gets a **generated** one instead:
 * DiceBear's HTTP API, seeded with the profile's own id, so it is stable
 * forever, identical on every device, and never has to be uploaded anywhere.
 *
 * **What is stored where.** `profiles.avatar_url` holds the PNG endpoint,
 * because it is read by ~77 files through everything from `expo-image` to
 * React Native's own `<Image>`, and RN's cannot draw an SVG. `avatar_style`
 * and `avatar_animation` hold the recipe beside it, so the surfaces that
 * *can* render SVG — the profile header, the picker — rebuild the animated
 * version from the same seed rather than needing a second URL column. A row
 * with `avatar_style` set is wearing a generated avatar; one without it has
 * a real photo.
 *
 * **Animation is SVG-only, and it is CSS.** DiceBear puts `@keyframes` inside
 * the SVG. `react-native-svg` and `expo-image` both draw the first frame and
 * stop, so an animated avatar animates only where a real CSS engine renders
 * it — see `components/ui/GeneratedAvatar.tsx`, which is why that component
 * exists and why it is used for one large avatar rather than for a list.
 */

/** v10 is the version these URLs are pinned to. An unpinned major would
 *  silently redraw every avatar in the app on DiceBear's release schedule —
 *  the whole point of a seeded avatar is that it does not change. */
const API = "https://api.dicebear.com/10.x";

/** The raster size we ask for. DiceBear caps PNG at 256, which is already
 *  three times the largest avatar the app draws (86pt on the profile). */
const PNG_SIZE = 256;

export type AvatarAnimation =
  | "none"
  | "slowest"
  | "slow"
  | "medium"
  | "fast"
  | "fastest";

export type DiceBearStyle = {
  /** The style's id in the URL. */
  id: string;
  /** What it is called in the picker. */
  label: string;
  /** Whether `animationVariant` does anything for this style. */
  animated: boolean;
};

/**
 * Every style DiceBear serves, in the order the picker shows them: the ones
 * that look like a person first, since that is what an avatar is standing in
 * for, then the abstract ones.
 */
export const DICEBEAR_STYLES: DiceBearStyle[] = [
  // ── People and creatures ──
  { id: "notionists-neutral", label: "Notionists", animated: false },
  { id: "notionists", label: "Notionists scene", animated: false },
  { id: "adventurer-neutral", label: "Adventurer", animated: false },
  { id: "adventurer", label: "Adventurer scene", animated: false },
  { id: "avataaars-neutral", label: "Avataaars", animated: false },
  { id: "avataaars", label: "Avataaars scene", animated: false },
  { id: "big-ears-neutral", label: "Big ears", animated: false },
  { id: "big-ears", label: "Big ears scene", animated: false },
  { id: "big-smile", label: "Big smile", animated: false },
  { id: "lorelei-neutral", label: "Lorelei", animated: false },
  { id: "lorelei", label: "Lorelei scene", animated: false },
  { id: "micah", label: "Micah", animated: false },
  { id: "miniavs", label: "Miniavs", animated: false },
  { id: "open-peeps", label: "Open peeps", animated: false },
  { id: "personas", label: "Personas", animated: false },
  { id: "croodles-neutral", label: "Croodles", animated: false },
  { id: "croodles", label: "Croodles scene", animated: false },
  { id: "dylan", label: "Dylan", animated: false },
  { id: "cameo", label: "Cameo", animated: false },
  { id: "toon-head", label: "Toon head", animated: false },
  { id: "line-face", label: "Line face", animated: false },
  { id: "initial-face", label: "Initial face", animated: true },
  { id: "gaze", label: "Gaze", animated: true },
  { id: "moods", label: "Moods", animated: true },
  { id: "critters", label: "Critters", animated: true },
  { id: "sprouts", label: "Sprouts", animated: true },
  { id: "clay", label: "Clay", animated: true },
  { id: "fun-emoji", label: "Fun emoji", animated: false },
  { id: "thumbs", label: "Thumbs", animated: true },
  { id: "bottts-neutral", label: "Bottts", animated: false },
  { id: "bottts", label: "Bottts scene", animated: false },
  { id: "pixelbot", label: "Pixelbot", animated: true },
  { id: "voxel-bot", label: "Voxel bot", animated: true },
  { id: "voxel-art", label: "Voxel art", animated: true },
  { id: "pixel-art-neutral", label: "Pixel art", animated: false },
  { id: "pixel-art", label: "Pixel art scene", animated: false },
  { id: "shadows", label: "Shadows", animated: false },
  { id: "cutouts", label: "Cutouts", animated: false },
  { id: "marbles", label: "Marbles", animated: false },
  { id: "icons", label: "Icons", animated: false },
  { id: "glyphs", label: "Glyphs", animated: false },
  { id: "initials", label: "Initials", animated: false },

  // ── Abstract ──
  { id: "shapes", label: "Shapes", animated: true },
  { id: "squircles", label: "Squircles", animated: true },
  { id: "blobs", label: "Blobs", animated: true },
  { id: "loops", label: "Loops", animated: true },
  { id: "glass", label: "Glass", animated: true },
  { id: "waves", label: "Waves", animated: true },
  { id: "rings", label: "Rings", animated: false },
  { id: "stripes", label: "Stripes", animated: false },
  { id: "slice", label: "Slice", animated: false },
  { id: "stack", label: "Stack", animated: false },
  { id: "weave", label: "Weave", animated: false },
  { id: "patchwork", label: "Patchwork", animated: false },
  { id: "shape-grid", label: "Shape grid", animated: false },
  { id: "triangles", label: "Triangles", animated: false },
  { id: "identicon", label: "Identicon", animated: false },
  { id: "disco", label: "Disco", animated: false },

  // ── Scenes ──
  { id: "landscape", label: "Landscape", animated: true },
  { id: "planets", label: "Planets", animated: true },
  { id: "constellation", label: "Constellation", animated: true },
];


export const isAnimatedStyle = (styleId?: string | null) =>
  !!styleId && !!DICEBEAR_STYLES.find((s) => s.id === styleId)?.animated;

/**
 * What a profile is given when nobody has chosen anything.
 *
 * One house style rather than a different one per person: the seed already
 * makes every avatar distinct, and letting the *style* vary too would make
 * one list look like five apps. Neutral because a generated avatar stands in
 * for a face, and the scene variants put a coloured backdrop behind it that
 * fights every surface it is placed on.
 */
export const DEFAULT_AVATAR_STYLE = "notionists-neutral";

/** The seed is the profile id, always. It exists before the avatar does, it
 *  never changes, and it is the same string on every device — a name would
 *  redraw the avatar when somebody fixed their spelling. */
export const avatarSeed = (userId: string) => String(userId);

const params = (seed: string, extra?: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams({ seed });
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v !== undefined && v !== "" && v !== "none") q.set(k, String(v));
  }
  return q.toString();
};

/** The URL that goes in `avatar_url`: raster, so every `<Image>` in the app
 *  can draw it without knowing any of this exists. */
export const dicebearPngUrl = (styleId: string, seed: string) =>
  `${API}/${styleId}/png?${params(seed, { size: PNG_SIZE })}`;

/** The URL for the surfaces that can render SVG — and, where the style and
 *  the setting both allow it, animate. */
export const dicebearSvgUrl = (
  styleId: string,
  seed: string,
  animation: AvatarAnimation = "none",
) =>
  `${API}/${styleId}/svg?${params(seed, {
    animationVariant: isAnimatedStyle(styleId) ? animation : undefined,
  })}`;

/**
 * Avatars that are not really avatars: no photo, or a placeholder some other
 * service generated. These are the rows a generated avatar replaces.
 *
 * Deliberately a short list of things we can be *sure* about. Google returns
 * its own monogram or silhouette for an account with no photo, and there is
 * no flag on the URL saying which of the two it is — so anything that isn't
 * a known placeholder is treated as a real photo and left alone. Guessing
 * the other way would delete somebody's actual picture, and the picker is
 * two taps away for the cases this misses.
 */
/**
 * The profile patch for wearing a generated avatar.
 *
 * All three columns together, never one at a time: `avatar_url` is what
 * every `<Image>` in the app reads and `avatar_style` is what says the URL
 * is generated rather than a photo somebody uploaded, so writing one without
 * the other leaves a profile that cannot answer which it has
 * (supabase/migrations/20260909120000_generated_avatars.sql).
 */
export const generatedAvatarFor = (
  userId: string,
  styleId: string = DEFAULT_AVATAR_STYLE,
  animation: AvatarAnimation = "none",
): {
  avatar_url: string;
  avatar_style: string;
  avatar_animation: AvatarAnimation;
} => ({
  avatar_url: dicebearPngUrl(styleId, avatarSeed(userId)),
  avatar_style: styleId,
  avatar_animation: animation,
});

const PLACEHOLDER_PATTERNS = [
  // Google's own "no photo" avatar.
  /lh3\.googleusercontent\.com\/a\/default-user/i,
  // Google's legacy default (the all-A account id).
  /googleusercontent\.com\/-.*\/AAAAAAAAAAA\//i,
  // Services whose entire job is generating a stand-in.
  /ui-avatars\.com/i,
  /avatars?\.dicebear\.com/i,
  /api\.dicebear\.com/i,
  // Gravatar asked for one of its own fallbacks.
  /gravatar\.com\/avatar\/.*[?&]d=(mp|mm|identicon|monsterid|wavatar|retro|robohash|blank)/i,
];

export const isPlaceholderAvatar = (url?: string | null): boolean => {
  const u = (url ?? "").trim();
  if (!u) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(u));
};
