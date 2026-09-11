/**
 * qrPayload
 *
 * What a Namzoed QR code says, and how to read one back. Deliberately free
 * of imports: the card that draws a code (components/qr/NamzoedQrCard.tsx)
 * needs only this, and dragging Supabase and the notification service in
 * behind it would put the whole data layer on the render path of a
 * presentational component.
 *
 * The code encodes the person's **namzoed_id**, not their UUID. That id is
 * already printed under their name on the profile screen, so a code
 * carrying it discloses nothing new, and it keeps the payload short enough
 * to stay a low-version QR — which is what makes it scan quickly across a
 * table.
 */

/** Deep-link scheme already registered by the app (app.json `scheme`). */
const QR_SCHEME = "namzoed";
/** `add` is resolved by the deep-link switch in app/_layout.tsx, so a code
 *  scanned by the phone's own camera app lands on Add Friends rather than
 *  doing nothing. */
const QR_HOST = "add";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL || "https://namzoed.com";

/** A namzoed_id is a 4-letter word prefix + 4 alphanumerics (see
 *  add_namzoed_id_to_profiles.sql). The bound is loose on purpose — the
 *  lookup is what decides whether an id is real; this only rejects things
 *  that plainly aren't ids, so a future format change doesn't silently
 *  stop every code scanning. */
const NAMZOED_ID_PATTERN = /^[A-Za-z0-9]{6,16}$/;

/** Our own web host, plus its subdomains. Read from the configured share
 *  base so a staging domain works without a code change, with the
 *  production host kept as a floor in case the variable is unset or points
 *  somewhere else. */
function isOwnWebHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  let configured = "";
  try {
    configured = new URL(WEB_BASE_URL).hostname.toLowerCase();
  } catch {
    configured = "";
  }
  const allowed = [configured, "namzoed.com"].filter(Boolean);
  return allowed.some((base) => host === base || host.endsWith(`.${base}`));
}

/** What the QR encodes. */
export const buildNamzoedQrPayload = (namzoedId: string) =>
  `${QR_SCHEME}://${QR_HOST}/${encodeURIComponent(namzoedId)}`;

/** What "Share my code" sends to someone who may not have the app — opens
 *  the same screen through the web bridge when they do. */
export const buildNamzoedQrShareUrl = (namzoedId: string) =>
  `${WEB_BASE_URL}/${QR_HOST}/${encodeURIComponent(namzoedId)}?deep_link=${encodeURIComponent(
    buildNamzoedQrPayload(namzoedId),
  )}`;

/**
 * Pulls a namzoed id out of whatever the camera handed us.
 *
 * Deliberately generous about the shape: our own deep link, the web bridge
 * URL, and a bare id all resolve, because people do paste ids and other
 * apps do rewrite links. Anything else — a URL to somewhere that isn't us,
 * a wifi or vcard code — returns null, and the scanner says so rather than
 * looking up nonsense.
 */
export function parseNamzoedQrPayload(raw: string): string | null {
  const value = raw?.trim();
  if (!value) return null;

  if (NAMZOED_ID_PATTERN.test(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  // A share URL may carry the real deep link in ?deep_link=, same as every
  // other share target in the app (see resolveDestination in app/_layout.tsx).
  const nested = parsed.searchParams.get("deep_link");
  if (nested) {
    const fromNested = parseNamzoedQrPayload(decodeURIComponent(nested));
    if (fromNested) return fromNested;
  }

  const isCustomScheme = parsed.protocol === `${QR_SCHEME}:`;

  // An https code has to actually be one of ours. Without this, any site
  // serving a /add/<something> path would resolve to whichever Namzoed
  // profile happens to hold that id — a confirmation sheet for a stranger,
  // raised by a code that had nothing to do with this app.
  if (!isCustomScheme && !isOwnWebHost(parsed.hostname)) return null;

  const pathParts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  // A custom-scheme URL puts the first segment in `host`, not in the path.
  const segments = isCustomScheme && parsed.host ? [parsed.host, ...pathParts] : pathParts;

  const hostIndex = segments.findIndex((s) => s.toLowerCase() === QR_HOST);
  const candidate = hostIndex >= 0 ? segments[hostIndex + 1] : undefined;
  if (!candidate || !NAMZOED_ID_PATTERN.test(candidate)) return null;

  return candidate;
}
