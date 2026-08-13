import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Global ignores (applied regardless of file pattern below)
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/next-env.d.ts",
    ],
  },
  // apps/web (Next.js App Router)
  ...nextJsConfig.map((c) => ({
    ...c,
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    rules: {
      ...c.rules,
      "@next/next/no-html-link-for-pages": ["error", "apps/web/app"],
    },
  })),
];
