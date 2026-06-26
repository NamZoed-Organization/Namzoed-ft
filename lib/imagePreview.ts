/**
 * Build a tiny, low-resolution version of a Supabase Storage image URL using
 * the Storage image-transformation endpoint. Used as an instant "pixelated"
 * placeholder while the full image downloads (Instagram-style), without needing
 * a precomputed BlurHash.
 *
 * Public object URLs look like:
 *   …/storage/v1/object/public/<bucket>/<path>
 * The transform endpoint is:
 *   …/storage/v1/render/image/public/<bucket>/<path>?width=…&quality=…
 *
 * Returns undefined for non-Supabase URLs (nothing to transform) so callers can
 * fall back to a BlurHash or solid colour. NOTE: requires Supabase Image
 * Transformations to be enabled on the project; if not, the request fails
 * silently and expo-image simply shows the background — no broken state.
 */
export function toLowResPreviewUrl(
  url?: string | null,
  width = 32,
  quality = 30,
): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const marker = "/storage/v1/object/public/";
  if (!url.includes(marker)) return undefined;
  const transformed = url.replace(marker, "/storage/v1/render/image/public/");
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${width}&quality=${quality}`;
}
