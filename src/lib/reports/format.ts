import { dmy } from "../dates";
import { hours, int, money, round2 } from "../num";
import type { Col, Fmt, Row, TableData } from "./types";

export function fmtValue(v: unknown, fmt?: Fmt): string {
  if (v === null || v === undefined || v === "") return "";
  switch (fmt) {
    case "money":
      return typeof v === "number" ? money(v) : String(v);
    case "money0":
      return typeof v === "number" ? money(v, false) : String(v);
    case "int":
      return typeof v === "number" ? int(v) : String(v);
    case "num":
      return typeof v === "number" ? String(round2(v)) : String(v);
    case "hours":
      return typeof v === "number" ? (v === 0 ? "" : hours(v)) : String(v);
    case "pct":
      return typeof v === "number" ? `${round2(v)}%` : String(v);
    case "date":
      return v instanceof Date ? dmy(v) : String(v);
    default:
      return v instanceof Date ? dmy(v) : String(v);
  }
}

export const isNumeric = (c: Col) => ["money", "money0", "int", "num", "hours", "pct"].includes(c.fmt ?? "");

export function sumRows(rows: Row[], cols: Col[]): Row {
  const out: Row = {};
  for (const c of cols) {
    if (!c.total) continue;
    out[c.key] = round2(rows.reduce((s, r) => s + (typeof r[c.key] === "number" ? (r[c.key] as number) : 0), 0));
  }
  return out;
}

export function rowCount(t: TableData): number {
  return t.groups.reduce((s, g) => s + g.rows.length, 0);
}
