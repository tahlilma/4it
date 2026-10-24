import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { todayLocal } from "./dates";

/** The company profile and payroll policy (single row). Memoised per request. */
export const getCompany = cache(async () => {
  const c = await prisma.company.findFirst();
  if (!c) throw new Error("Company profile is missing. Run `npm run setup` to initialise the database.");
  return c;
});

export type CompanyRow = Awaited<ReturnType<typeof getCompany>>;

export async function today(): Promise<Date> {
  const c = await getCompany();
  return todayLocal(c.tzOffsetMinutes);
}
