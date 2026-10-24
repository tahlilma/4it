import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client";
async function main() {
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./data/perf.db" }) });
  for (const sql of ["PRAGMA journal_mode = WAL", "PRAGMA synchronous = NORMAL", "PRAGMA cache_size = -32000", "PRAGMA temp_store = MEMORY", "PRAGMA mmap_size = 268435456", "PRAGMA busy_timeout = 8000"]) {
    for (const how of ["execute", "query"] as const) {
      try {
        const r = how === "execute" ? await db.$executeRawUnsafe(sql) : await db.$queryRawUnsafe(sql);
        console.log(how.padEnd(8), sql.padEnd(32), "ok", JSON.stringify(r, (_, v) => (typeof v === "bigint" ? Number(v) : v)));
      } catch (e) {
        console.log(how.padEnd(8), sql.padEnd(32), "ERR", String((e as Error).message).split("\n").pop()?.slice(0, 90));
      }
    }
  }
  console.log(await db.$queryRawUnsafe("PRAGMA journal_mode"), await db.$queryRawUnsafe("PRAGMA synchronous"));
  await db.$disconnect();
}
main();
