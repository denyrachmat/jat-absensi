module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      // Reanimated 4 memakai plugin dari react-native-worklets, bukan
      // react-native-reanimated/plugin. Wajib paling bawah.
      'react-native-worklets/plugin',
    ],
  };
};