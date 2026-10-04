import type { FastifyInstance } from "fastify";
import type { DatabaseOperations } from "../services/database-operations.js";

export function registerAdminDatabaseRoutes(app: FastifyInstance, operations: DatabaseOperations): void {
  app.post("/admin/database/migrate", async () => operations.migrate());
  app.post("/admin/database/fresh-seed", async () => operations.freshSeed());
}
