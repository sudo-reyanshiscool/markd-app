// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/*', 'e2e/playwright-report/*'],
  },
  {
    rules: {
      // Guarded require() is the project's deliberate pattern for optional
      // native modules (MMKV, RevenueCat, Sentry, expo-calendar, …) so the
      // app keeps running in Expo Go / keyless web builds.
      '@typescript-eslint/no-require-imports': 'off',
      // i18next's default export intentionally exposes .use()
      'import/no-named-as-default-member': 'off',
    },
  },
]);
