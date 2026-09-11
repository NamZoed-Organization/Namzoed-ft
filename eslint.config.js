// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Deno, not React Native. Every import is a URL that Node's resolver
      // cannot follow, so linting them here reports seventeen unresolved
      // modules that are all perfectly resolvable where they actually run.
      'supabase/functions/**',
    ],
  },
  {
    // Plain Node, not the app: these run under `node`, where `Buffer` and
    // `__dirname` are globals rather than undefined names.
    files: ['render-worker/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', Buffer: 'readonly', process: 'readonly', require: 'readonly', module: 'writable' },
    },
  },
]);
