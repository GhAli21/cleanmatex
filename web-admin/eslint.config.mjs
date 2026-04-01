// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import nextVitals from "eslint-config-next/core-web-vitals";

import jsdoc from 'eslint-plugin-jsdoc';
const eslintConfig = [...nextVitals, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ],
}, {
  // JSDoc enforcement — warn only, does not block builds or commits
  plugins: { jsdoc },
  rules: {
    'jsdoc/require-jsdoc': ['warn', {
      publicOnly: true,
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: false,
        FunctionExpression: false,
      },
      contexts: [
        'TSInterfaceDeclaration',
        'TSTypeAliasDeclaration',
        'ExportNamedDeclaration > FunctionDeclaration',
      ],
    }],
    'jsdoc/require-param': 'warn',
    'jsdoc/require-returns': 'warn',
    'jsdoc/require-param-description': 'warn',
    'jsdoc/require-returns-description': 'warn',
    'jsdoc/check-param-names': 'warn',
    'jsdoc/check-types': 'warn',
    'jsdoc/no-undefined-types': 'off',  // too noisy with TypeScript
    'jsdoc/valid-types': 'warn',
    'jsdoc/check-tag-names': 'warn',
  },
}, {
  rules: {
    // Migrated: prefer @ui/* over legacy @/components (Phase 6)
    'no-restricted-imports': ['warn', {
      patterns: [
        {
          group: ['@/components/ui', '@/components/ui/*', '@/components/auth/*', '@/components/layout/*', '@/components/dashboard/*', '@/components/orders/*', '@/components/settings/*'],
          message: 'Use @ui Cmx components (e.g. @ui/primitives, @ui/feedback, @ui/overlays). See docs/dev/ui-migration-guide.md',
        },
        {
          group: ['@ui/compat', '**/ui/compat', '**/ui/compat/*'],
          message: '@ui/compat has been removed. Use @ui/primitives, @ui/feedback, or @ui/overlays. See docs/dev/ui-migration-guide.md',
        },
      ],
    }],
    // Minimum rules - all turned off to allow build to succeed
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "react/no-unescaped-entities": "off",
    "prefer-const": "off",
    // Disable all other rules that might cause issues
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "off",
    "react-hooks/exhaustive-deps": "off",
    "@next/next/no-img-element": "off",
  },
}, ...storybook.configs["flat/recommended"]];

export default eslintConfig;
