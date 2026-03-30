import { Linking } from "react-native";

const BT_LOCAL_MOBILE_8 = /^(17|16|77)/;

/** Strip formatting; keep optional leading + for international numbers. */
export function telHrefFromPhone(
  phone: string | null | undefined,
): string | null {
  if (phone == null) return null;
  const cleaned = String(phone).trim().replace(/[^\d+]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const digitsOnly = cleaned.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let normalized: string;
  if (digitsOnly.startsWith("975") && digitsOnly.length >= 11) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.length === 8 && BT_LOCAL_MOBILE_8.test(digitsOnly)) {
    normalized = `+975${digitsOnly}`;
  } else if (cleaned.startsWith("+")) {
    normalized = `+${digitsOnly}`;
  } else {
    normalized = digitsOnly;
  }

  if (!normalized.replace(/\D/g, "")) return null;
  return `tel:${normalized}`;
}

/** Opens the system phone app with the number ready to call. */
export async function openPhoneDialer(
  phone: string | null | undefined,
): Promise<boolean> {
  const href = telHrefFromPhone(phone);
  if (!href) return false;
  try {
    const can = await Linking.canOpenURL(href);
    if (can) {
      await Linking.openURL(href);
      return true;
    }
  } catch {
    /* try openURL anyway */
  }
  try {
    await Linking.openURL(href);
    return true;
  } catch {
    return false;
  }
}
