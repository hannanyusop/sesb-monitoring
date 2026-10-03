import cors from "@fastify/cors";
import { prisma as defaultPrisma, Prisma, type PrismaClient } from "@sesb/database";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { DomainError } from "./errors.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerHouseRoutes } from "./routes/houses.js";
import { registerReadingRoutes } from "./routes/readings.js";
import { registerTariffRoutes } from "./routes/tariffs.js";

export async function buildApp(options: { prisma?: PrismaClient; logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const prisma = options.prisma ?? defaultPrisma;
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });

  registerHealthRoute(app, prisma);
  registerHouseRoutes(app, prisma);
  registerReadingRoutes(app, prisma);
  registerTariffRoutes(app, prisma);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
      });
    }
    if (error instanceof ZodError) {
      const fields = Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message]));
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "Check the submitted fields", fields } });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return reply.status(404).send({ error: { code: "RESOURCE_NOT_FOUND", message: "The requested record was not found" } });
    }
    app.log.error({ err: error }, "unhandled request error");
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });
  return app;
}
