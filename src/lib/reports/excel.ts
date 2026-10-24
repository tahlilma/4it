import "server-only";
import ExcelJS from "exceljs";
import type { CompanyRow } from "../company";
import { isNumeric, sumRows } from "./format";
import type { Col, ReportOutput, Row } from "./types";

const NUMFMT: Record<string, string> = {
  money: "#,##0.00",
  money0: "#,##0",
  int: "#,##0",
  num: "0.00",
  hours: "0.00",
  pct: '0.00"%"',
  date: "dd/mm/yyyy",
};

function cellValue(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "number") return v;
  return String(v);
}

export async function toXlsx(out: ReportOutput, company: CompanyRow): Promise<Buffer> {
  const t = out.table!;
  const cols: Col[] = t.serial ? [{ key: "__sl", label: "SL", fmt: "int" }, ...t.columns] : t.columns;
  const wb = new ExcelJS.Workbook();
  wb.creator = "HR & Payroll";
  wb.created = new Date();
  const ws = wb.addWorksheet(out.title.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Report");
  const n = cols.length;

  if (!t.excelPlain) {
    const title = (text: string, size: number, bold = true) => {
      const r = ws.addRow([text]);
      ws.mergeCells(r.number, 1, r.number, Math.max(1, n));
      r.getCell(1).font = { bold, size };
      r.getCell(1).alignment = { horizontal: "center" };
    };
    title(company.nameEn, 14);
    if (company.addressEn) title(company.addressEn, 10, false);
    title(out.title, 12);
    if (out.subtitle) title(out.subtitle, 10, false);
    ws.addRow([]);
  }

  const header = ws.addRow(cols.map((c) => c.label));
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF3" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: header.number }];

  const totalRow = (rows: Row[], text: string) => {
    const s = sumRows(rows, t.columns);
    const r = ws.addRow(cols.map((c, i) => (i === 0 ? `${text} (${rows.length})` : c.total ? (s[c.key] as number) : null)));
    r.font = { bold: true };
  };

  let sl = 0;
  const all: Row[] = [];
  for (const g of t.groups) {
    if (g.title && !t.excelPlain) {
      const r = ws.addRow([g.title]);
      ws.mergeCells(r.number, 1, r.number, Math.max(1, n));
      r.getCell(1).font = { bold: true };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
    }
    for (const row of g.rows) {
      sl++;
      all.push(row);
      ws.addRow(cols.map((c) => (c.key === "__sl" ? sl : cellValue(row[c.key]))));
    }
    if (t.subtotals && t.groups.length > 1 && g.rows.length && t.columns.some((c) => c.total)) totalRow(g.rows, "Subtotal");
  }
  if ((t.grandTotal ?? true) && all.length && t.columns.some((c) => c.total)) totalRow(all, "Grand total");

  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.fmt && NUMFMT[c.fmt]) col.numFmt = NUMFMT[c.fmt];
    const longest = Math.max(c.label.length, ...all.slice(0, 300).map((r) => String(r[c.key] ?? "").length));
    col.width = c.width ?? Math.min(45, Math.max(isNumeric(c) ? 10 : 8, longest + 2));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
