import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  it("reports API and database health", async () => {
    const fakePrisma = { $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]) };
    const app = await buildApp({ prisma: fakePrisma as never });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", database: "ok" });
    await app.close();
  });

  it("returns a safe error when the database is unavailable", async () => {
    const fakePrisma = { $queryRaw: vi.fn().mockRejectedValue(new Error("secret stack value")) };
    const app = await buildApp({ prisma: fakePrisma as never });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("secret stack value");
    await app.close();
  });
});
