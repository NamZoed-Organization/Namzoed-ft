const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname);

// Add Reanimated support to prevent crashes
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true, // Prevents function name mangling that breaks Reanimated
  },
};

// Fix: event-target-shim uses ./index subpath which is not in its package exports.
// Disabling the experimental package exports resolver avoids the warning and
// any potential runtime failures it can cause with Supabase's realtime client.
config.resolver.unstable_enablePackageExports = false;

// Apply NativeWind
module.exports = withNativeWind(config, { input: './global.css' });