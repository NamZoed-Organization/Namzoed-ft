module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // REMOVED: 'react-native-worklets/plugin', 
      
      // This handles all the animation worklets you need:
      'react-native-reanimated/plugin', 
    ],
  };
};