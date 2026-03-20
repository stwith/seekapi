import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app/build-app.js";

// AC1: repository has a working harness entry structure
describe("app scaffold", () => {
  it("builds the fastify application", async () => {
    const app = await buildApp({ logger: false });
    expect(app).toBeDefined();
    await app.close();
  });

  it("responds to health probe", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
