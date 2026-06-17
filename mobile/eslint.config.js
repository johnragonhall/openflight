const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    rules: {
      // React Native Animated API uses `useRef(new Animated.Value()).current`
      // during render — this is the official RN pattern, not a bug.
      'react-hooks/refs': 'off',

      'no-console': 'warn',
      '@typescript-eslint/array-type': ['warn', { default: 'array' }],
    },
  },
];
