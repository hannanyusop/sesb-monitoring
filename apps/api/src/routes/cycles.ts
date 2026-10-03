import { BudgetInputSchema, CyclePreviewInputSchema, StartCycleInputSchema } from "@sesb/contracts";
import type { PrismaClient } from "@sesb/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createCycleService } from "../services/cycles.js";

const houseParams = z.object({ houseId: z.string().uuid() });
const cycleParams = houseParams.extend({ cycleId: z.string().uuid() });

export function registerCycleRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  const service = createCycleService(prisma);
  app.post("/houses/:houseId/cycles/preview", async (request) => {
    const { houseId } = houseParams.parse(request.params);
    return service.preview(houseId, CyclePreviewInputSchema.parse(request.body));
  });
  app.post("/houses/:houseId/cycles", async (request, reply) => {
    const { houseId } = houseParams.parse(request.params);
    return reply.status(201).send(await service.start(houseId, StartCycleInputSchema.parse(request.body)));
  });
  app.get("/houses/:houseId/cycles", async (request) => {
    const { houseId } = houseParams.parse(request.params);
    return service.list(houseId);
  });
  app.get("/houses/:houseId/cycles/:cycleId/insights", async (request) => {
    const { houseId, cycleId } = cycleParams.parse(request.params);
    return service.insights(houseId, cycleId);
  });
  app.post("/houses/:houseId/cycles/:cycleId/undo", async (request) => {
    const { houseId, cycleId } = cycleParams.parse(request.params);
    return service.undo(houseId, cycleId);
  });
  app.put("/houses/:houseId/budget", async (request) => {
    const { houseId } = houseParams.parse(request.params);
    return service.setBudget(houseId, BudgetInputSchema.parse(request.body));
  });
}
