import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/seekapi",
  },
});
