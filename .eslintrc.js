module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true, // Add Jest environment if you plan to use it
    'react-native/react-native': true, // Add react-native environment
  },
  extends: [
    'airbnb',
    'airbnb/hooks',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended', // Ensures Prettier rules are integrated
    'plugin:import/typescript', // Helps resolve TypeScript imports
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    'react',
    'react-hooks',
    '@typescript-eslint',
    'prettier', // Runs Prettier as an ESLint rule
    'react-native', // Add react-native plugin
    'import', // Add import plugin
  ],
  rules: {
    'prettier/prettier': 'error', // Report Prettier violations as ESLint errors
    'react/jsx-filename-extension': [
      1,
      { extensions: ['.js', '.jsx', '.ts', '.tsx'] }, // Allow JSX in .ts and .tsx files
    ],
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+ and Expo SDK 49+
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }], // Allow importing devDeps
    'no-use-before-define': 'off', // Disable base rule, use TS rule below
    '@typescript-eslint/no-use-before-define': ['error'], // Use TS version of no-use-before-define
    'react/style-prop-object': 'off', // Disable for NativeWind compatibility if needed
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Warn on unused vars, allow underscore prefix
    'global-require': 'off', // Allow require() for images/assets in React Native
    'import/prefer-default-export': 'off', // Disable prefer-default-export
    // Add any other custom rules or overrides here
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        project: './tsconfig.json', // Specify the tsconfig file
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
    react: {
      version: 'detect', // Automatically detect the React version
    },
  },
  // Add overrides for specific file types
  overrides: [
    {
      files: ['.js', '*.config.js'], // Target JS config files
      rules: {
        '@typescript-eslint/no-var-requires': 'off', // Allow require() in JS config files
        '@typescript-eslint/no-require-imports': 'off', // Allow require() in JS config files (alternative rule name)
      },
    },
  ],
};
