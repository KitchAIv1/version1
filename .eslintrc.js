module.exports = {
  root: true,
  extends: [
    '@react-native-community',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'warn',
    'react-hooks/exhaustive-deps': 'warn'
  },
  ignorePatterns: [
    'supabase/functions/**/*',
    'node_modules/**/*',
    'android/**/*',
    'ios/**/*',
    'dist/**/*',
    'build/**/*'
  ]
};
