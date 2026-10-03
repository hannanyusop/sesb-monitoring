import { CreateHouseInputSchema, UpdateHouseInputSchema } from "@sesb/contracts";
import type { PrismaClient } from "@sesb/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHouseService } from "../services/houses.js";

const paramsSchema = z.object({ houseId: z.string().uuid() });

export function registerHouseRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  const service = createHouseService(prisma);
  app.get("/houses", () => service.listActiveHouses());
  app.post("/houses", async (request, reply) => {
    const created = await service.createHouse(CreateHouseInputSchema.parse(request.body));
    return reply.status(201).send(created);
  });
  app.get("/houses/:houseId", (request) => {
    const { houseId } = paramsSchema.parse(request.params);
    return service.getHouse(houseId);
  });
  app.patch("/houses/:houseId", (request) => {
    const { houseId } = paramsSchema.parse(request.params);
    return service.updateHouse(houseId, UpdateHouseInputSchema.parse(request.body));
  });
}
