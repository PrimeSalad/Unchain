module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 uses the worklets plugin; it must be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
