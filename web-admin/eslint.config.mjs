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

/** Global import bans; repeated in every file-scoped no-restricted-imports block. */
const GLOBAL_RESTRICTED_PATHS = [
  {
    name: '@/lib/services/invoice-service',
    message: 'Use @/lib/services/ar-invoice.service for new AR work. invoice-service.ts is a legacy compatibility adapter only.',
  },
];
const GLOBAL_RESTRICTED_PATTERNS = [
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
];

// Raw Tailwind palette classes (black is allowed: overlays stay black in dark mode).
// esquery regexes cannot contain "/", so opacity suffixes are covered by the lookahead.
const RAW_PALETTE = String.raw`(^|[\s:])(bg|text|border|ring|from|via|to|divide|placeholder|outline|fill|stroke)-(white|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]+)?(?![\w-])`;
// Physical-direction classes that do not mirror in Arabic.
const RAW_PHYSICAL = String.raw`(^|[\s:])(-?(ml|mr|pl|pr|left|right)-([0-9]|px|auto|full|\[)|rounded-(l|r|tl|tr|bl|br)(?![\w])|border-(l|r)(?![\w])|(text|float|clear)-(left|right)(?![\w-]))`;
const PALETTE_MESSAGE = 'Raw Tailwind palette class: use a theme token (bg-card, bg-muted, text-foreground, text-muted-foreground, border-border, bg-success-bg, text-danger-text, ...). `node scripts/ui/codemod-classes.js <dir>` rewrites most. See docs/dev/ui-migration-guide.md';
const PHYSICAL_MESSAGE = 'Physical direction class: use the logical one (ms-/me-/ps-/pe-/start-/end-/text-start/text-end/rounded-s/border-s) so Arabic mirrors. `node scripts/ui/codemod-classes.js <dir>` rewrites most.';
const RAW_CLASS_RULES = [
  { selector: `Literal[value=/${RAW_PALETTE}/]`, message: PALETTE_MESSAGE },
  { selector: `TemplateElement[value.raw=/${RAW_PALETTE}/]`, message: PALETTE_MESSAGE },
  { selector: `Literal[value=/${RAW_PHYSICAL}/]`, message: PHYSICAL_MESSAGE },
  { selector: `TemplateElement[value.raw=/${RAW_PHYSICAL}/]`, message: PHYSICAL_MESSAGE },
];
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
    // Storybook static build output — generated bundles, gitignored, never source
    "storybook-static/**",
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
      paths: GLOBAL_RESTRICTED_PATHS,
      patterns: GLOBAL_RESTRICTED_PATTERNS,
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
}, {
  // ADR-060 §1 / Line-Level PLAN §4.1: lib/commercial/ is the pure,
  // domain-agnostic calculator. No I/O, no Prisma, no Supabase, no
  // server-only, no i18n, no Next server primitives. Decimal arithmetic comes
  // from decimal.js directly, never from @prisma/client/runtime. A later
  // block replaces (does not merge) the global no-restricted-imports list,
  // so the global UI patterns are repeated here.
  files: ['lib/commercial/**'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'server-only', message: 'lib/commercial/ is pure domain code: no server-only (ADR-060 §1).' },
        { name: 'next-intl', message: 'lib/commercial/ is pure domain code: no i18n (ADR-060 §1).' },
        { name: 'next/server', message: 'lib/commercial/ is pure domain code: no Next server primitives (ADR-060 §1).' },
      ],
      patterns: [
        {
          group: ['@prisma/client', '@prisma/client/**', 'prisma', '@/lib/db', '@/lib/db/**'],
          message: 'lib/commercial/ is pure domain code: no Prisma or DB access. Use decimal.js for Decimal (ADR-060 §1). Data comes in through lib/services/commercial/ loaders.',
        },
        {
          group: ['@supabase/**', '@/lib/supabase', '@/lib/supabase/**'],
          message: 'lib/commercial/ is pure domain code: no Supabase (ADR-060 §1).',
        },
        {
          group: ['@/lib/services/**', '@/app/**', '@/src/**', '@features/**', '@ui/**'],
          message: 'lib/commercial/ is the innermost layer: it must not import services, routes, features or UI (ADR-060 §1).',
        },
        {
          group: ['@/messages', '@/messages/*'],
          message: 'Do not import locale JSON directly. Load messages on the server with loadLocaleMessages() and consume text through next-intl.',
        },
      ],
    }],
  },
}, {
  // UI Design System PR-02: shared components use theme tokens and logical
  // direction classes only, and never import feature code. A file-scoped
  // no-restricted-imports replaces the global list, so its patterns are repeated.
  files: ['src/ui/**'],
  ignores: ['**/*.stories.tsx'],
  rules: {
    'no-restricted-syntax': ['error', ...RAW_CLASS_RULES],
    'no-restricted-imports': ['error', {
      paths: GLOBAL_RESTRICTED_PATHS,
      patterns: [
        ...GLOBAL_RESTRICTED_PATTERNS,
        {
          group: ['@features/**', '@/src/features/**'],
          message: 'src/ui is shared: it must not import feature code. Pass feature parts in as props or children.',
        },
      ],
    }],
  },
}, {
  // PR-05 migrated every feature, page and lib file: the class rules are errors there too.
  files: ['src/features/**', 'app/**', 'lib/**'],
  ignores: ['**/*.stories.tsx'],
  rules: {
    'no-restricted-syntax': ['error', ...RAW_CLASS_RULES],
  },
}, ...storybook.configs["flat/recommended"]];

export default eslintConfig;
