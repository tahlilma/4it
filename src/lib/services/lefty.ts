// Continuous unauthorised absence detection for s.27(3A) (lefty) cases.

import type { PrismaClient } from "@/generated/prisma/client";
import { inChunks } from "../chunk";
import { addDays, diffDays } from "../dates";

export interface AbsenceRun {
  employeeId: number;
  from: Date;
  lastDate: Date;
  days: number; // calendar days from the first absent day to the latest processed day
  workdaysAbsent: number;
}

/** Employees whose latest processed attendance is an unbroken absence (weekly holidays / holidays don't break it). */
export async function continuousAbsences(db: PrismaClient, minDays: number): Promise<AbsenceRun[]> {
  const latest = await db.attendanceDay.aggregate({ _max: { date: true } });
  const maxDate = latest._max.date;
  if (!maxDate) return [];
  const recent = await db.attendanceDay.findMany({
    where: { date: { gte: addDays(maxDate, -3) }, status: "ABSENT", employee: { status: "ACTIVE" } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  const ids = recent.map((r) => r.employeeId);
  if (!ids.length) return [];
  const rows = await inChunks(ids, (slice) =>
    db.attendanceDay.findMany({
      where: { employeeId: { in: slice }, date: { gte: addDays(maxDate, -120), lte: maxDate } },
      select: { employeeId: true, date: true, status: true },
      orderBy: [{ employeeId: "asc" }, { date: "desc" }],
    }),
  );
  const byEmp = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byEmp.get(r.employeeId) ?? [];
    list.push(r);
    byEmp.set(r.employeeId, list);
  }
  const out: AbsenceRun[] = [];
  for (const [employeeId, list] of byEmp) {
    let from: Date | null = null;
    let workdaysAbsent = 0;
    for (const d of list) {
      if (d.status === "ABSENT") {
        from = d.date;
        workdaysAbsent++;
      } else if (d.status === "OFF") continue;
      else break;
    }
    if (!from) continue;
    const lastDate = list[0].date;
    const days = diffDays(from, lastDate) + 1;
    if (days > minDays) out.push({ employeeId, from, lastDate, days, workdaysAbsent });
  }
  return out.sort((a, b) => b.days - a.days);
}
