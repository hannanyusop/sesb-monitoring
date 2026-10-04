import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { PrismaClient } from "@sesb/database";
import { DomainError } from "../errors.js";

const execFileAsync = promisify(execFile);
const MIGRATE = ["--filter", "@sesb/database", "db:migrate"] as const;
const RESET = ["--filter", "@sesb/database", "exec", "prisma", "migrate", "reset", "--force", "--skip-seed"] as const;
const SEED = ["--filter", "@sesb/database", "db:seed"] as const;

export type DatabaseOperationResult = {
  operation: "migrate" | "fresh-seed";
  status: "completed";
};

export type DatabaseOperations = {
  migrate(): Promise<DatabaseOperationResult>;
  freshSeed(): Promise<DatabaseOperationResult>;
};

type PrismaLifecycle = Pick<PrismaClient, "$connect" | "$disconnect">;
type CommandRunner = (args: readonly string[]) => Promise<void>;

function findWorkspaceRoot(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory);
  while (true) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Unable to locate pnpm workspace root");
    directory = parent;
  }
}

async function runPnpm(args: readonly string[]): Promise<void> {
  await execFileAsync("pnpm", [...args], {
    cwd: findWorkspaceRoot(),
    maxBuffer: 1024 * 1024,
  });
}

export function createDatabaseOperations(options: {
  prisma: PrismaLifecycle;
  runCommand?: CommandRunner;
}): DatabaseOperations {
  const runCommand = options.runCommand ?? runPnpm;
  let activeOperation: DatabaseOperationResult["operation"] | null = null;

  async function runExclusive(
    operation: DatabaseOperationResult["operation"],
    action: () => Promise<void>,
  ): Promise<DatabaseOperationResult> {
    if (activeOperation) {
      throw new DomainError(409, "DATABASE_OPERATION_IN_PROGRESS", "Another database operation is already running");
    }
    activeOperation = operation;
    try {
      await action();
      return { operation, status: "completed" };
    } finally {
      activeOperation = null;
    }
  }

  return {
    migrate: () => runExclusive("migrate", () => runCommand(MIGRATE)),
    freshSeed: () => runExclusive("fresh-seed", async () => {
      try {
        await options.prisma.$disconnect();
        await runCommand(RESET);
        await runCommand(SEED);
      } finally {
        await options.prisma.$connect();
      }
    }),
  };
}
