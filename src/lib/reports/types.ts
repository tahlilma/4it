import type { ReactNode } from "react";
import type { SessionUser } from "../auth";
import type { CompanyRow } from "../company";
import type { EmpFilter, SP } from "../employee-filter";
import type { Perm } from "../rbac";

export type FilterKey =
  | "date" | "range" | "month" | "month2" | "year" | "emp" | "org" | "floor" | "grade" | "mtype" | "type" | "gender" | "religion"
  | "pay" | "status" | "format" | "buyer" | "bonus" | "elrun" | "leaveType" | "team" | "device" | "minDays" | "letter" | "address";

export interface Filters {
  raw: SP;
  date: Date;
  from: Date;
  to: Date;
  month: { year: number; month: number };
  month2: { year: number; month: number };
  year: number;
  emp: EmpFilter;
  format: string;
  buyer?: number;
  bonus?: number;
  elrun?: number;
  leaveType?: number;
  team?: number;
  device?: number;
  minDays: number;
  letter: number;
  address: string;
  param: (k: string) => string; // any other query parameter (case, app, inc …)
  /** Documents print in batches: which batch is shown (1-based) and its size (0 = everything). */
  page: number;
  batchSize: number;
  /** Set by takeBatch when the output was limited to one batch. */
  paging?: Paging;
}

export interface Paging {
  total: number;
  size: number;
  page: number;
  pages: number;
  from: number;
  to: number;
}

export interface ReportCtx {
  company: CompanyRow;
  user: SessionUser;
  today: Date;
}

export type Fmt = "money" | "money0" | "int" | "num" | "hours" | "date" | "text" | "pct" | "time";

export interface Col {
  key: string;
  label: string;
  fmt?: Fmt;
  total?: boolean;
  align?: "left" | "right" | "center";
  bn?: boolean;
  width?: number; // Excel column width (characters)
  className?: string;
}

export type Row = Record<string, unknown>;

export interface Group {
  title?: string;
  rows: Row[];
}

export interface TableData {
  columns: Col[];
  groups: Group[];
  subtotals?: boolean;
  grandTotal?: boolean;
  notes?: string[];
  serial?: boolean; // prepend SL column
  excelPlain?: boolean; // Excel: header in row 1, no title rows (for upload templates)
}

export interface ReportOutput {
  title: string;
  titleBn?: string;
  subtitle?: string;
  layout?: "a4p" | "a4l" | "legall";
  table?: TableData;
  /** Custom document pages (letters, forms, cards). Rendered as-is. */
  node?: ReactNode;
  signatures?: string[];
  empty?: string; // message when nothing matched
}

export interface ReportDef {
  slug: string;
  group: string;
  title: string;
  titleBn?: string;
  description: string;
  perm: Perm;
  filters: FilterKey[];
  formats?: { value: string; label: string }[];
  defaults?: { month?: "current" | "previous"; date?: "today" | "yesterday"; status?: string };
  /** One document per employee: show at most this many at a time, so whole-factory runs stay light. */
  batch?: number;
  run: (f: Filters, ctx: ReportCtx) => Promise<ReportOutput>;
}
