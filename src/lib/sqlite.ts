import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * SQLite settings, applied when a connection opens (lazily, on the first query):
 *  - WAL lets every HR PC keep reading while a payroll run or the punch-machine sync writes
 *    (stored in the database file, so every process uses it once set);
 *  - synchronous=NORMAL is safe with WAL and far faster on Windows disks;
 *  - a 32 MB page cache, in-memory temp tables and memory-mapped reads speed up large reports;
 *  - writers wait up to 8 s for each other instead of failing.
 */
const PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA cache_size = -32000",
  "PRAGMA temp_store = MEMORY",
  "PRAGMA mmap_size = 268435456",
  "PRAGMA busy_timeout = 8000",
];

/** The Prisma SQLite adapter with the settings above. Used by the app, the seed and scripts. */
export class TunedSqlite extends PrismaBetterSqlite3 {
  override async connect() {
    const adapter = await super.connect();
    for (const sql of PRAGMAS) await adapter.executeRaw({ sql, args: [], argTypes: [] });
    return adapter;
  }
}

export function sqliteAdapter(): TunedSqlite {
  return new TunedSqlite({ url: process.env.DATABASE_URL ?? "file:./data/hrpayroll.db" });
}
