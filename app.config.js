/**
 * Google Maps for react-native-maps:
 * - Injects keys into Expo config (android.config.googleMaps / ios.config.googleMapsApiKey).
 * - Registers the official `react-native-maps` config plugin when a key exists (needed for
 *   `npx expo prebuild` / dev builds — does not change the Expo Go binary).
 *
 * Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env (Maps SDK for Android + iOS enabled on that key).
 */
module.exports = ({ config }) => {
  const mapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    "";

  const plugins = [...(config.plugins ?? [])];
  const hasMapsPlugin = plugins.some(
    (p) =>
      p === "react-native-maps" ||
      (Array.isArray(p) && p[0] === "react-native-maps"),
  );
  if (mapsKey && !hasMapsPlugin) {
    plugins.push([
      "react-native-maps",
      {
        androidGoogleMapsApiKey: mapsKey,
        iosGoogleMapsApiKey: mapsKey,
      },
    ]);
  }

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          ...(config.android?.config?.googleMaps ?? {}),
          apiKey:
            mapsKey ||
            config.android?.config?.googleMaps?.apiKey ||
            "",
        },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios?.config ?? {}),
        googleMapsApiKey:
          mapsKey || config.ios?.config?.googleMapsApiKey || "",
      },
    },
  };
};
