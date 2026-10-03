import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { sesbPrisma?: PrismaClient };

export const prisma = globalForPrisma.sesbPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.sesbPrisma = prisma;
