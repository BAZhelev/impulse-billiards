import { nextJsConfig } from "@repo/eslint-config/next-js";
import { config as reactInternalConfig } from "@repo/eslint-config/react-internal";

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
  // apps/docs (Next.js App Router)
  ...nextJsConfig.map((c) => ({
    ...c,
    files: ["apps/docs/**/*.{js,jsx,ts,tsx}"],
    rules: {
      ...c.rules,
      "@next/next/no-html-link-for-pages": ["error", "apps/docs/app"],
    },
  })),
  // Packages (React internal + shared) — scope React rules to packages/*
  ...reactInternalConfig.map((c) => ({
    ...c,
    files: ["packages/**/*.{js,jsx,ts,tsx}"],
  })),
];
