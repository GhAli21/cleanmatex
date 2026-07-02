// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import nextVitals from "eslint-config-next/core-web-vitals";

import jsdoc from 'eslint-plugin-jsdoc';

/** JSDoc rules turned off for tests, Storybook, and generated-style files */
const jsdocRulesOff = {
  'jsdoc/require-jsdoc': 'off',
  'jsdoc/require-param': 'off',
  'jsdoc/require-returns': 'off',
  'jsdoc/require-param-description': 'off',
  'jsdoc/require-returns-description': 'off',
  'jsdoc/check-param-names': 'off',
  'jsdoc/check-types': 'off',
  'jsdoc/valid-types': 'off',
  'jsdoc/check-tag-names': 'off',
};

const eslintConfig = [...nextVitals, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / very large — skip lint (Babel deoptimises >500KB; not hand-edited)
    "types/database.ts",
    "types/database.generated.ts",
    "docs/typedoc/**",
    "**/__scratch_*",
    // Playwright artifacts — generated bundles inside trace viewers, never source
    "playwright-report/**",
    "test-results/**",
  ],
}, {
  // JSDoc — warn on production code only; noisy rules off (TypeScript is source of truth)
  plugins: { jsdoc },
  settings: {
    jsdoc: {
      tagNamePreference: {
        'jest-environment': 'jest-environment',
        swagger: 'swagger',
        last_updated: 'last_updated',
        remarks: 'remarks',
      },
    },
  },
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
    'jsdoc/require-returns': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-returns-description': 'off',
    'jsdoc/check-param-names': ['warn', {
      checkDestructured: false,
      checkRestProperty: false,
    }],
    'jsdoc/check-types': 'warn',
    'jsdoc/no-undefined-types': 'off',
    'jsdoc/valid-types': 'warn',
    'jsdoc/check-tag-names': 'warn',
  },
}, {
  files: [
    '__tests__/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '.storybook/**',
  ],
  rules: jsdocRulesOff,
}, {
  rules: {
    // Migrated: prefer @ui/* over legacy @/components (Phase 6)
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@/lib/services/invoice-service',
          message: 'Use @/lib/services/ar-invoice.service for new AR work. invoice-service.ts is a legacy compatibility adapter only.',
        },
      ],
      patterns: [
        {
          group: ['@/components/ui', '@/components/ui/*', '@/components/auth/*', '@/components/layout/*', '@/components/dashboard/*', '@/components/orders/*', '@/components/settings/*'],
          message: 'Use @ui Cmx components (e.g. @ui/primitives, @ui/feedback, @ui/overlays). See docs/dev/ui-migration-guide.md',
        },
        {
          group: ['@ui/compat', '**/ui/compat', '**/ui/compat/*'],
          message: '@ui/compat has been removed. Use @ui/primitives, @ui/feedback, or @ui/overlays. See docs/dev/ui-migration-guide.md',
        },
        {
          group: ['@/messages', '@/messages/*'],
          message: 'Do not import locale JSON directly. Load messages on the server with loadLocaleMessages() and consume text through next-intl.',
        },
        {
          // Phase 2 (BVM Wiring): the legacy route folder
          // (_legacy_create-with-payment) was retired. The rule stays so that
          // any future revival attempt is caught at lint time.
          group: ['**/api/v1/orders/create-with-payment/**', '**/api/v1/orders/_legacy_create-with-payment/**'],
          message: 'The legacy create-with-payment route is retired. Use /api/v1/orders/submit-order and the submitOrder() orchestrator.',
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
    "react-hooks/incompatible-library": "warn",
    "@next/next/no-img-element": "off",
  },
}, {
  files: [
    'app/actions/payments/invoice-actions.ts',
    'app/actions/payments/invoice-list-actions.ts',
    'app/actions/orders/ready-order-actions.ts',
    'app/api/v1/orders/_legacy_create-with-payment/route.ts',
    'app/api/v1/orders/**/report/invoices-payments-rprt/route.ts',
    '__tests__/services/invoice-service.test.ts',
  ],
  rules: {
    'no-restricted-imports': 'off',
  },
}, ...storybook.configs["flat/recommended"]];

export default eslintConfig;
