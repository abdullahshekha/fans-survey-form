import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/integration.setup.ts"],
    passWithNoTests: false,
    testTimeout: 30000,
    // rls-deactivation.test.ts flips rep.two inactive; keep files serial so it
    // can't interleave with rls.test.ts (which signs in as rep.two).
    fileParallelism: false,
  },
});
