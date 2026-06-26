/**
 * Date-of-birth helpers shared by signup and the login age prompt.
 */

/** Format a Date as a `YYYY-MM-DD` string for the `profiles.birth_date` column. */
export const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Human-readable date for display, e.g. "22 Jun 2006". */
export const formatDisplayDate = (date: Date): string =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Whole-years age from a birth Date. */
export const getAgeFromDate = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};
