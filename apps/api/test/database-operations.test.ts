import { describe, expect, it, vi } from "vitest";
import { createDatabaseOperations } from "../src/services/database-operations.js";

function lifecycle() {
  return { $disconnect: vi.fn().mockResolvedValue(undefined), $connect: vi.fn().mockResolvedValue(undefined) };
}

describe("database operations", () => {
  it("runs migration only without disconnecting or seeding", async () => {
    const prisma = lifecycle();
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const operations = createDatabaseOperations({ prisma, runCommand });

    await expect(operations.migrate()).resolves.toEqual({ operation: "migrate", status: "completed" });
    expect(runCommand).toHaveBeenCalledOnce();
    expect(runCommand).toHaveBeenCalledWith(["--filter", "@sesb/database", "db:migrate"]);
    expect(prisma.$disconnect).not.toHaveBeenCalled();
    expect(prisma.$connect).not.toHaveBeenCalled();
  });

  it("disconnects, resets, seeds, and reconnects in order", async () => {
    const events: string[] = [];
    const prisma = {
      $disconnect: vi.fn(async () => { events.push("disconnect"); }),
      $connect: vi.fn(async () => { events.push("connect"); }),
    };
    const runCommand = vi.fn(async (args: readonly string[]) => {
      events.push(args.at(-1) === "db:seed" ? "seed" : "reset");
    });
    const operations = createDatabaseOperations({ prisma, runCommand });

    await expect(operations.freshSeed()).resolves.toEqual({ operation: "fresh-seed", status: "completed" });
    expect(events).toEqual(["disconnect", "reset", "seed", "connect"]);
    expect(runCommand).toHaveBeenNthCalledWith(1, ["--filter", "@sesb/database", "exec", "prisma", "migrate", "reset", "--force", "--skip-seed"]);
    expect(runCommand).toHaveBeenNthCalledWith(2, ["--filter", "@sesb/database", "db:seed"]);
  });

  it("rejects a concurrent operation", async () => {
    let releaseFirstCommand: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { releaseFirstCommand = resolve; });
    const operations = createDatabaseOperations({ prisma: lifecycle(), runCommand: vi.fn(() => pending) });

    const first = operations.migrate();
    await expect(operations.freshSeed()).rejects.toMatchObject({
      statusCode: 409,
      code: "DATABASE_OPERATION_IN_PROGRESS",
    });
    releaseFirstCommand?.();
    await first;
  });

  it("attempts to reconnect when reset fails", async () => {
    const prisma = lifecycle();
    const runCommand = vi.fn().mockRejectedValueOnce(new Error("reset failed"));
    const operations = createDatabaseOperations({ prisma, runCommand });

    await expect(operations.freshSeed()).rejects.toThrow("reset failed");
    expect(prisma.$connect).toHaveBeenCalledOnce();
  });
});
