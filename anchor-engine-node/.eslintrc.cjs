/**
 * ESLint configuration for Anchor Engine
 * @fileoverview ESLint config with security rules for TypeScript/Node.js
 * @author Robert Balch II
 */

module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./engine/tsconfig.json', './mcp-server/tsconfig.json']
  },
  plugins: [
    '@typescript-eslint',
    'security'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:security/recommended-legacy'  // Security rules
  ],
  rules: {
    // === Error Prevention ===
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-ex-assign': 'error',
    'no-unsafe-finally': 'error',
    'no-useless-catch': 'error',

    // === Security Rules ===
    // Prevent non-literal filenames in fs operations
    'security/detect-non-literal-fs-filename': ['warn', {
      allowDynamic: false,
      allowDynamicFileExtension: true
    }],
    // Prevent non-literal require() calls
    'security/detect-non-literal-require': ['warn', {
      allowDynamic: false
    }],
    // Prevent potential command injection
    'security/detect-child-process': ['warn', { allowList: [] }],
    // Prevent regex denial of service
    'security/detect-unsafe-regex': 'warn',
    // Prevent hardcoded secrets
    'security/detect-buffer-noassert': 'warn',
    'security/detect-disable-mustache-escape': 'warn',
    'security/detect-eval-with-expression': 'warn',
    'security/detect-no-csrf-before-method-override': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-pseudoRandomBytes': 'warn',

    // === TypeScript Specific ===
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/prefer-ts-expect-error': 'error',

    // === Code Style ===
    'semi': ['error', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'always-multiline'],
    'object-curly-spacing': ['error', 'always'],
    'arrow-parens': ['warn', 'as-needed'],
    'max-len': ['warn', {
      code: 120,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true
    }],
    'curly': ['error', 'multi-line', 'consistent'],
    'dot-notation': ['error', { allowPattern: '^[A-Z_][A-Z0-9_]*$' }],
    'eqeqeq': ['error', 'smart'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-labels': 'warn',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    'no-with': 'error',
    'prefer-const': 'error',
    'prefer-destructuring': ['warn', {
      VariableDeclarator: { array: false, object: true },
      AssignmentExpression: { array: true, object: true }
    }, {
      enforceForRenamedProperties: false
    }],

    // === Best Practices ===
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 3],
    'max-params': ['warn', 4],
    'new-cap': 'error',
    'no-array-constructor': 'error',
    'no-continue': 'off',
    'no-inline-comments': 'off',
    'no-lonely-if': 'error',
    'no-mixed-operators': 'error',
    'no-nested-ternary': 'off',
    'no-return-assign': ['error', 'except-parens'],
    'no-underscore-dangle': 'off',
    'no-unneeded-ternary': 'error',
    'one-var': ['error', 'never'],
    'operator-assignment': 'error',
    'padding-line-between-statements': ['error',
      { blankLine: 'always', prev: 'directive', next: '*' },
      { blankLine: 'always', prev: '*', next: 'function' },
      { blankLine: 'always', prev: 'function', next: 'function' },
      { blankLine: 'any', prev: ['const', 'let', 'var'], next: '*' },
      { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] }
    ]
  },
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts', 'tests/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-non-literal-require': 'off'
      }
    },
    {
      files: ['*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'max-len': 'off'
      }
    },
    {
      // JavaScript files (not TypeScript) - use simpler rules
      files: ['*.js', '*.cjs'],
      parser: 'espree',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/promise-function-async': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-array-delete': 'off',
        '@typescript-eslint/no-base-to-string': 'off',
        '@typescript-eslint/no-duplicate-type-constituents': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
        '@typescript-eslint/no-redundant-type-constituents': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/no-unsafe-enum-comparison': 'off',
        '@typescript-eslint/only-throw-error': 'off',
        '@typescript-eslint/prefer-promise-reject-errors': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/restrict-plus-operands': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'security/detect-non-literal-require': 'off',
        'security/detect-non-literal-fs-filename': 'off'
      }
    }
  ]
};
