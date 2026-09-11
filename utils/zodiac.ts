/**
 * Birthday display helpers.
 *
 * A user's `birth_date` is private — it age-gates content and is never shown
 * to anyone. When someone opts into showing their birthday on their profile
 * (profiles.show_birthday), what's actually shown is one of these derived
 * values instead of the date: their age, their Bhutanese animal year, or
 * their Western sun sign. See profiles.birthday_display.
 */

import { getAgeFromDate } from "@/utils/age";

export type BirthdayDisplay = "age" | "animal" | "sun";

export interface BirthdaySign {
  label: string;
}

// Tibetan/Bhutanese 12-year cycle, in order. Note "Bird" and "Sheep" rather
// than the Chinese zodiac's Rooster and Goat.
const ANIMALS = [
  "Rat",
  "Ox",
  "Tiger",
  "Rabbit",
  "Dragon",
  "Snake",
  "Horse",
  "Sheep",
  "Monkey",
  "Bird",
  "Dog",
  "Pig",
];

/**
 * Animal year for a birth date. 2020 was a Rat year, and the cycle runs
 * forward from there.
 *
 * Caveat worth knowing: Losar (the Bhutanese new year) falls in
 * January–March, so someone born in those weeks technically belongs to the
 * *previous* animal year. Pinning that down needs a lunar-calendar table
 * per year; this maps on the Gregorian year instead, which is right for
 * roughly five sixths of the year and is what people usually quote.
 */
export function getAnimalYear(birthDate: Date): BirthdaySign {
  const index = (((birthDate.getFullYear() - 2020) % 12) + 12) % 12;
  return { label: ANIMALS[index] };
}

// Start day of each sign, paired with the sign that begins on it. Read in
// order: the last entry whose start day is on or before the birth date wins,
// with Capricorn wrapping the year end.
const SUN_SIGNS: { month: number; day: number; label: string }[] = [
  { month: 1, day: 1, label: "Capricorn" },
  { month: 1, day: 20, label: "Aquarius" },
  { month: 2, day: 19, label: "Pisces" },
  { month: 3, day: 21, label: "Aries" },
  { month: 4, day: 20, label: "Taurus" },
  { month: 5, day: 21, label: "Gemini" },
  { month: 6, day: 21, label: "Cancer" },
  { month: 7, day: 23, label: "Leo" },
  { month: 8, day: 23, label: "Virgo" },
  { month: 9, day: 23, label: "Libra" },
  { month: 10, day: 23, label: "Scorpio" },
  { month: 11, day: 22, label: "Sagittarius" },
  { month: 12, day: 22, label: "Capricorn" },
];

/** Western sun sign for a birth date. */
export function getSunSign(birthDate: Date): BirthdaySign {
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();
  let match = SUN_SIGNS[0].label;
  for (const entry of SUN_SIGNS) {
    if (month > entry.month || (month === entry.month && day >= entry.day)) {
      match = entry.label;
    }
  }
  return { label: match };
}

/** Parses a `YYYY-MM-DD` birth_date into a Date, or null if it's unset or
 *  unparseable. Built from parts rather than `new Date(string)` so it lands
 *  on local midnight instead of shifting a day across timezones. */
export function parseBirthDate(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * What a profile should show for its owner's birthday — `null` when there's
 * no birth date on file or the owner hasn't opted in, which is the case
 * every caller should treat as "show nothing at all".
 */
export function birthdayBadge(
  birthDate: string | null | undefined,
  showBirthday: boolean | null | undefined,
  display: BirthdayDisplay | string | null | undefined,
): BirthdaySign | null {
  if (!showBirthday) return null;
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return null;

  switch (display) {
    case "animal":
      return getAnimalYear(parsed);
    case "sun":
      return getSunSign(parsed);
    default:
      return { label: `${getAgeFromDate(parsed)}` };
  }
}
