import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { DomainError } from "../src/errors.js";
import type { DatabaseOperations } from "../src/services/database-operations.js";

function fakeOperations(): DatabaseOperations {
  return {
    migrate: vi.fn().mockResolvedValue({ operation: "migrate", status: "completed" }),
    freshSeed: vi.fn().mockResolvedValue({ operation: "fresh-seed", status: "completed" }),
  };
}

describe("database administration API", () => {
  it("runs migration only", async () => {
    const operations = fakeOperations();
    const app = await buildApp({ prisma: {} as never, databaseOperations: operations });
    const response = await app.inject({ method: "GET", url: "/admin/database/migrate" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ operation: "migrate", status: "completed" });
    expect(operations.migrate).toHaveBeenCalledOnce();
    expect(operations.freshSeed).not.toHaveBeenCalled();
    await app.close();
  });

  it("runs fresh and seed", async () => {
    const operations = fakeOperations();
    const app = await buildApp({ prisma: {} as never, databaseOperations: operations });
    const response = await app.inject({ method: "GET", url: "/admin/database/fresh-seed" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ operation: "fresh-seed", status: "completed" });
    expect(operations.freshSeed).toHaveBeenCalledOnce();
    await app.close();
  });

  it("returns the busy error envelope", async () => {
    const operations = fakeOperations();
    vi.mocked(operations.migrate).mockRejectedValueOnce(new DomainError(409, "DATABASE_OPERATION_IN_PROGRESS", "Another database operation is already running"));
    const app = await buildApp({ prisma: {} as never, databaseOperations: operations });
    const response = await app.inject({ method: "GET", url: "/admin/database/migrate" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "DATABASE_OPERATION_IN_PROGRESS", message: "Another database operation is already running" } });
    await app.close();
  });

  it("keeps command failures private", async () => {
    const operations = fakeOperations();
    vi.mocked(operations.migrate).mockRejectedValueOnce(new Error("secret command output"));
    const app = await buildApp({ prisma: {} as never, databaseOperations: operations });
    const response = await app.inject({ method: "GET", url: "/admin/database/migrate" });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret command output");
    await app.close();
  });

  it("does not expose the operations through POST", async () => {
    const app = await buildApp({ prisma: {} as never, databaseOperations: fakeOperations() });

    expect((await app.inject({ method: "POST", url: "/admin/database/migrate" })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/admin/database/fresh-seed" })).statusCode).toBe(404);
    await app.close();
  });
});
