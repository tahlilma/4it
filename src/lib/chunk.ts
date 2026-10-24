/**
 * SQLite (through Prisma) rejects a statement with roughly a thousand bound values. Prisma splits a
 * plain `findMany`/`updateMany`/`deleteMany` with a long `in: [...]` list by itself, but not `count`,
 * `groupBy`, `aggregate` or a sorted `findMany`. For factories with thousands of workers, run such
 * queries over slices of the list and merge the results.
 */
export const IN_CHUNK = 400;

/** Runs `query` for each slice of `ids` (in order, one at a time) and concatenates the rows. */
export async function inChunks<I, R>(ids: readonly I[], query: (slice: I[]) => Promise<R[]>, size = IN_CHUNK): Promise<R[]> {
  if (ids.length <= size) return query([...ids]);
  const out: R[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await query(ids.slice(i, i + size))));
  return out;
}

/** Splits a list into slices of at most `size` items. */
export function slices<T>(list: readonly T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
