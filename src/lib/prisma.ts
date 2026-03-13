import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

declare global {
	var __advanciaLedgerPrisma: PrismaClient | undefined;
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

export const prisma =
	globalThis.__advanciaLedgerPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
	globalThis.__advanciaLedgerPrisma = prisma;
}
