import { prisma } from "@sesb/database";
import { z } from "zod";
import { buildApp } from "./app.js";

const env = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
}).parse(process.env);

const app = await buildApp({ logger: true });
await app.listen({ host: env.HOST, port: env.PORT });

async function shutdown(): Promise<void> {
  await app.close();
  await prisma.$disconnect();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
