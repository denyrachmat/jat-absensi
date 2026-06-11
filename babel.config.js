module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }], 
      'nativewind/babel',
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
      // Plugin react-native-worklets/plugin DIHAPUS karena bentrok
      'react-native-reanimated/plugin', // 👈 Cukup gunakan ini saja, wajib paling bawah
    ],
  };
};