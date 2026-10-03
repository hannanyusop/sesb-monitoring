import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@sesb/database";

export function registerHealthRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "database health check failed");
      return reply.status(503).send({
        error: { code: "DATABASE_UNAVAILABLE", message: "Database is unavailable" },
      });
    }
  });
}
