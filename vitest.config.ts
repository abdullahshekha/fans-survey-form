import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, ".") },
      // Vitest does not set the React Server condition, so importing the
      // "server-only" marker package would throw. Stub it for unit tests.
      // Scoped regex so it can't prefix-match other specifiers.
      { find: /^server-only$/, replacement: resolve(__dirname, "tests/setup/server-only-stub.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    globals: true,
    passWithNoTests: false,
  },
});
