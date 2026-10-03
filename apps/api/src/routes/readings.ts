import { CreateReadingInputSchema } from "@sesb/contracts";
import type { PrismaClient } from "@sesb/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createReadingService } from "../services/readings.js";

const paramsSchema = z.object({ houseId: z.string().uuid() });
const querySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export function registerReadingRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  const service = createReadingService(prisma);
  app.post("/houses/:houseId/readings", async (request, reply) => {
    const { houseId } = paramsSchema.parse(request.params);
    const result = await service.createManualReading(houseId, CreateReadingInputSchema.parse(request.body));
    return reply.status(201).send(result);
  });
  app.get("/houses/:houseId/readings", (request) => {
    const { houseId } = paramsSchema.parse(request.params);
    const query = querySchema.parse(request.query);
    return service.listReadings(houseId, query.cursor, query.limit);
  });
}
