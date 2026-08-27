import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables.
   * These are only available in Node.js — never exposed to the browser.
   */
  server: {
    PAYLOAD_URL: z.url(),
  },

  /**
   * Client-side environment variables.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {},

  /**
   * Map the validated schemas to process.env.
   */
  runtimeEnv: {
    PAYLOAD_URL: process.env.PAYLOAD_URL,
  },
});
