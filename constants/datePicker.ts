// Shared props for every @react-native-community/datetimepicker in the app.
//
// The app declares "userInterfaceStyle": "automatic" (app.json), so on iOS the
// picker follows the *system* appearance rather than the screen it sits on.
// Every picker here is rendered on a white card, so a phone in dark mode drew
// the spinner's text in white on white — the wheel was there and scrollable,
// but invisible, which reads as "the date picker isn't showing".
//
// Pinning the variant (and the text color for the spinner display) keeps the
// wheel legible regardless of the phone's setting. Both props are iOS-only;
// Android ignores them.
export const LIGHT_DATE_PICKER_PROPS = {
  themeVariant: "light",
  textColor: "#111827",
} as const;
