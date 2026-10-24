import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { sqliteAdapter } from "./sqlite";

function createClient() {
  return new PrismaClient({ adapter: sqliteAdapter() });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = typeof prisma;
/** Interactive-transaction client type. */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
