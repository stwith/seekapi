import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      BRAVE_API_KEY: "test_brave_api_key",
    },
  },
});
