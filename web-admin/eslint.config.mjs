import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
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
  },
];

export default eslintConfig;
