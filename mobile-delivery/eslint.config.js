// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Screens load data in effects the way the web pages do (setLoading(true) then fetch).
      // Keep it visible as a warning instead of contorting every fetch-on-mount effect.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
