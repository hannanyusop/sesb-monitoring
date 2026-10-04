import type { FastifyInstance } from "fastify";
import type { DatabaseOperations } from "../services/database-operations.js";

export function registerAdminDatabaseRoutes(app: FastifyInstance, operations: DatabaseOperations): void {
  app.get("/admin/database/migrate", async () => operations.migrate());
  app.get("/admin/database/fresh-seed", async () => operations.freshSeed());
}
