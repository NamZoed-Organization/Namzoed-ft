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

// Apply NativeWind
module.exports = withNativeWind(config, { input: './global.css' });