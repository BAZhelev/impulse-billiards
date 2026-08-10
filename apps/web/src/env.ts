import { createEnv } from "@t3-oss/env-nextjs";
// import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables.
   * These are only available in Node.js — never exposed to the browser.
   */
  server: {
    // Example:
    // DATABASE_URL: z.string().url(),
    // NEXTAUTH_SECRET: z.string(),
  },

  /**
   * Client-side environment variables.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    // Example:
    // NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * Map the validated schemas to process.env.
   * Client vars must be explicitly mapped here.
   */
  runtimeEnv: {
    // DATABASE_URL: process.env.DATABASE_URL,
    // NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
