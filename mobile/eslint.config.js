const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/**', '.expo/**'],
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      globals: { __dirname: 'readonly' },
    },
  },
]);
