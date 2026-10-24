import "server-only";
import { cache } from "react";
import { addWorkingDays, ymd } from "./dates";
import { prisma } from "./db";
import { getCompany } from "./company";

/**
 * The factory's working-day calendar, loaded once per request: weekly holiday plus the holiday
 * calendar. Returns a function giving the date `n` working days after `date`.
 */
export const workingDayCalendar = cache(async (): Promise<(date: Date, n: number) => Date> => {
  const [company, holidays] = await Promise.all([getCompany(), prisma.holiday.findMany({ select: { date: true } })]);
  const off = new Set(holidays.map((h) => ymd(h.date)));
  return (date, n) => addWorkingDays(date, n, (d) => d.getUTCDay() === company.weeklyHoliday || off.has(ymd(d)));
});

/** `n` working days after `date`, skipping the weekly holiday and the holiday calendar. */
export async function workingDaysAfter(date: Date, n: number): Promise<Date> {
  return (await workingDayCalendar())(date, n);
}
