// Importing punches from machine log files (ZKTeco attlog / CSV) and from devices.
// Punches are append-only; duplicates are ignored.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export interface ParsedPunch {
  punchId: number;
  time: Date; // naive wall clock
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function parseDateToken(s: string): [number, number, number] | null {
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); // DD/MM/YYYY (Bangladesh convention)
  if (m) return [+m[3], +m[2], +m[1]];
  m = /^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})$/.exec(s); // 21-Oct-2026
  if (m && MONTHS[m[2].toLowerCase()]) return [m[3].length === 2 ? 2000 + +m[3] : +m[3], MONTHS[m[2].toLowerCase()], +m[1]];
  return null;
}

function parseTimeToken(s: string): [number, number, number] | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(s.trim());
  if (!m) return null;
  let h = +m[1];
  const ap = m[4]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h > 23 || +m[2] > 59) return null;
  return [h, +m[2], m[3] ? +m[3] : 0];
}

function build(d: [number, number, number], t: [number, number, number]): Date | null {
  const dt = new Date(Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1], t[2]));
  if (dt.getUTCMonth() !== d[1] - 1 || dt.getUTCDate() !== d[2]) return null;
  return dt;
}

/**
 * Accepts:
 *  - ZKTeco attlog:   "   1234\t2026-10-21 07:55:12\t1\t0\t1\t0"
 *  - CSV / TSV:       "1234,2026-10-21 07:55:12"  or  "1234,21/10/2026,07:55"  (header row optional)
 */
export function parseAttendanceText(text: string): { punches: ParsedPunch[]; errors: string[] } {
  const punches: ParsedPunch[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const cells = line.split(/[,;\t]|\s{2,}/).map((c) => c.trim().replace(/^"|"$/g, "")).filter((c) => c !== "");
    // Allow "id date time" separated by single spaces too.
    const tokens = cells.length >= 2 ? cells : line.split(/\s+/);
    const id = Number(tokens[0]);
    if (!Number.isInteger(id) || id <= 0) {
      if (i > 0 || !/[a-z]/i.test(line)) errors.push(`Line ${i + 1}: invalid ID "${tokens[0] ?? ""}"`);
      return; // header rows are skipped silently
    }
    let date: [number, number, number] | null = null;
    let time: [number, number, number] | null = null;
    const rest = tokens.slice(1);
    for (let k = 0; k < rest.length && (!date || !time); k++) {
      const tok = rest[k];
      if (!date && tok.includes(" ")) {
        const [a, ...b] = tok.split(" ");
        const dd = parseDateToken(a);
        const tt = parseTimeToken(b.join(" "));
        if (dd && tt) {
          date = dd;
          time = tt;
          continue;
        }
      }
      if (!date) {
        const dd = parseDateToken(tok);
        if (dd) {
          date = dd;
          continue;
        }
      }
      if (!time) {
        const nextIsAmPm = rest[k + 1] && /^[AaPp][Mm]$/.test(rest[k + 1]);
        const tt = parseTimeToken(nextIsAmPm ? `${tok} ${rest[k + 1]}` : tok);
        if (tt) {
          time = tt;
          if (nextIsAmPm) k++;
        }
      }
    }
    const dt = date && time ? build(date, time) : null;
    if (!dt) {
      errors.push(`Line ${i + 1}: could not read date/time`);
      return;
    }
    punches.push({ punchId: id, time: dt });
  });
  return { punches, errors };
}

export interface ImportResult {
  inserted: number;
  duplicates: number;
  unknownIds: number[];
  from: Date | null;
  to: Date | null;
}

export async function importPunches(
  db: PrismaClient,
  punches: ParsedPunch[],
  opt: { source: "DEVICE" | "FILE" | "MANUAL"; deviceId?: number | null; createdBy: string; reason?: string },
): Promise<ImportResult> {
  if (!punches.length) return { inserted: 0, duplicates: 0, unknownIds: [], from: null, to: null };
  const employees = await db.employee.findMany({ select: { id: true, punchId: true } });
  const empByPunch = new Map(employees.map((e) => [e.punchId, e.id]));

  let min = punches[0].time, max = punches[0].time;
  const seen = new Set<string>();
  const unique: ParsedPunch[] = [];
  for (const p of punches) {
    const k = `${p.punchId}|${p.time.getTime()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
    if (p.time < min) min = p.time;
    if (p.time > max) max = p.time;
  }
  const existing = await db.punchLog.findMany({ where: { time: { gte: min, lte: max } }, select: { punchId: true, time: true } });
  const have = new Set(existing.map((e) => `${e.punchId}|${e.time.getTime()}`));
  const unknown = new Set<number>();
  const data: Prisma.PunchLogCreateManyInput[] = [];
  for (const p of unique) {
    if (have.has(`${p.punchId}|${p.time.getTime()}`)) continue;
    const employeeId = empByPunch.get(p.punchId) ?? null;
    if (!employeeId) unknown.add(p.punchId);
    data.push({ punchId: p.punchId, employeeId, time: p.time, deviceId: opt.deviceId ?? null, source: opt.source, createdBy: opt.createdBy, reason: opt.reason ?? "" });
  }
  for (let i = 0; i < data.length; i += 2000) await db.punchLog.createMany({ data: data.slice(i, i + 2000) });
  return { inserted: data.length, duplicates: punches.length - data.length, unknownIds: [...unknown].slice(0, 50), from: min, to: max };
}
